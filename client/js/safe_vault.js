// ===== SAFE_VAULT.JS =====
// ระบบตู้เซฟส่วนตัว — วางได้ทุก world กี่ตู้ก็ได้
// แต่ละตู้มี safeId เป็น UUID ไม่ซ้ำกัน
// ของในตู้เซฟแยกกันตาม safeId → Firebase /users/{uid}/vaults/{safeId}

const SafeVault = (() => {

  // ── state ─────────────────────────────────────────────────
  let _uid   = null;
  let _fb    = null;
  let _ready = false;

  // ตู้เซฟที่ตัวเองวาง: Map< safeId → { safeId, worldId, x, y, placedAt } >
  const _mysafes = new Map();

  // vault data ของแต่ละตู้: Map< safeId → [{ id, qty }] >
  const _vaultData = new Map();

  // ตู้เซฟของผู้เล่นอื่น: Map< key(uid_safeId) → { uid, safeId, worldId, x, y } >
  const _othersafes = new Map();

  // ตู้เซฟที่เปิดอยู่ตอนนี้
  let _openSafeId = null;
  let _panelOpen  = false;

  const VAULT_MAX   = 50;
  const PLACE_RANGE = 120;
  const SAFE_SIZE   = 48;

  // ── Firebase paths ────────────────────────────────────────
  function _vaultRef(safeId) {
    return _fb.ref(_fb.db, `users/${_uid}/vaults/${safeId}`);
  }

  // โหลดของในตู้เซฟ 1 ใบจาก Firebase
  async function _loadVault(safeId) {
    try {
      const snap = await _fb.get(_vaultRef(safeId));
      const data = snap.exists() ? (snap.val() ?? []) : [];
      _vaultData.set(safeId, Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn('[Vault] load failed:', safeId, e);
      _vaultData.set(safeId, []);
    }
  }

  async function _saveVault(safeId) {
    if (!_uid || !_fb) return;
    try {
      await _fb.set(_vaultRef(safeId), _vaultData.get(safeId) ?? []);
    } catch (e) {
      console.warn('[Vault] save failed:', safeId, e);
    }
  }

  // ── localStorage cache ────────────────────────────────────
  function _cacheKey() { return `theplayz_mysafes_${_uid}`; }

  function _loadLocal() {
    try {
      const raw = localStorage.getItem(_cacheKey());
      if (raw) {
        const arr = JSON.parse(raw);
        arr.forEach(s => _mysafes.set(s.safeId, s));
      }
    } catch {}
  }

  function _saveLocal() {
    if (!_uid) return;
    localStorage.setItem(_cacheKey(), JSON.stringify([..._mysafes.values()]));
  }

  // ── generate safeId ───────────────────────────────────────
  function _newSafeId() {
    return 'safe_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  // ── socket listeners ──────────────────────────────────────
  function _setupSocketListeners() {
    if (typeof Network === 'undefined') return;

    Network.on('safes_data', ({ worldId, safes }) => {
      if (worldId !== window._selectedWorldId) return;
      // ล้าง others ใน world นี้ก่อน
      for (const [k, s] of _othersafes) {
        if (s.worldId === worldId) _othersafes.delete(k);
      }
      safes.forEach(s => {
        if (s.uid === _uid) {
          // ของตัวเอง — sync กลับถ้ายังไม่มี
          if (!_mysafes.has(s.safeId)) {
            _mysafes.set(s.safeId, s);
            _loadVault(s.safeId);
            _saveLocal();
          }
        } else {
          _othersafes.set(`${s.uid}_${s.safeId}`, s);
        }
      });
    });

    Network.on('safe_placed', ({ uid, worldId, x, y, safeId }) => {
      if (uid !== _uid) {
        _othersafes.set(`${uid}_${safeId}`, { uid, worldId, x, y, safeId });
      }
    });

    Network.on('safe_removed', ({ uid, safeId }) => {
      if (uid !== _uid) {
        _othersafes.delete(`${uid}_${safeId}`);
      }
    });
  }

  // ── init ───────────────────────────────────────────────────
  function init(uid, fb) {
    _uid   = uid;
    _fb    = fb;
    _ready = false;
    _loadLocal();
    // โหลด vault ของทุกตู้ที่มีอยู่
    const loadAll = [..._mysafes.values()].map(s => _loadVault(s.safeId));
    Promise.all(loadAll).then(() => { _ready = true; });
    _setupSocketListeners();
    // sync กับ server หลัง join world
    const t = setInterval(() => {
      if (window._selectedWorldId) {
        Network?.emit('get_safes', { worldId: window._selectedWorldId });
        clearInterval(t);
      }
    }, 500);
  }

  function reset() {
    _uid = null;
    _fb  = null;
    _ready = false;
    _mysafes.clear();
    _vaultData.clear();
    _othersafes.clear();
    _openSafeId = null;
    closePanel();
  }

  function _inSafezone(x, y) {
    const wc = (typeof getWorldConfig !== 'undefined' && window._selectedWorldId)
               ? getWorldConfig(window._selectedWorldId) : null;
    if (!wc || !wc.hasSafeZone || !wc.safeZone) return false;
    const sz = wc.safeZone;
    return Math.sqrt((x-sz.x)**2 + (y-sz.y)**2) < sz.r;
  }

  // ── วางตู้เซฟ ─────────────────────────────────────────────
  function placeSafe(playerX, playerY) {
    if (!_ready) { window.showToast('ระบบตู้เซฟยังโหลดไม่เสร็จ', 'error'); return false; }
    const wid = window._selectedWorldId || 'safezone';
    if (_inSafezone(playerX, playerY)) { window.showToast('❌ ห้ามวางตู้เซฟในเขตปลอดภัย!', 'error'); return false; }

    const safeId = _newSafeId();
    const safe   = { safeId, worldId: wid, x: playerX, y: playerY, placedAt: Date.now() };
    _mysafes.set(safeId, safe);
    _vaultData.set(safeId, []);
    _saveLocal();

    Network?.emit('place_safe', { uid: _uid, worldId: wid, x: playerX, y: playerY, safeId });
    window.showToast('🔒 วางตู้เซฟแล้ว! กด [F] เพื่อเปิด', 'success');
    return true;
  }

  // ── เก็บตู้เซฟคืน ─────────────────────────────────────────
  function pickupSafe(safeId) {
    const safe = _mysafes.get(safeId);
    if (!safe) return;
    const items = _vaultData.get(safeId) ?? [];
    if (items.length > 0) { window.showToast('⚠️ ต้องเอาของออกก่อนเก็บตู้เซฟ!', 'error'); return; }
    _mysafes.delete(safeId);
    _vaultData.delete(safeId);
    _saveLocal();
    Network?.emit('pickup_safe', { uid: _uid, worldId: safe.worldId, safeId });
    // คืน item
    if (typeof Backpack !== 'undefined') Backpack.addItem('personal_safe', 1);
    window.showToast('🔓 เก็บตู้เซฟคืนแล้ว', 'success');
    if (_openSafeId === safeId) closePanel();
  }

  // ── หาตู้เซฟที่อยู่ใกล้ที่สุดของตัวเอง ──────────────────
  function getNearSafe(playerX, playerY) {
    const wid = window._selectedWorldId || 'safezone';
    let nearest = null, minDist = PLACE_RANGE;
    for (const s of _mysafes.values()) {
      if (s.worldId !== wid) continue;
      const d = Math.sqrt((playerX - s.x)**2 + (playerY - s.y)**2);
      if (d < minDist) { minDist = d; nearest = s; }
    }
    return nearest;
  }

  function nearSafe(playerX, playerY) {
    return getNearSafe(playerX, playerY) !== null;
  }

  // ── เปิด/ปิด panel ────────────────────────────────────────
  function openPanel(playerX, playerY) {
    if (!_ready) { window.showToast('กำลังโหลดตู้เซฟ...', 'info'); return; }
    const safe = getNearSafe(playerX, playerY);
    if (!safe) return;
    _openSafeId = safe.safeId;
    _panelOpen  = true;
    _render();
  }

  function closePanel() {
    _panelOpen  = false;
    _openSafeId = null;
    document.getElementById('vault-panel')?.remove();
  }

  function isOpen() { return _panelOpen; }

  // ── vault item helpers ────────────────────────────────────
  function _getItems(safeId) { return _vaultData.get(safeId) ?? []; }

  function _addToVault(safeId, itemId, qty) {
    const items = _getItems(safeId);
    if (items.length >= VAULT_MAX) return 'full';
    const def = _findDef(itemId);
    const stackable = def ? !['weapon','armor','helmet'].includes(def.cat) : true;
    if (!stackable) {
      if (items.length >= VAULT_MAX) return 'full';
      items.push({ id: itemId, qty: 1 });
    } else {
      const idx = items.findIndex(s => s.id === itemId);
      if (idx !== -1) { items[idx].qty += qty; }
      else {
        if (items.length >= VAULT_MAX) return 'full';
        items.push({ id: itemId, qty });
      }
    }
    _vaultData.set(safeId, items);
    _saveVault(safeId);
    return 'ok';
  }

  function _removeFromVault(safeId, itemId, qty, slotIdx) {
    const items = _getItems(safeId);
    const idx   = slotIdx >= 0 ? slotIdx : items.findIndex(s => s.id === itemId);
    if (idx === -1 || idx >= items.length) return false;
    items[idx].qty -= qty;
    if (items[idx].qty <= 0) items.splice(idx, 1);
    _vaultData.set(safeId, items);
    _saveVault(safeId);
    return true;
  }

  function _findDef(id) {
    if (typeof SHOP_ITEMS === 'undefined') return null;
    for (const cat of Object.keys(SHOP_ITEMS)) {
      const found = SHOP_ITEMS[cat].find(i => i.id === id);
      if (found) return { ...found, cat };
    }
    return null;
  }

  // ── deposit / withdraw ────────────────────────────────────
  function depositItem(itemId, qty, bpSlotIdx) {
    if (!_ready || !_openSafeId) return;
    const result = _addToVault(_openSafeId, itemId, qty);
    if (result === 'full') { window.showToast('❌ ตู้เซฟเต็มแล้ว!', 'error'); return; }
    Backpack?.removeItem(itemId, qty, bpSlotIdx);
    Backpack?.render?.();
    _render();
    const def = _findDef(itemId);
    window.showToast(`🔒 เก็บ ${def?.name || itemId} ×${qty} ลงตู้เซฟ`, 'success');
  }

  function withdrawItem(itemId, qty, slotIdx) {
    if (!_ready || !_openSafeId) return;
    if (Backpack?.addItemNoStack(itemId, qty) === 'full') { window.showToast('❌ กระเป๋าเต็ม!', 'error'); return; }
    _removeFromVault(_openSafeId, itemId, qty, slotIdx);
    Backpack?.render?.();
    _render();
    const def = _findDef(itemId);
    window.showToast(`📤 เอา ${def?.name || itemId} ×${qty} เข้ากระเป๋า`, 'success');
  }

  // ── render panel ──────────────────────────────────────────
  function _render() {
    if (!_openSafeId) return;
    let panel = document.getElementById('vault-panel');
    if (!panel) { panel = document.createElement('div'); panel.id = 'vault-panel'; document.body.appendChild(panel); }

    const bpItems    = Backpack?.getItems() ?? [];
    const safeItems  = _getItems(_openSafeId);
    const safeNum    = [..._mysafes.values()].filter(s => s.worldId === window._selectedWorldId).findIndex(s => s.safeId === _openSafeId) + 1;

    panel.innerHTML = `
      <div class="vault-overlay" id="vault-overlay"></div>
      <div class="vault-box">
        <div class="vault-header">
          <span>🔒 ตู้เซฟ #${safeNum}</span>
          <button class="vault-close" id="vault-close-btn">✕</button>
        </div>
        <div class="vault-body">
          <div class="vault-section">
            <div class="vault-sec-title">🎒 กระเป๋า <small>(คลิกเพื่อเก็บ)</small></div>
            <div class="vault-grid-wrap" id="vault-bp-grid">
              ${bpItems.length === 0 ? '<div class="vault-empty">กระเป๋าว่าง</div>'
                : bpItems.map((slot, idx) => {
                    const def = _findDef(slot.id);
                    return `<div class="vault-cell bp-cell" data-id="${slot.id}" data-qty="${slot.qty}" data-idx="${idx}" title="${def?.name || slot.id} ×${slot.qty}">
                      <div class="vault-icon">${def?.icon || '📦'}</div>
                      <div class="vault-qty">${slot.qty > 1 ? '×'+slot.qty : ''}</div>
                    </div>`;
                  }).join('')}
            </div>
          </div>
          <div class="vault-divider"></div>
          <div class="vault-section">
            <div class="vault-sec-title">🔒 ตู้เซฟ <small>(${safeItems.length}/${VAULT_MAX})</small></div>
            <div class="vault-grid-wrap" id="vault-safe-grid">
              ${safeItems.length === 0 ? '<div class="vault-empty">ตู้เซฟว่าง</div>'
                : safeItems.map((slot, idx) => {
                    const def = _findDef(slot.id);
                    return `<div class="vault-cell safe-cell" data-id="${slot.id}" data-qty="${slot.qty}" data-idx="${idx}" title="${def?.name || slot.id} ×${slot.qty}">
                      <div class="vault-icon">${def?.icon || '📦'}</div>
                      <div class="vault-qty">${slot.qty > 1 ? '×'+slot.qty : ''}</div>
                    </div>`;
                  }).join('')}
            </div>
          </div>
        </div>
        <div class="vault-footer">
          <button class="vault-btn-pickup" id="vault-pickup-btn">📦 เก็บตู้เซฟคืน</button>
        </div>
      </div>
    `;

    if (!document.getElementById('vault-style')) {
      const style = document.createElement('style');
      style.id = 'vault-style';
      style.textContent = `
        #vault-panel { position:fixed; inset:0; z-index:9000; display:flex; align-items:center; justify-content:center; }
        .vault-overlay { position:absolute; inset:0; background:rgba(0,0,0,0.6); }
        .vault-box { position:relative; background:#1a1a2e; border:2px solid #f59e0b; border-radius:10px;
                     padding:10px 12px; width:min(620px,96vw); height:min(560px,88vh); max-height:88vh;
                     color:#fff; font-family:sans-serif; box-sizing:border-box;
                     display:flex; flex-direction:column; }
        .vault-header { display:flex; justify-content:space-between; align-items:center;
                        font-size:14px; font-weight:700; color:#f59e0b; margin-bottom:8px; flex-shrink:0; }
        .vault-close { background:none; border:none; color:#fff; font-size:16px; cursor:pointer; padding:0 2px; }
        .vault-close:hover { color:#f59e0b; }
        .vault-body { display:flex; gap:0; align-items:stretch; flex:1; min-height:0; }
        .vault-section { flex:1; min-width:0; display:flex; flex-direction:column; }
        .vault-sec-title { font-size:11px; color:#94a3b8; margin-bottom:5px; font-weight:600; flex-shrink:0; }
        .vault-sec-title small { color:#64748b; font-weight:400; }
        .vault-grid-wrap { flex:1; overflow-y:auto; background:#0f172a; border-radius:6px; padding:6px;
                           display:grid; grid-template-columns:repeat(4,1fr); gap:4px;
                           align-content:start; }
        .vault-grid-wrap::-webkit-scrollbar { width:4px; }
        .vault-grid-wrap::-webkit-scrollbar-track { background:#0f172a; border-radius:6px; }
        .vault-grid-wrap::-webkit-scrollbar-thumb { background:#334155; border-radius:2px; }
        .vault-divider { width:1px; background:#2d3a4a; flex-shrink:0; margin:20px 8px 0; }
        .vault-empty { grid-column:1/-1; text-align:center; color:#475569; font-size:11px;
                       display:flex; align-items:center; justify-content:center; min-height:40px; }
        .vault-cell { position:relative; background:#1e293b; border:1px solid #334155;
                      border-radius:5px; padding:4px 2px; cursor:pointer; user-select:none;
                      display:flex; flex-direction:column; align-items:center; justify-content:center;
                      min-height:44px; transition:border-color .15s, background .15s; }
        .vault-cell:hover { border-color:#f59e0b; background:#2d3a4a; }
        .vault-cell.bp-cell:hover { border-color:#22c55e; background:#14261f; }
        .vault-icon { font-size:18px; line-height:1; }
        .vault-qty { position:absolute; bottom:1px; right:3px; font-size:9px; color:#f59e0b; font-weight:700; }
        .vault-footer { margin-top:8px; display:flex; justify-content:center; flex-shrink:0; }
        .vault-btn-pickup { background:#374151; color:#9ca3af; border:1px solid #4b5563;
                            border-radius:6px; padding:5px 14px; cursor:pointer; font-size:11px; }
        .vault-btn-pickup:hover { background:#4b5563; color:#fff; }
      `;
      document.head.appendChild(style);
    }

    document.getElementById('vault-overlay')?.addEventListener('click', closePanel);
    document.getElementById('vault-close-btn')?.addEventListener('click', closePanel);
    document.getElementById('vault-pickup-btn')?.addEventListener('click', () => {
      pickupSafe(_openSafeId);
    });

    document.querySelectorAll('.bp-cell').forEach(cell => {
      cell.addEventListener('click', () => depositItem(cell.dataset.id, 1, +cell.dataset.idx));
      cell.addEventListener('contextmenu', e => { e.preventDefault(); depositItem(cell.dataset.id, +cell.dataset.qty, +cell.dataset.idx); });
    });
    document.querySelectorAll('.safe-cell').forEach(cell => {
      cell.addEventListener('click', () => withdrawItem(cell.dataset.id, 1, +cell.dataset.idx));
      cell.addEventListener('contextmenu', e => { e.preventDefault(); withdrawItem(cell.dataset.id, +cell.dataset.qty, +cell.dataset.idx); });
    });
  }

  // ── draw ──────────────────────────────────────────────────
  function _drawOneSafe(ctx, s, camX, camY, playerX, playerY, isMine) {
    // ctx ถูก translate(-camera) มาแล้ว → ใช้ world coords โดยตรง
    const sx   = s.x;
    const sy   = s.y;
    const half = SAFE_SIZE / 2;
    ctx.save();
    ctx.shadowColor  = isMine ? '#f59e0b' : '#94a3b8';
    ctx.shadowBlur   = isMine ? 10 : 6;
    ctx.fillStyle    = isMine ? '#1a1a2e' : '#1e1e2e';
    ctx.strokeStyle  = isMine ? '#f59e0b' : '#64748b';
    ctx.lineWidth    = 2;
    ctx.beginPath();
    // ใช้ rect แทน roundRect เพื่อรองรับ browser เก่า
    ctx.rect(sx - half, sy - half, SAFE_SIZE, SAFE_SIZE);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔒', sx, sy);
    if (isMine) {
      const cnt = (_vaultData.get(s.safeId) ?? []).length;
      if (cnt > 0) {
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText(`${cnt}`, sx + half - 6, sy - half + 6);
      }

    }
    ctx.restore();
  }

  function drawSafe(ctx, camX, camY, playerX, playerY) {
    const wid = window._selectedWorldId || 'safezone';
    for (const s of _mysafes.values()) {
      if (s.worldId !== wid) continue;
      _drawOneSafe(ctx, s, camX, camY, playerX, playerY, true);
    }
  }

  function drawOtherSafes(ctx, camX, camY) {
    const wid = window._selectedWorldId || 'safezone';
    for (const s of _othersafes.values()) {
      if (s.worldId !== wid) continue;
      _drawOneSafe(ctx, s, camX, camY, undefined, undefined, false);
    }
  }

  // ── API ───────────────────────────────────────────────────
  function getPlacedSafes() { return [..._mysafes.values()]; }
  function getVaultItems(safeId) { return _getItems(safeId ?? _openSafeId); }
  function getVaultCount(safeId) { return _getItems(safeId ?? _openSafeId).length; }

  // backward-compat: game.js เรียก nearSafe และ openPanel แบบเดิม
  // game.js: SafeVault.openPanel() — ส่ง player position ไปด้วย
  function openPanelNear(playerX, playerY) { openPanel(playerX, playerY); }

  return {
    init, reset,
    placeSafe, pickupSafe,
    nearSafe, openPanel: openPanelNear, closePanel, isOpen,
    drawSafe, drawOtherSafes,
    depositItem, withdrawItem,
    getPlacedSafes, getVaultItems, getVaultCount,
    // backward compat
    getPlacedSafe: () => _mysafes.values().next().value ?? null,
    syncSafes: (wid) => Network?.emit('get_safes', { worldId: wid }),
  };
})();

window.SafeVault = SafeVault;
