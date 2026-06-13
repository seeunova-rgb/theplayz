// ===== LOBBY.JS =====
// nav switching, play button, back-to-lobby countdown
// depends on: shop.js, inventory.js (ต้องโหลดก่อน)

// ── toast ─────────────────────────────────────────────────

window.showToast = function(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show ' + type;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = ''; }, 2500);
};

// ── screen ────────────────────────────────────────────────

window.showScreen = function(name) {
  document.getElementById('auth-screen').style.display = name === 'auth'  ? 'flex' : 'none';
  document.getElementById('lobby').style.display       = name === 'lobby' ? 'flex' : 'none';
};

// Loading screen สำหรับ logout (LOBBY → AUTH)
window.showScreenWithLoading = async function(name, from, to, duration) {
  const done = await Loading.show(from, to, duration || 1200);
  window.showScreen(name);
  await done();
};

// ── nav panels ────────────────────────────────────────────

const panels = { play: 'panel-play', shop: 'panel-shop', inventory: 'panel-inventory', character: 'panel-character', gacha: 'panel-gacha', ranking: 'panel-ranking', clan: 'panel-clan', promotion: 'panel-promotion', settings: 'panel-settings' };
const navBtns = {
  play:      document.getElementById('nav-play'),
  shop:      document.getElementById('nav-shop'),
  inventory: document.getElementById('nav-inventory'),
  character: document.getElementById('nav-character'),
  gacha:     document.getElementById('nav-gacha'),
  ranking:   document.getElementById('nav-ranking'),
  clan:      document.getElementById('nav-clan'),
  promotion: document.getElementById('nav-promotion'),
  settings:  document.getElementById('nav-settings'),
};

function switchPanel(name) {
  Object.keys(panels).forEach(k => {
    document.getElementById(panels[k]).classList.toggle('active', k === name);
    if (navBtns[k]) navBtns[k].classList.toggle('play-nav', k === name);
  });
  if (name === 'play')      WorldSelect.render();
  if (name === 'shop')      Shop.render();
  if (name === 'inventory') Inventory.render();
  if (name === 'character') Character.render();
  if (name === 'gacha')     Gacha.render();
}

navBtns.play.addEventListener('click',      () => switchPanel('play'));
navBtns.shop.addEventListener('click',      () => switchPanel('shop'));
navBtns.inventory.addEventListener('click', () => switchPanel('inventory'));
navBtns.character.addEventListener('click', () => switchPanel('character'));
navBtns.gacha.addEventListener('click',     () => switchPanel('gacha'));
navBtns.ranking.addEventListener('click',   () => { switchPanel('ranking'); Ranking.render(); });
navBtns.clan.addEventListener('click',      () => { switchPanel('clan'); Clan.render(); });
navBtns.promotion.addEventListener('click', () => switchPanel('promotion'));
navBtns.settings.addEventListener('click',  () => { switchPanel('settings'); KeyBindUI.render(); if (typeof MusicPlayer !== 'undefined') MusicPlayer.renderSettings(); });

// ── HUD Layout edit buttons ─────────────────────────────────
const HUD_PREVIEW_IDS = [
  'joystick-zone', 'sprint-btn', 'pickup-btn',
  'attack-zone', 'reload-btn', 'bandage-btn',
  'btn-ingame-bp', 'btn-ingame-shop', 'safe-vault-btn',
];

document.getElementById('hud-layout-edit-btn').addEventListener('click', () => {
  const inGame = !!window._isInGame;
  const shownByPreview = [];

  // ถ้าไม่ได้อยู่ในเกม ให้แสดง HUD แบบ preview ทับหน้า lobby
  if (!inGame) {
    HUD_PREVIEW_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.style.display === 'none' || el.style.display === '') {
        el.style.display = (id === 'joystick-zone' || id === 'attack-zone') ? '' : 'flex';
        shownByPreview.push(id);
      }
    });
    document.getElementById('lobby').classList.add('hud-preview-active');
  }

  window._onHudEditClose = () => {
    shownByPreview.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    document.getElementById('lobby').classList.remove('hud-preview-active');
    window._onHudEditClose = null;
  };

  HUDLayoutEditor.open();
});

document.getElementById('hud-layout-reset-btn').addEventListener('click', () => {
  HUDLayout.resetAll();
  showToast('รีเซ็ตตำแหน่งปุ่มทั้งหมดแล้ว', 'success');
});

// render world select ทันทีที่ lobby โหลด (panel-play เป็น default active)
WorldSelect.render();

// init in-game shop (เฉพาะ structure, ไม่ต้องรอ premium check ตรงนี้)
if (typeof InGameShop !== 'undefined') InGameShop.init();

// ── play button ───────────────────────────────────────────

// ── world join callback (เรียกจาก WorldSelect เมื่อกด JOIN) ──

window._wsJoinCallback = async function(worldId) {
  const done = await Loading.show('LOBBY', worldId.toUpperCase(), 2000);

  const lobby = document.getElementById('lobby');
  lobby.style.display = 'none';
  document.getElementById('gameCanvas').style.display       = 'block';
  document.getElementById('joystick-zone').style.display    = '';
  document.getElementById('attack-zone').style.display      = '';
  document.getElementById('sprint-btn').style.display       = '';
  document.getElementById('btn-back-lobby').style.display   = 'flex';
  document.getElementById('btn-ingame-bp').style.display      = 'flex';
  // แสดงปุ่ม Shop ในเกมเฉพาะ Premium
  if (typeof Premium !== 'undefined' && Premium.isActive()) {
    document.getElementById('btn-ingame-shop').style.display = 'flex';
  }
  document.getElementById('reputation-hud').style.display      = 'flex';
  // แสดง Music Mini-player ในเกม
  const _miniPlayer = document.getElementById('music-mini-player');
  if (_miniPlayer) {
    if (typeof MusicPlayer !== 'undefined') MusicPlayer.renderMini();
    _miniPlayer.style.display = 'flex';
  }
  loadGameScripts();

  await done();
};

// ── back to lobby countdown ───────────────────────────────

const BACK_SECS = 5;
let backTimer     = null;
let backRemaining = 0;

// [FIX] flag บอก game.js ว่ากำลัง transition กลับ lobby
// ป้องกัน _onPlayerSelfDeath สร้าง death screen ระหว่าง countdown
window._isLeavingGame = false;

function startBackCountdown() {
  // แค่เปิด overlay — ยังไม่นับ รอผู้เล่นกดยืนยันก่อน
  if (backTimer) return;
  const overlay    = document.getElementById('back-overlay');
  const numEl      = document.getElementById('countdown-num');
  const ringFg     = document.getElementById('ring-fg');
  const confirmBtn = document.getElementById('btn-cancel-back');
  const circumf    = 220; // 2π×35

  window._isLeavingGame = true;

  // [FIX] ถ้า player ตายอยู่ตอนกด back → drop ของก่อนเลย แล้วซ่อน death screen
  const _p = window._player;
  if (_p && !_p.alive) {
    if (typeof window._dropPlayerItems === 'function') window._dropPlayerItems();
    const deathEl = document.getElementById('death-overlay');
    if (deathEl) deathEl.remove();
  }

  backRemaining = BACK_SECS;
  overlay.classList.add('active');
  if (confirmBtn) {
    confirmBtn.classList.remove('locked');
    confirmBtn.classList.remove('counting');
  }
  numEl.textContent = backRemaining;

  // ring รอ — เต็มวง ยังไม่วิ่ง
  ringFg.style.transition = 'none';
  ringFg.style.strokeDashoffset = '0';
}

function cancelBackCountdown() {
  // กดยืนยัน → เริ่ม countdown จริง → ล็อกปุ่ม
  if (backTimer) return;
  const numEl      = document.getElementById('countdown-num');
  const ringFg     = document.getElementById('ring-fg');
  const confirmBtn = document.getElementById('btn-cancel-back');
  const overlay    = document.getElementById('back-overlay');
  const circumf    = 220; // 2π×35

  if (confirmBtn) {
    confirmBtn.classList.add('locked');
    confirmBtn.classList.add('counting');
  }
  overlay.classList.add('confirmed'); // ซ่อนปุ่ม X

  // reset ring → reflow → animate ถอยหลัง
  ringFg.style.transition = 'none';
  ringFg.style.strokeDashoffset = '0';
  void ringFg.getBoundingClientRect();
  ringFg.style.transition = `stroke-dashoffset ${BACK_SECS}s linear`;
  ringFg.style.strokeDashoffset = String(circumf);

  backTimer = setInterval(() => {
    backRemaining--;
    numEl.textContent = backRemaining;
    if (backRemaining <= 0) {
      clearInterval(backTimer);
      backTimer = null;
      goBackToLobby();
    }
  }, 1000);
}

async function goBackToLobby() {
  // ── Loading: GAME → LOBBY ────────────────────────────
  const _bo = document.getElementById('back-overlay'); _bo.classList.remove('active'); _bo.classList.remove('confirmed');

  // [FIX] ลบ death overlay ที่อาจค้างอยู่ก่อน transition
  const deathEl = document.getElementById('death-overlay');
  if (deathEl) deathEl.remove();

  const done = await Loading.show('GAME', 'LOBBY', 1600);

  // [FIX] หยุด game loop ก่อนกลับ lobby — ป้องกัน loop ค้างรันหลังออกจากเกม
  if (typeof window._stopGameLoop === 'function') window._stopGameLoop();

  // [FIX] drop ของทุกกรณี (ทั้ง alive และ dead) ก่อน disconnect เสมอ
  // รอ drop_ack จาก server ก่อน disconnect เพื่อกัน race condition
  // [FIX] drop ของเฉพาะตอน player ตายเท่านั้น — ถ้ายังมีชีวิตให้กลับ lobby โดยไม่ drop
  console.log('[LOBBY] checking if player is dead before drop');
  const _playerAlive = window._player ? window._player.alive : true;
  await new Promise(res => {
    if (_playerAlive) {
      console.log('[LOBBY] player is alive — skip drop, keep items');
      res();
      return;
    }
    const hasDrop = typeof window._dropPlayerItems === 'function'
      && window._dropPlayerItems();  // returns true ถ้ามีของ drop จริง

    if (!hasDrop || typeof Network === 'undefined') {
      res();
      return;
    }
    // รอ drop_ack จาก server (timeout 1500ms กัน hang)
    const timeout = setTimeout(res, 1500);
    Network.once('drop_ack', () => { clearTimeout(timeout); res(); });
  });

  console.log('[LOBBY] disconnecting socket');
  if (typeof Network !== 'undefined') Network.disconnect();

  document.getElementById('gameCanvas').style.display       = 'none';
  document.getElementById('joystick-zone').style.display    = 'none';
  document.getElementById('attack-zone').style.display      = 'none';
  document.getElementById('sprint-btn').style.display       = 'none';
  document.getElementById('btn-back-lobby').style.display   = 'none';
  document.getElementById('btn-ingame-bp').style.display      = 'none';
  document.getElementById('btn-ingame-shop').style.display    = 'none';
  document.getElementById('ingame-bp-overlay').style.display  = 'none';
  document.getElementById('ingame-shop-overlay').style.display = 'none';
  document.getElementById('gun-icon-hud').style.display        = 'none';
  document.getElementById('hp-hud').style.display             = 'none';
  document.getElementById('reputation-hud').style.display      = 'none';
  document.getElementById('music-mini-player').style.display   = 'none';
  document.getElementById('lobby').style.display            = 'flex';

  window._isLeavingGame = false;  // [FIX] reset flag หลังกลับถึง lobby
  await done();
}

document.getElementById('btn-back-lobby').addEventListener('click', startBackCountdown);
document.getElementById('btn-cancel-back').addEventListener('click', cancelBackCountdown);
document.getElementById('btn-close-back').addEventListener('click', () => {
  // ยกเลิก — ใช้ได้เฉพาะก่อนกดยืนยัน
  if (backTimer) return; // กด confirm แล้ว ยกเลิกไม่ได้
  window._isLeavingGame = false;
  const _bo = document.getElementById('back-overlay'); _bo.classList.remove('active'); _bo.classList.remove('confirmed');
  document.getElementById('back-overlay').classList.remove('confirmed');
});

// expose ให้ game.js เรียกตอนกด "กลับล็อบบี้" จาก death screen
window._goBackToLobby = goBackToLobby;

// ── load game scripts (โหลดแค่ครั้งเดียว) ────────────────

let _gameScriptsLoaded = false;

function loadGameScripts() {
  if (_gameScriptsLoaded) {
    // [FIX] reset state และ restart loop — _stopGameLoop หยุดไปแล้วตอนกลับ lobby
    initGame();
    if (typeof window._startGameLoop === 'function') window._startGameLoop();
    return;
  }
  const _v = (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.port === '1106')
    ? Date.now() : '1';
  [
    'js/config.js',
    'js/config_world.js',
    'js/utils.js',
    'js/world_safezone.js',
    'js/world_airport.js',
    'js/world_snow.js',
    'js/world.js',
    'js/spawn.js',
    'js/model_character.js',
    'js/input.js',
    'js/config_weapon.js',  // โหลดใน index.html แล้วด้วย — browser จะ cache ไว้
    'js/model_weapon.js',
    'js/player.js',
    'js/weapon.js',
    'js/config_entity.js',
    'js/entity.js',
    'js/game.js',
  ]
    .reduce((p, src) => p.then(() => new Promise(res => {
      const s = document.createElement('script');
      s.src = src + '?v=' + _v;
      s.onload = res;
      document.body.appendChild(s);
    })), Promise.resolve())
    .then(() => {
      _gameScriptsLoaded = true;
      // game.js รัน initGame() + RAF อัตโนมัติตอนโหลด และตั้ง window._isInGame = true แล้ว
      // ไม่ต้องทำอะไรเพิ่มสำหรับครั้งแรก
    });
}

// ── KeyBind UI ────────────────────────────────────────────
// แสดงและจัดการ UI ตั้งค่าปุ่มใน panel-settings

const KeyBindUI = (() => {
  const ACTIONS = ['sprint', 'heal', 'pickup', 'reload', 'shoot'];
  let _listeningFor = null; // action ที่กำลังรอรับ key ใหม่

  function render() {
    const card = document.getElementById('keybind-card');
    if (!card || typeof KeyBinds === 'undefined') return;

    card.innerHTML = '';

    ACTIONS.forEach((action, i) => {
      const isFixed = KeyBinds.FIXED.has(action);
      const keyStr  = KeyBinds.get(action);

      const row = document.createElement('div');
      row.className = 'settings-row';
      row.dataset.action = action;

      row.innerHTML = `
        <span class="settings-label">${KeyBinds.LABELS[action]}</span>
        <button class="keybind-key-btn ${isFixed ? 'keybind-fixed' : ''}" data-action="${action}">
          ${isFixed ? '<span class="keybind-fixed-tag">อัตโนมัติ</span>' : KeyBinds.formatKey(keyStr)}
        </button>
      `;

      card.appendChild(row);

      if (i < ACTIONS.length - 1) {
        const div = document.createElement('div');
        div.className = 'settings-divider';
        card.appendChild(div);
      }
    });

    // ผูกปุ่ม reset
    const resetBtn = document.getElementById('keybind-reset-btn');
    if (resetBtn) {
      resetBtn.onclick = () => {
        KeyBinds.resetAll();
        _listeningFor = null;
        render();
        showToast('รีเซ็ตปุ่มเรียบร้อย', 'success');
      };
    }

    // ผูก click ปุ่ม keybind
    card.querySelectorAll('.keybind-key-btn:not(.keybind-fixed)').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (_listeningFor === action) {
          // กดซ้ำ = ยกเลิก
          _listeningFor = null;
          render();
          return;
        }
        _listeningFor = action;
        // แสดงสถานะ "รอรับปุ่ม"
        card.querySelectorAll('.keybind-key-btn').forEach(b => b.classList.remove('keybind-listening'));
        btn.classList.add('keybind-listening');
        btn.textContent = '— กดปุ่มที่ต้องการ —';
      });
    });
  }

  // รับ keydown ขณะรอ remap
  window.addEventListener('keydown', e => {
    if (!_listeningFor) return;
    if (e.key === 'Escape') {
      _listeningFor = null;
      render();
      return;
    }
    // ป้องกันบาง key พิเศษ
    const blocked = ['tab', 'enter', 'backspace', 'delete', 'f5', 'f11', 'f12'];
    if (blocked.includes(e.key.toLowerCase())) return;

    e.preventDefault();
    const ok = KeyBinds.set(_listeningFor, e.key);
    if (ok) {
      showToast(`ตั้ง "${KeyBinds.LABELS[_listeningFor]}" → ${KeyBinds.formatKey(e.key)}`, 'success');
    } else {
      showToast('ปุ่มนี้ถูกใช้งานอยู่แล้ว', 'error');
    }
    _listeningFor = null;
    render();
  });

  return { render };
})();
