// ===== SAFE_VAULT.JS =====
// ระบบตู้เซฟส่วนตัว — วางในแผนที่ได้ (ห้ามอยู่ใน safezone), เก็บของจาก backpack
//
// ไอเทม "personal_safe" ซื้อจากร้านค้า → เก็บใน Stash
// นำไปวางใน world (ไม่ใช่ safezone) → ปรากฏเป็นตู้เซฟบนแผนที่
// เปิดตู้เซฟ → ย้ายของจาก Backpack → Firebase /users/{uid}/vault
//
// Firebase path: /users/{uid}/vault  →  [{ id, qty }, ...]

const SafeVault = (() => {

  // ── state ─────────────────────────────────────────────────
  let _uid       = null;
  let _fb        = null;
  let _vaultData = [];       // [{ id, qty }] — ของที่อยู่ในตู้เซฟ
  let _ready     = false;

  // ตู้เซฟที่วางอยู่ในโลกปัจจุบัน (client-side เท่านั้น, persist ใน localStorage)
  // { worldId: { x, y, placedAt } }
  let _placedSafe = null;    // null = ยังไม่ได้วาง

  // UI
  let _panelOpen  = false;
  let _dragId     = null;    // itemId ที่กำลัง drag จาก BP → vault

  const VAULT_MAX     = 50;   // ของสูงสุดในตู้เซฟ (slots)
  const PLACE_RANGE   = 120;  // ระยะวาง/เปิดตู้เซฟ (px)
  const SAFE_SIZE     = 48;   // ขนาดกล่องตู้เซฟ (px วาดบน canvas)

  // ── Firebase path ─────────────────────────────────────────
  function _vaultRef()  { return _fb.ref(_fb.db, `users/${_uid}/vault`); }

  // ── load vault จาก Firebase ──────────────────────────────
  async function _load() {
    try {
      const snap = await _fb.get(_vaultRef());
      _vaultData = snap.exists() ? (snap.val() ?? []) : [];
      if (!Array.isArray(_vaultData)) _vaultData = [];
    } catch (e) {
      console.warn('[Vault] load failed:', e);
      _vaultData = [];
    }
    _ready = true;
  }

  async function _save() {
    if (!_uid || !_fb) return;
    try {
      await _fb.set(_vaultRef(), _vaultData);
    } catch (e) {
      console.warn('[Vault] save failed:', e);
    }
  }

  // ── localStorage key สำหรับตู้เซฟที่วางไว้ ───────────────
  function _safeKey() { return `theplayz_safe_placed_${_uid}`; }

  function _loadPlaced() {
    try {
      const raw = localStorage.getItem(_safeKey());
      if (raw) _placedSafe = JSON.parse(raw);
    } catch { _placedSafe = null; }
  }

  function _savePlaced() {
    if (!_uid) return;
    if (_placedSafe) {
      localStorage.setItem(_safeKey(), JSON.stringify(_placedSafe));
    } else {
      localStorage.removeItem(_safeKey());
    }
  }

  // ── init ───────────────────────────────────────────────────
  function init(uid, fb) {
    _uid  = uid;
    _fb   = fb;
    _ready = false;
    _load();
    _loadPlaced();
  }

  function reset() {
    _uid       = null;
    _fb        = null;
    _vaultData = [];
    _ready     = false;
    _placedSafe = null;
    closePanel();
  }

  // ── ตรวจว่าอยู่ใน safezone หรือเปล่า ────────────────────
  function _inSafezone(x, y) {
    const wc = (typeof getWorldConfig !== 'undefined' && window._selectedWorldId)
               ? getWorldConfig(window._selectedWorldId) : null;
    if (!wc || !wc.hasSafeZone || !wc.safeZone) return false;
    const sz = wc.safeZone;
    const dx = x - sz.x, dy = y - sz.y;
    return Math.sqrt(dx*dx + dy*dy) < sz.r;
  }

  // ── วางตู้เซฟ ─────────────────────────────────────────────
  // เรียกจาก game.js เมื่อผู้เล่นใช้ไอเทม personal_safe
  function placeSafe(playerX, playerY) {
    if (!_ready) { window.showToast('ระบบตู้เซฟยังโหลดไม่เสร็จ', 'error'); return false; }

    // ตรวจ worldId — ห้ามวางใน safezone world (worldId === 'safezone')
    const wid = window._selectedWorldId || 'safezone';
    if (wid === 'safezone') {
      window.showToast('❌ วางตู้เซฟใน Safezone ไม่ได้!', 'error');
      return false;
    }

    // ตรวจว่าอยู่ในเขต safezone (วงกลม) หรือเปล่า
    if (_inSafezone(playerX, playerY)) {
      window.showToast('❌ ห้ามวางตู้เซฟในเขตปลอดภัย!', 'error');
      return false;
    }

    // มีตู้เซฟวางอยู่แล้วใน world นี้หรือเปล่า
    if (_placedSafe && _placedSafe.worldId === wid) {
      window.showToast('⚠️ คุณมีตู้เซฟวางอยู่แล้วใน world นี้!', 'error');
      return false;
    }

    // ตัด personal_safe ออกจาก Stash
    if (typeof Stash === 'undefined' || Stash.getQty('personal_safe') <= 0) {
      // ตัดจาก Backpack ถ้าไม่อยู่ใน Stash (เพราะถือในกระเป๋า)
      if (typeof Backpack === 'undefined' || !Backpack.removeItemById('personal_safe')) {
        window.showToast('❌ ไม่มีไอเทมตู้เซฟ!', 'error');
        return false;
      }
    } else {
      Stash.spend('personal_safe', 1);
    }

    _placedSafe = { worldId: wid, x: playerX, y: playerY, placedAt: Date.now() };
    _savePlaced();
    window.showToast('🔒 วางตู้เซฟแล้ว! กดที่ตู้เซฟเพื่อเปิด', 'success');
    return true;
  }

  // ── เก็บตู้เซฟคืน (ไม่มีของในนั้น) ─────────────────────
  function pickupSafe() {
    if (!_placedSafe) return;
    if (_vaultData.length > 0) {
      window.showToast('⚠️ ต้องเอาของออกจากตู้เซฟก่อนเก็บ!', 'error');
      return;
    }
    _placedSafe = null;
    _savePlaced();
    // คืน item กลับ Stash
    if (typeof Stash !== 'undefined') Stash.add('personal_safe', 1);
    window.showToast('🔓 เก็บตู้เซฟคืนแล้ว', 'success');
  }

  // ── ตรวจว่าผู้เล่นอยู่ใกล้ตู้เซฟ ────────────────────────
  function nearSafe(playerX, playerY) {
    if (!_placedSafe) return false;
    const wid = window._selectedWorldId || 'safezone';
    if (_placedSafe.worldId !== wid) return false;
    const dx = playerX - _placedSafe.x;
    const dy = playerY - _placedSafe.y;
    return Math.sqrt(dx*dx + dy*dy) < PLACE_RANGE;
  }

  // ── เปิด/ปิด panel ────────────────────────────────────────
  function openPanel() {
    if (!_ready) { window.showToast('กำลังโหลดตู้เซฟ...', 'info'); return; }
    _panelOpen = true;
    _render();
  }

  function closePanel() {
    _panelOpen = false;
    const el = document.getElementById('vault-panel');
    if (el) el.remove();
  }

  function isOpen() { return _panelOpen; }

  // ── vault item helpers ────────────────────────────────────
  function _vaultTotalSlots() { return _vaultData.length; }

  function _findInVault(itemId) {
    return _vaultData.findIndex(s => s.id === itemId);
  }

  function _addToVault(itemId, qty) {
    if (_vaultData.length >= VAULT_MAX) return 'full';
    const def = _findDef(itemId);
    const canStack = def ? !['weapon','armor','helmet'].includes(def.cat) : true;

    if (!canStack) {
      if (_vaultData.length >= VAULT_MAX) return 'full';
      _vaultData.push({ id: itemId, qty: 1 });
    } else {
      const idx = _findInVault(itemId);
      if (idx !== -1) {
        _vaultData[idx].qty += qty;
      } else {
        if (_vaultData.length >= VAULT_MAX) return 'full';
        _vaultData.push({ id: itemId, qty });
      }
    }
    _save();
    return 'ok';
  }

  function _removeFromVault(itemId, qty, slotIdx) {
    const idx = slotIdx >= 0 ? slotIdx : _findInVault(itemId);
    if (idx === -1) return false;
    _vaultData[idx].qty -= qty;
    if (_vaultData[idx].qty <= 0) _vaultData.splice(idx, 1);
    _save();
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

  // ── ย้ายของ BP → Vault ────────────────────────────────────
  function depositItem(itemId, qty, bpSlotIdx) {
    if (!_ready) return;
    if (typeof Backpack === 'undefined') return;

    const result = _addToVault(itemId, qty);
    if (result === 'full') {
      window.showToast('❌ ตู้เซฟเต็มแล้ว!', 'error');
      return;
    }
    Backpack.removeItem(itemId, qty, bpSlotIdx);
    if (typeof Backpack.render === 'function') Backpack.render();
    _render();
    const def = _findDef(itemId);
    window.showToast(`🔒 เก็บ ${def?.name || itemId} ×${qty} ลงตู้เซฟ`, 'success');
  }

  // ── ย้ายของ Vault → BP ────────────────────────────────────
  function withdrawItem(itemId, qty, slotIdx) {
    if (!_ready) return;
    if (typeof Backpack === 'undefined') return;

    const result = Backpack.addItem(itemId, qty);
    if (result === 'full') {
      window.showToast('❌ กระเป๋าเต็ม!', 'error');
      return;
    }
    _removeFromVault(itemId, qty, slotIdx);
    if (typeof Backpack.render === 'function') Backpack.render();
    _render();
    const def = _findDef(itemId);
    window.showToast(`📤 เอา ${def?.name || itemId} ×${qty} เข้ากระเป๋า`, 'success');
  }

  // ── render UI panel ───────────────────────────────────────
  function _render() {
    let panel = document.getElementById('vault-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'vault-panel';
      document.body.appendChild(panel);
    }

    const bpItems = (typeof Backpack !== 'undefined') ? Backpack.getItems() : [];

    panel.innerHTML = `
      <div class="vault-overlay" id="vault-overlay"></div>
      <div class="vault-box">
        <div class="vault-header">
          <span>🔒 ตู้เซฟส่วนตัว</span>
          <button class="vault-close" id="vault-close-btn">✕</button>
        </div>
        <div class="vault-body">
          <!-- ฝั่งซ้าย: กระเป๋า -->
          <div class="vault-section">
            <div class="vault-sec-title">🎒 กระเป๋า (คลิกเพื่อเก็บ)</div>
            <div class="vault-grid" id="vault-bp-grid">
              ${bpItems.length === 0
                ? '<div class="vault-empty">กระเป๋าว่าง</div>'
                : bpItems.map((slot, idx) => {
                    const def = _findDef(slot.id);
                    const icon = def?.icon || '📦';
                    return `<div class="vault-cell bp-cell" 
                              data-id="${slot.id}" 
                              data-qty="${slot.qty}" 
                              data-idx="${idx}"
                              title="${def?.name || slot.id} ×${slot.qty}">
                      <div class="vault-icon">${icon}</div>
                      <div class="vault-qty">${slot.qty > 1 ? '×'+slot.qty : ''}</div>
                    </div>`;
                  }).join('')
              }
            </div>
          </div>

          <!-- ลูกศรกลาง -->
          <div class="vault-arrows">
            <div class="vault-arrow-hint">← →</div>
            <div class="vault-arrow-sub">คลิกเพื่อย้าย</div>
          </div>

          <!-- ฝั่งขวา: ตู้เซฟ -->
          <div class="vault-section">
            <div class="vault-sec-title">🔒 ตู้เซฟ (${_vaultData.length}/${VAULT_MAX})</div>
            <div class="vault-grid" id="vault-safe-grid">
              ${_vaultData.length === 0
                ? '<div class="vault-empty">ตู้เซฟว่าง</div>'
                : _vaultData.map((slot, idx) => {
                    const def = _findDef(slot.id);
                    const icon = def?.icon || '📦';
                    return `<div class="vault-cell safe-cell" 
                              data-id="${slot.id}" 
                              data-qty="${slot.qty}" 
                              data-idx="${idx}"
                              title="${def?.name || slot.id} ×${slot.qty}">
                      <div class="vault-icon">${icon}</div>
                      <div class="vault-qty">${slot.qty > 1 ? '×'+slot.qty : ''}</div>
                    </div>`;
                  }).join('')
              }
            </div>
          </div>
        </div>
        <div class="vault-footer">
          <button class="vault-btn-pickup" id="vault-pickup-btn">📦 เก็บตู้เซฟคืน</button>
        </div>
      </div>
    `;

    // ── styles (inject ถ้ายังไม่มี) ──────────────────────────
    if (!document.getElementById('vault-style')) {
      const style = document.createElement('style');
      style.id = 'vault-style';
      style.textContent = `
        #vault-panel { position:fixed; inset:0; z-index:9000; display:flex; align-items:center; justify-content:center; }
        .vault-overlay { position:absolute; inset:0; background:rgba(0,0,0,0.6); }
        .vault-box { position:relative; background:#1a1a2e; border:2px solid #f59e0b; border-radius:12px;
                     padding:16px; min-width:520px; max-width:90vw; color:#fff; font-family:sans-serif; }
        .vault-header { display:flex; justify-content:space-between; align-items:center;
                        font-size:18px; font-weight:700; color:#f59e0b; margin-bottom:12px; }
        .vault-close { background:none; border:none; color:#fff; font-size:20px; cursor:pointer; }
        .vault-close:hover { color:#f59e0b; }
        .vault-body { display:flex; gap:16px; align-items:flex-start; }
        .vault-section { flex:1; }
        .vault-sec-title { font-size:12px; color:#94a3b8; margin-bottom:8px; font-weight:600; }
        .vault-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:6px;
                      min-height:80px; background:#0f172a; border-radius:8px; padding:8px; }
        .vault-empty { grid-column:1/-1; text-align:center; color:#475569; font-size:12px;
                       display:flex; align-items:center; justify-content:center; min-height:60px; }
        .vault-cell { position:relative; background:#1e293b; border:1px solid #334155;
                      border-radius:6px; padding:6px; cursor:pointer; user-select:none;
                      display:flex; flex-direction:column; align-items:center; justify-content:center;
                      min-height:60px; transition:border-color .15s, background .15s; }
        .vault-cell:hover { border-color:#f59e0b; background:#2d3a4a; }
        .vault-cell.bp-cell:hover { border-color:#22c55e; background:#14261f; }
        .vault-icon { font-size:24px; line-height:1; }
        .vault-icon img { width:36px; height:36px; object-fit:contain; }
        .vault-qty { position:absolute; bottom:2px; right:4px; font-size:11px;
                     color:#f59e0b; font-weight:700; }
        .vault-arrows { display:flex; flex-direction:column; align-items:center;
                        justify-content:center; gap:4px; padding:0 4px; color:#64748b; }
        .vault-arrow-hint { font-size:20px; }
        .vault-arrow-sub { font-size:10px; text-align:center; line-height:1.2; }
        .vault-footer { margin-top:12px; display:flex; justify-content:center; }
        .vault-btn-pickup { background:#374151; color:#9ca3af; border:1px solid #4b5563;
                            border-radius:8px; padding:8px 20px; cursor:pointer; font-size:13px; }
        .vault-btn-pickup:hover { background:#4b5563; color:#fff; }
      `;
      document.head.appendChild(style);
    }

    // ── events ────────────────────────────────────────────────
    document.getElementById('vault-overlay')?.addEventListener('click', closePanel);
    document.getElementById('vault-close-btn')?.addEventListener('click', closePanel);
    document.getElementById('vault-pickup-btn')?.addEventListener('click', () => {
      pickupSafe();
      closePanel();
    });

    // BP cell คลิก → deposit 1 ชิ้น
    document.querySelectorAll('.bp-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const id  = cell.dataset.id;
        const qty = parseInt(cell.dataset.qty) || 1;
        const idx = parseInt(cell.dataset.idx);
        depositItem(id, 1, idx);
      });
      cell.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const id  = cell.dataset.id;
        const qty = parseInt(cell.dataset.qty) || 1;
        const idx = parseInt(cell.dataset.idx);
        depositItem(id, qty, idx);  // right-click = ย้ายทั้งหมด
      });
    });

    // Vault cell คลิก → withdraw 1 ชิ้น
    document.querySelectorAll('.safe-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const id  = cell.dataset.id;
        const qty = parseInt(cell.dataset.qty) || 1;
        const idx = parseInt(cell.dataset.idx);
        withdrawItem(id, 1, idx);
      });
      cell.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const id  = cell.dataset.id;
        const qty = parseInt(cell.dataset.qty) || 1;
        const idx = parseInt(cell.dataset.idx);
        withdrawItem(id, qty, idx);  // right-click = เอาออกทั้งหมด
      });
    });
  }

  // ── วาดตู้เซฟบน canvas ───────────────────────────────────
  // เรียกจาก game.js ใน draw loop
  function drawSafe(ctx, camX, camY, playerX, playerY) {
    const wid = window._selectedWorldId || 'safezone';
    if (!_placedSafe || _placedSafe.worldId !== wid) return;

    const sx = _placedSafe.x - camX;
    const sy = _placedSafe.y - camY;
    const half = SAFE_SIZE / 2;

    // เงา
    ctx.save();
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur  = 10;

    // กล่องตู้เซฟ
    ctx.fillStyle = '#1a1a2e';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(sx - half, sy - half, SAFE_SIZE, SAFE_SIZE, 6);
    ctx.fill();
    ctx.stroke();

    // ไอคอน 🔒
    ctx.shadowBlur = 0;
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔒', sx, sy);

    // แสดงจำนวนของ
    if (_vaultData.length > 0) {
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(`${_vaultData.length}`, sx + half - 6, sy - half + 6);
    }

    // ถ้าอยู่ใกล้ → แสดง hint
    const dist = Math.sqrt((playerX - _placedSafe.x)**2 + (playerY - _placedSafe.y)**2);
    if (dist < PLACE_RANGE * 1.5) {
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('กด [F] เปิดตู้เซฟ', sx, sy - half - 10);
    }

    ctx.restore();
  }

  // ── API สำหรับ game.js ────────────────────────────────────
  function getPlacedSafe() { return _placedSafe; }
  function getVaultItems()  { return _vaultData; }
  function getVaultCount()  { return _vaultData.length; }

  return {
    init, reset,
    placeSafe, pickupSafe,
    nearSafe, openPanel, closePanel, isOpen,
    drawSafe,
    depositItem, withdrawItem,
    getPlacedSafe, getVaultItems, getVaultCount,
  };
})();

window.SafeVault = SafeVault;
