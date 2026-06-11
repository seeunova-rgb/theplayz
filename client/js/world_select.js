// ===== WORLD_SELECT.JS =====
// UI เลือกโลกใน panel-play
// depends: config_world.js

const WorldSelect = (() => {
  let _selected = null;   // world id ที่เลือกอยู่
  let _onlineCounts = {}; // { worldId: count } — อัปเดตจาก server

  // ── render ─────────────────────────────────────────────
  function render() {
    const panel = document.getElementById('panel-play');
    panel.innerHTML = `
      <div class="glow"></div>
      <div class="corner corner-tl"></div>
      <div class="corner corner-tr"></div>
      <div class="corner corner-bl"></div>
      <div class="corner corner-br"></div>
      <div class="world-select-wrap">
        <div class="ws-title">— เลือกโลกที่ต้องการเข้า —</div>
        <div class="ws-grid" id="ws-grid"></div>
        <div class="ws-join-wrap">
          <button class="btn-ws-join" id="btn-ws-join" disabled>JOIN</button>
        </div>
        <div class="ws-status">
          <div class="dot"></div>
          <span>SERVERS ONLINE</span>
        </div>
      </div>
    `;

    const grid = document.getElementById('ws-grid');
    WORLDS.forEach(w => {
      const card = document.createElement('div');
      card.className = 'ws-card';
      card.dataset.id = w.id;

      const online = _onlineCounts[w.id] || 0;
      card.innerHTML = `
        <div class="ws-tag">${w.tag}</div>
        <div class="ws-name-row">
          <span class="ws-icon">${w.icon}</span>
          <span class="ws-name">${w.name}</span>
        </div>
        <div class="ws-desc">${w.desc}</div>
        <div class="ws-online">
          <div class="ws-online-dot"></div>
          <span class="ws-online-text" id="ws-online-${w.id}">${online} ผู้เล่นออนไลน์</span>
        </div>
      `;

      card.addEventListener('click', () => selectWorld(w.id));
      grid.appendChild(card);
    });

    // restore selection ถ้ามี
    if (_selected) _highlight(_selected);

    document.getElementById('btn-ws-join').addEventListener('click', () => {
      if (_selected) _joinWorld(_selected);
    });
  }

  // ── select card ────────────────────────────────────────
  function selectWorld(id) {
    _selected = id;
    _highlight(id);
    const btn = document.getElementById('btn-ws-join');
    if (btn) btn.disabled = false;
  }

  function _highlight(id) {
    document.querySelectorAll('.ws-card').forEach(c => {
      c.classList.toggle('selected', c.dataset.id === id);
    });
  }

  // ── join ───────────────────────────────────────────────
  function _joinWorld(worldId) {
    // เก็บ world ที่เลือกไว้ให้ game.js / network.js ใช้
    window._selectedWorldId = worldId;

    // delegate ไป lobby.js (ใช้ Loading + loadGameScripts เดิม)
    if (typeof window._wsJoinCallback === 'function') {
      window._wsJoinCallback(worldId);
    }
  }

  // ── อัปเดต online count จาก server ────────────────────
  function setOnlineCount(worldId, count) {
    _onlineCounts[worldId] = count;
    const el = document.getElementById(`ws-online-${worldId}`);
    if (el) el.textContent = `${count} ผู้เล่นออนไลน์`;
  }

  // ── getSelected ────────────────────────────────────────
  function getSelected() { return _selected; }

  return { render, setOnlineCount, getSelected, selectWorld };
})();

window.WorldSelect = WorldSelect;
