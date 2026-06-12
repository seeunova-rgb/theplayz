// ===== DEV.JS =====
// ระบบ DEV สำหรับผู้ที่มี dev: true ใน Firestore
// path: /users/{uid}/dev/status  →  { active: true }
//
// ฟีเจอร์:
//   🎒 เสกของ   — เพิ่มไอเทมเข้า Stash (Lobby) หรือ Backpack (In-Game)
//   💵 เสกเงิน  — เพิ่ม money / point
//   🧟 เสกซอมบี้ — spawn zombie ที่ตำแหน่ง player
//   ☠ เสกบอส  — spawn boss ที่ตำแหน่ง player

const Dev = (() => {

  let _active   = false;
  let _ready    = false;
  let _panelOpen = false;
  let _tab      = 'item';   // 'item' | 'money' | 'entity' | 'cheat'
  const _onReadyCallbacks = [];

  // ── cheat state (เฉพาะตัวเอง, client-side) ─────────────────
  window._devGod        = window._devGod        || false;
  window._devLockHead   = window._devLockHead   || false;
  window._devInvisible  = window._devInvisible  || false;

  // ── Firestore load ────────────────────────────────────────
  async function _load(getDoc, docRef) {
    try {
      const snap = await getDoc(docRef);
      _active = snap.exists() && snap.data().active === true;
    } catch (e) {
      console.warn('[Dev] load failed:', e);
      _active = false;
    }
    _ready = true;
    _onReadyCallbacks.forEach(fn => fn());
    if (_active) _injectButton();
  }

  // ── ปุ่ม DEV ซ้ายบน (ต่อจาก Shop) ───────────────────────
  function _injectButton() {
    if (document.getElementById('btn-dev')) return;
    const btn = document.createElement('button');
    btn.id = 'btn-dev';
    btn.textContent = '⚙';
    btn.title = 'DEV Panel';
    btn.onclick = toggle;
    document.body.appendChild(btn);
  }

  // ── สร้าง overlay ─────────────────────────────────────────
  function _ensureOverlay() {
    if (document.getElementById('dev-overlay')) return;

    const el = document.createElement('div');
    el.id = 'dev-overlay';
    el.innerHTML = `
      <div id="dev-panel">
        <div class="dev-header">
          <span class="dev-title">⚙ DEV PANEL</span>
          <div class="dev-tabs">
            <button class="dev-tab active" data-tab="item">🎒 ของ</button>
            <button class="dev-tab" data-tab="money">💵 เงิน</button>
            <button class="dev-tab" data-tab="entity">🧟 Entity</button>
            <button class="dev-tab" data-tab="cheat">🛠 Cheat</button>
          </div>
          <button class="dev-close" id="dev-close-btn">✕</button>
        </div>
        <div class="dev-body" id="dev-body"></div>
      </div>`;
    document.body.appendChild(el);

    // tab click
    el.querySelectorAll('.dev-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        _tab = btn.dataset.tab;
        el.querySelectorAll('.dev-tab').forEach(b => b.classList.toggle('active', b === btn));
        _renderBody();
      });
    });

    document.getElementById('dev-close-btn').addEventListener('click', close);
    el.addEventListener('click', e => { if (e.target === el) close(); });
  }

  // ── render body ───────────────────────────────────────────
  function _renderBody() {
    const body = document.getElementById('dev-body');
    if (!body) return;

    if (_tab === 'item')   body.innerHTML = _htmlItem();
    if (_tab === 'money')  body.innerHTML = _htmlMoney();
    if (_tab === 'entity') body.innerHTML = _htmlEntity();
    if (_tab === 'cheat')  body.innerHTML = _htmlCheat();
  }

  // ── Tab: เสกของ ───────────────────────────────────────────
  function _htmlItem() {
    const cats = {
      weapon: 'ปืน', armor: 'เกราะ', helmet: 'หมวก', med: 'ยา', supply: 'ซัพพลาย',
    };
    const options = Object.entries(cats).map(([cat, label]) => {
      const items = (SHOP_ITEMS[cat] || []);
      if (!items.length) return '';
      return `<optgroup label="${label}">` +
        items.map(i => `<option value="${i.id}">${i.name}</option>`).join('') +
        `</optgroup>`;
    }).join('');

    return `
      <div class="dev-section">
        <div class="dev-label">ไอเทม</div>
        <select id="dev-item-sel" class="dev-select">${options}</select>
        <div class="dev-row">
          <input id="dev-item-qty" class="dev-input" type="number" min="1" value="1" placeholder="จำนวน">
          <button class="dev-btn green" onclick="Dev.giveItem()">เสก ✓</button>
        </div>
        <div class="dev-hint" id="dev-item-hint"></div>
      </div>`;
  }

  // ── Tab: เสกเงิน ──────────────────────────────────────────
  function _htmlMoney() {
    return `
      <div class="dev-section">
        <div class="dev-label">💵 Money</div>
        <div class="dev-row">
          <input id="dev-money-amt" class="dev-input" type="number" min="1" value="10000" placeholder="จำนวน">
          <button class="dev-btn green" onclick="Dev.giveMoney('money')">เสก ✓</button>
        </div>
        <div class="dev-label" style="margin-top:12px">💎 Point</div>
        <div class="dev-row">
          <input id="dev-point-amt" class="dev-input" type="number" min="1" value="1000" placeholder="จำนวน">
          <button class="dev-btn blue" onclick="Dev.giveMoney('point')">เสก ✓</button>
        </div>
      </div>`;
  }

  // ── Tab: เสก Entity ───────────────────────────────────────
  function _htmlEntity() {
    return `
      <div class="dev-section">
        <div class="dev-label">🧟 Zombie</div>
        <div class="dev-row">
          <input id="dev-zombie-qty" class="dev-input" type="number" min="1" max="50" value="1" placeholder="จำนวน">
          <button class="dev-btn yellow" onclick="Dev.spawnZombie()">เสก ✓</button>
        </div>
        <div class="dev-label" style="margin-top:12px">☠ Boss</div>
        <div class="dev-row">
          <button class="dev-btn red" onclick="Dev.spawnBoss()">เสก Boss ✓</button>
        </div>
        <div class="dev-hint" id="dev-entity-hint"></div>
      </div>`;
  }

  // ── Tab: Cheat (เฉพาะตัวเอง) ──────────────────────────────
  function _htmlCheat() {
    const p = window._player;
    // [FIX] CONFIG อาจยังไม่ถูกโหลดตอนอยู่ Lobby — ใช้ fallback แทนการอ้างตรง
    const _defaultSpeed = (typeof CONFIG !== 'undefined' && CONFIG.PLAYER_SPEED) ? CONFIG.PLAYER_SPEED : 2;
    const hpVal    = p ? Math.round(p.hp ?? 100)        : 100;
    const speedVal = p ? (p.baseSpeed ?? _defaultSpeed) : _defaultSpeed;
    const regenVal = p ? (p.regenPerSec ?? 0)           : 0;

    return `
      <div class="dev-section">
        <div class="dev-label">⚔ Combat / Hitbox</div>
        <div class="dev-row">
          <button class="dev-btn toggle ${window._devGod ? 'on' : ''}" onclick="Dev.toggleGod()">
            ${window._devGod ? '🛡 อมตะ: ON' : '🛡 อมตะ: OFF'}
          </button>
        </div>
        <div class="dev-row">
          <button class="dev-btn toggle ${window._devLockHead ? 'on' : ''}" onclick="Dev.toggleLockHead()">
            ${window._devLockHead ? '🎯 ล็อคหัว: ON' : '🎯 ล็อคหัว: OFF'}
          </button>
        </div>
        <div class="dev-row">
          <button class="dev-btn toggle ${window._devInvisible ? 'on' : ''}" onclick="Dev.toggleInvisible()">
            ${window._devInvisible ? '👻 หายตัว: ON' : '👻 หายตัว: OFF'}
          </button>
        </div>

        <div class="dev-divider"></div>

        <div class="dev-label">🚀 เทเลพอร์ต</div>
        <div class="dev-row">
          <input id="dev-tp-x" class="dev-input" type="number" placeholder="X" value="${p ? Math.round(p.x) : ''}">
          <input id="dev-tp-y" class="dev-input" type="number" placeholder="Y" value="${p ? Math.round(p.y) : ''}">
          <button class="dev-btn purple" onclick="Dev.teleport()">ไป ✓</button>
        </div>
        <div class="dev-row">
          <button class="dev-btn grey" onclick="Dev.teleportCenter()">🎯 กลางแมพ</button>
        </div>

        <div class="dev-divider"></div>

        <div class="dev-label">❤️ SET HP</div>
        <div class="dev-row">
          <input id="dev-set-hp" class="dev-input" type="number" min="1" value="${hpVal}" placeholder="HP">
          <button class="dev-btn green" onclick="Dev.setHp()">ตั้งค่า ✓</button>
        </div>

        <div class="dev-label">🏃 SET SPEED</div>
        <div class="dev-row">
          <input id="dev-set-speed" class="dev-input" type="number" min="0" step="0.1" value="${speedVal}" placeholder="Speed">
          <button class="dev-btn blue" onclick="Dev.setSpeed()">ตั้งค่า ✓</button>
        </div>

        <div class="dev-label">♻ SET REGEN (HP/วินาที)</div>
        <div class="dev-row">
          <input id="dev-set-regen" class="dev-input" type="number" min="0" step="0.1" value="${regenVal}" placeholder="Regen">
          <button class="dev-btn yellow" onclick="Dev.setRegen()">ตั้งค่า ✓</button>
        </div>

        <div class="dev-hint" id="dev-cheat-hint"></div>
      </div>`;
  }


  function giveItem() {
    const sel  = document.getElementById('dev-item-sel');
    const qty  = Math.max(1, parseInt(document.getElementById('dev-item-qty')?.value) || 1);
    const hint = document.getElementById('dev-item-hint');
    if (!sel) return;
    const itemId = sel.value;

    // หาชื่อไอเทม
    let itemName = itemId;
    for (const cat of Object.keys(SHOP_ITEMS)) {
      const found = SHOP_ITEMS[cat].find(i => i.id === itemId);
      if (found) { itemName = found.name; break; }
    }

    // ถ้าอยู่ในเกม → เข้า Backpack โดยตรง
    const inGame = typeof window._isInGame !== 'undefined' && window._isInGame;
    if (inGame && typeof Backpack !== 'undefined') {
      const result = Backpack.addItem(itemId, qty);
      if (result === 'full') {
        if (hint) hint.textContent = '❌ กระเป๋าเต็ม';
        return;
      }
      if (hint) hint.textContent = `✓ ${itemName} ×${qty} → กระเป๋า`;
    } else {
      // Lobby → เข้า Stash
      if (typeof Stash !== 'undefined') {
        Stash.add(itemId, qty);
        if (hint) hint.textContent = `✓ ${itemName} ×${qty} → คลัง`;
      }
    }
    window.showToast(`[DEV] เสก ${itemName} ×${qty} ✓`, 'success');
  }

  function giveMoney(currency) {
    const inputId = currency === 'money' ? 'dev-money-amt' : 'dev-point-amt';
    const amt = Math.max(1, parseInt(document.getElementById(inputId)?.value) || 0);
    if (typeof Money !== 'undefined') {
      Money.earn(currency, amt);
      window.showToast(`[DEV] +${amt.toLocaleString()} ${currency === 'money' ? '💵' : '💎'} ✓`, 'success');
    }
  }

  function spawnZombie() {
    const inGame = typeof window._isInGame !== 'undefined' && window._isInGame;
    if (!inGame) return window.showToast('[DEV] ต้องอยู่ในเกม', 'error');
    if (typeof Entity === 'undefined' || !Entity.spawnZombieAt) return window.showToast('[DEV] Entity ยังไม่พร้อม', 'error');
    const qty = Math.min(50, Math.max(1, parseInt(document.getElementById('dev-zombie-qty')?.value) || 1));
    const p = window._player;
    if (!p) return;
    const offset = 120;
    for (let i = 0; i < qty; i++) {
      const angle = (i / qty) * Math.PI * 2;
      Entity.spawnZombieAt(p.x + Math.cos(angle) * offset, p.y + Math.sin(angle) * offset);
    }
    const hint = document.getElementById('dev-entity-hint');
    if (hint) hint.textContent = `✓ spawn zombie ×${qty}`;
    window.showToast(`[DEV] spawn zombie ×${qty} ✓`, 'success');
  }

  function spawnBoss() {
    const inGame = typeof window._isInGame !== 'undefined' && window._isInGame;
    if (!inGame) return window.showToast('[DEV] ต้องอยู่ในเกม', 'error');
    if (typeof Entity === 'undefined' || !Entity.spawnBossAt) return window.showToast('[DEV] Entity ยังไม่พร้อม', 'error');
    const p = window._player;
    if (!p) return;
    Entity.spawnBossAt(p.x + 200, p.y);
    const hint = document.getElementById('dev-entity-hint');
    if (hint) hint.textContent = '✓ spawn boss';
    window.showToast('[DEV] spawn boss ✓', 'success');
  }

  // ── Cheat actions (เฉพาะตัวเอง) ────────────────────────────
  function _cheatHint(msg) {
    const hint = document.getElementById('dev-cheat-hint');
    if (hint) hint.textContent = msg;
  }

  function toggleGod() {
    window._devGod = !window._devGod;
    _cheatHint(window._devGod ? '✓ อมตะเปิด' : '✓ อมตะปิด');
    window.showToast(`[DEV] อมตะ ${window._devGod ? 'ON' : 'OFF'}`, 'success');
    if (_tab === 'cheat') _renderBody();
  }

  function toggleLockHead() {
    window._devLockHead = !window._devLockHead;
    _cheatHint(window._devLockHead ? '✓ ล็อคหัวเปิด — ทุกกระสุนเป็น headshot' : '✓ ล็อคหัวปิด');
    window.showToast(`[DEV] ล็อคหัว ${window._devLockHead ? 'ON' : 'OFF'}`, 'success');
    if (_tab === 'cheat') _renderBody();
  }

  function toggleInvisible() {
    window._devInvisible = !window._devInvisible;
    _cheatHint(window._devInvisible ? '✓ หายตัวเปิด — ผู้เล่นอื่นจะไม่เห็นคุณ' : '✓ หายตัวปิด');
    window.showToast(`[DEV] หายตัว ${window._devInvisible ? 'ON' : 'OFF'}`, 'success');
    if (_tab === 'cheat') _renderBody();
  }

  function teleport() {
    const p = window._player;
    if (!p) return window.showToast('[DEV] ต้องอยู่ในเกม', 'error');
    const x = parseFloat(document.getElementById('dev-tp-x')?.value);
    const y = parseFloat(document.getElementById('dev-tp-y')?.value);
    if (isNaN(x) || isNaN(y)) return _cheatHint('❌ กรอกค่า X / Y');
    const W = (typeof CONFIG !== 'undefined') ? CONFIG.WORLD : 6000;
    p.x = Math.max(0, Math.min(W, x));
    p.y = Math.max(0, Math.min(W, y));
    p.trail = [];
    _cheatHint(`✓ เทเลพอร์ตไป (${Math.round(p.x)}, ${Math.round(p.y)})`);
    window.showToast(`[DEV] เทเลพอร์ต ✓`, 'success');
  }

  function teleportCenter() {
    const p = window._player;
    if (!p) return window.showToast('[DEV] ต้องอยู่ในเกม', 'error');
    const W = (typeof CONFIG !== 'undefined') ? CONFIG.WORLD : 6000;
    p.x = W / 2; p.y = W / 2;
    p.trail = [];
    _cheatHint('✓ เทเลพอร์ตไปกลางแมพ');
    window.showToast('[DEV] เทเลพอร์ตกลางแมพ ✓', 'success');
    if (_tab === 'cheat') _renderBody();
  }

  function setHp() {
    const p = window._player;
    if (!p) return window.showToast('[DEV] ต้องอยู่ในเกม', 'error');
    const val = parseFloat(document.getElementById('dev-set-hp')?.value);
    if (isNaN(val) || val <= 0) return _cheatHint('❌ กรอกค่า HP > 0');
    p.maxHp = val;
    p.hp    = val;
    if (!p.alive) { p.alive = true; }
    // [DEV] sync ไป server — มีผลกับ PvP จริง (server เป็น source of truth)
    if (typeof Network !== 'undefined' && Network.sendDevStats) {
      Network.sendDevStats({ maxHp: val });
    }
    _cheatHint(`✓ ตั้ง HP = ${val} (sync server แล้ว)`);
    window.showToast(`[DEV] SET HP = ${val} ✓`, 'success');
  }

  function setSpeed() {
    const p = window._player;
    if (!p) return window.showToast('[DEV] ต้องอยู่ในเกม', 'error');
    const val = parseFloat(document.getElementById('dev-set-speed')?.value);
    if (isNaN(val) || val < 0) return _cheatHint('❌ กรอกค่า Speed >= 0');
    p.baseSpeed = val;
    p.speed     = val;
    // [DEV] sync speed multiplier ไป server (เทียบกับ CONFIG.PLAYER_SPEED ปกติ)
    // server ใช้ค่านี้คำนวณ anti-teleport — ถ้าไม่ sync จะเดินเร็วแล้วโดน server บล็อกตำแหน่ง
    const baseRef = (typeof CONFIG !== 'undefined' && CONFIG.PLAYER_SPEED) ? CONFIG.PLAYER_SPEED : 2;
    const speedMult = baseRef > 0 ? (val / baseRef) : 1;
    if (typeof Network !== 'undefined' && Network.sendDevStats) {
      Network.sendDevStats({ speedMult });
    }
    _cheatHint(`✓ ตั้ง Speed = ${val} (sync server แล้ว)`);
    window.showToast(`[DEV] SET SPEED = ${val} ✓`, 'success');
  }

  function setRegen() {
    const p = window._player;
    if (!p) return window.showToast('[DEV] ต้องอยู่ในเกม', 'error');
    const val = parseFloat(document.getElementById('dev-set-regen')?.value);
    if (isNaN(val) || val < 0) return _cheatHint('❌ กรอกค่า Regen >= 0');
    p.regenPerSec = val;
    // [DEV] sync ไป server — server มี regen tick ของตัวเองที่เขียนทับ client
    if (typeof Network !== 'undefined' && Network.sendDevStats) {
      Network.sendDevStats({ regenPerSec: val });
    }
    _cheatHint(`✓ ตั้ง Regen = ${val} HP/วินาที (sync server แล้ว)`);
    window.showToast(`[DEV] SET REGEN = ${val}/s ✓`, 'success');
  }



  function open() {
    if (!_active) return;
    _panelOpen = true;
    _ensureOverlay();
    _renderBody();
    const ov = document.getElementById('dev-overlay');
    if (!ov) return;
    ov.style.display = 'flex';
    requestAnimationFrame(() => ov.classList.add('visible'));
    const btn = document.getElementById('btn-dev');
    if (btn) btn.classList.add('active');
  }

  function close() {
    _panelOpen = false;
    const ov = document.getElementById('dev-overlay');
    if (!ov) return;
    ov.classList.remove('visible');
    setTimeout(() => { ov.style.display = 'none'; }, 200);
    const btn = document.getElementById('btn-dev');
    if (btn) btn.classList.remove('active');
  }

  function toggle() { _panelOpen ? close() : open(); }

  // ── API ───────────────────────────────────────────────────
  function isActive() { return _active; }
  function onReady(fn) { if (_ready) fn(); else _onReadyCallbacks.push(fn); }

  function init(uid, firestoreHelpers) {
    _active = false; _ready = false;
    const { getDoc, doc, db } = firestoreHelpers;
    _load(getDoc, doc(db, 'users', uid, 'dev', 'status'));
  }

  function reset() {
    _active = false; _ready = false; _panelOpen = false;
    window._devGod = window._devLockHead = window._devInvisible = false;
    const btn = document.getElementById('btn-dev');
    if (btn) btn.remove();
    const ov = document.getElementById('dev-overlay');
    if (ov) ov.remove();
  }

  return {
    init, reset, isActive, onReady, toggle, open, close,
    giveItem, giveMoney, spawnZombie, spawnBoss,
    toggleGod, toggleLockHead, toggleInvisible,
    teleport, teleportCenter, setHp, setSpeed, setRegen
  };
})();

window.Dev = Dev;
