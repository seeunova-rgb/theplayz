// ===== MUSIC.JS =====
// ระบบ Music Player — ใช้ <audio> HTML5 รองรับ mp3/ogg/wav
// playlist ตั้งค่าได้, save state ลง localStorage
// UI: Settings panel (Lobby) + Mini-player (In-game)

const MusicPlayer = (() => {

  const STORAGE_KEY = 'theplayz_music';

  // ── Playlist — เพิ่ม/ลบเพลงได้ตรงนี้ ─────────────────────
  // รองรับชื่อไฟล์ภาษาไทยได้เลย เช่น 'assets/music/รัก.mp3'
  const PLAYLIST = [
    { id: 'track1', title: 'ย้าย่ายะ',    file: 'assets/music/ย้าย่ายะ.mp3' },
    { id: 'track2', title: 'เสพติดความเหงา',  file: 'assets/music/เสพติดความเหงา.mp3' },
    { id: 'track3', title: 'Best Part', file: 'assets/music/BestPart.mp3' },
    { id: 'track4', title: 'Comethru', file: 'assets/music/comethru.mp3' },
    { id: 'track5', title: 'Death Bed', file: 'assets/music/deathbed.mp3' },
    { id: 'track6', title: 'I Love You 3000', file: 'assets/music/ILoveYou3000.mp3' },
    { id: 'track7', title: 'Lonely', file: 'assets/music/Lonely.mp3' },
  ];

  // ── State ─────────────────────────────────────────────────
  let _state = {
    index:   0,
    playing: false,
    volume:  0.5,
    loop:    false,
    shuffle: false,
  };

  // ── Audio element ─────────────────────────────────────────
  const _audio = new Audio();
  _audio.preload = 'auto';

  // ── Load / Save state ─────────────────────────────────────
  function _loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) Object.assign(_state, JSON.parse(raw));
    } catch {}
    _state.playing = false; // ไม่ autoplay ทันทีที่โหลด
    _audio.volume = _state.volume;
  }

  function _saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_state)); } catch {}
  }

  // ── encode path รองรับชื่อไฟล์ภาษาไทยและอักขระพิเศษ ──────
  function _encodeFilePath(filePath) {
    return filePath.split('/').map(seg => encodeURIComponent(seg)).join('/');
  }

  // ── Core ──────────────────────────────────────────────────
  function _loadTrack(index) {
    if (!PLAYLIST.length) return;
    _state.index = ((index % PLAYLIST.length) + PLAYLIST.length) % PLAYLIST.length;
    _audio.src = _encodeFilePath(PLAYLIST[_state.index].file);
    _audio.load();
    _saveState();
    _updateAllUI();
  }

  function play() {
    if (!PLAYLIST.length) return;
    if (!_audio.src || _audio.src === window.location.href) _loadTrack(_state.index);
    _audio.play().catch(() => {});
    _state.playing = true;
    _saveState();
    _updateAllUI();
  }

  function pause() {
    _audio.pause();
    _state.playing = false;
    _saveState();
    _updateAllUI();
  }

  function toggle() {
    _state.playing ? pause() : play();
  }

  function next() {
    const idx = _state.shuffle
      ? Math.floor(Math.random() * PLAYLIST.length)
      : _state.index + 1;
    _loadTrack(idx);
    if (_state.playing) play();
  }

  function prev() {
    // ถ้าเล่นผ่านไปเกิน 3 วิ → รีสตาร์ทเพลงเดิม
    if (_audio.currentTime > 3) {
      _audio.currentTime = 0;
      return;
    }
    _loadTrack(_state.index - 1);
    if (_state.playing) play();
  }

  function setVolume(v) {
    _state.volume = Math.max(0, Math.min(1, v));
    _audio.volume = _state.volume;
    _saveState();
    _updateVolumeUI();
  }

  function toggleLoop() {
    _state.loop = !_state.loop;
    _audio.loop = _state.loop;
    _saveState();
    _updateAllUI();
  }

  function toggleShuffle() {
    _state.shuffle = !_state.shuffle;
    _saveState();
    _updateAllUI();
  }

  function selectTrack(index) {
    _loadTrack(index);
    play();
  }

  // ── Auto-next ─────────────────────────────────────────────
  _audio.addEventListener('ended', () => {
    if (!_state.loop) next();
  });

  // ── Progress ──────────────────────────────────────────────
  function _getProgress() {
    if (!_audio.duration || isNaN(_audio.duration)) return 0;
    return _audio.currentTime / _audio.duration;
  }

  function _formatTime(sec) {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ── UI Updates ────────────────────────────────────────────
  function _updateAllUI() {
    _updateSettingsUI();
    _updateMiniUI();
  }

  function _updateSettingsUI() {
    const wrap = document.getElementById('music-settings-player');
    if (!wrap) return;

    const track = PLAYLIST[_state.index] || null;
    const titleEl = wrap.querySelector('.mp-title');
    if (titleEl) titleEl.textContent = track ? track.title : 'ไม่มีเพลง';

    const playBtn = wrap.querySelector('.mp-play-btn');
    if (playBtn) playBtn.textContent = _state.playing ? '⏸' : '▶';

    const loopBtn = wrap.querySelector('.mp-loop-btn');
    if (loopBtn) loopBtn.classList.toggle('mp-active', _state.loop);

    const shuffleBtn = wrap.querySelector('.mp-shuffle-btn');
    if (shuffleBtn) shuffleBtn.classList.toggle('mp-active', _state.shuffle);

    // playlist rows
    const rows = wrap.querySelectorAll('.mp-playlist-row');
    rows.forEach((row, i) => {
      row.classList.toggle('mp-row-active', i === _state.index);
    });

    _updateVolumeUI();
  }

  function _updateMiniUI() {
    const mini = document.getElementById('music-mini-player');
    if (!mini) return;
    const track = PLAYLIST[_state.index] || null;

    const titleEl = mini.querySelector('.mp-mini-title');
    if (titleEl) titleEl.textContent = track ? track.title : '—';

    const playBtn = mini.querySelector('.mp-mini-play');
    if (playBtn) playBtn.textContent = _state.playing ? '⏸' : '▶';
  }

  function _updateVolumeUI() {
    // settings slider
    const slider = document.getElementById('mp-volume-slider');
    if (slider) slider.value = _state.volume;

    // mini volume
    const miniSlider = document.getElementById('mp-mini-volume');
    if (miniSlider) miniSlider.value = _state.volume;
  }

  // progress bar tick
  setInterval(() => {
    const bar = document.getElementById('mp-progress-bar');
    if (bar) {
      bar.style.width = (_getProgress() * 100) + '%';
    }
    const timeEl = document.getElementById('mp-time');
    if (timeEl) {
      timeEl.textContent = `${_formatTime(_audio.currentTime)} / ${_formatTime(_audio.duration)}`;
    }
    const miniBar = document.getElementById('mp-mini-progress-bar');
    if (miniBar) miniBar.style.width = (_getProgress() * 100) + '%';
  }, 500);

  // ── Render Settings UI ────────────────────────────────────
  function renderSettings() {
    const container = document.getElementById('music-settings-player');
    if (!container) return;

    container.innerHTML = `
      <div class="mp-track-info">
        <div class="mp-title">${PLAYLIST[_state.index]?.title || 'ไม่มีเพลง'}</div>
        <div class="mp-time" id="mp-time">0:00 / 0:00</div>
      </div>
      <div class="mp-progress-wrap">
        <div class="mp-progress-track">
          <div class="mp-progress-bar" id="mp-progress-bar"></div>
        </div>
      </div>
      <div class="mp-controls">
        <button class="mp-ctrl-btn mp-shuffle-btn ${_state.shuffle ? 'mp-active' : ''}">⇄</button>
        <button class="mp-ctrl-btn mp-prev-btn">⏮</button>
        <button class="mp-ctrl-btn mp-play-btn mp-play-main">${_state.playing ? '⏸' : '▶'}</button>
        <button class="mp-ctrl-btn mp-next-btn">⏭</button>
        <button class="mp-ctrl-btn mp-loop-btn ${_state.loop ? 'mp-active' : ''}">↻</button>
      </div>
      <div class="mp-volume-row">
        <span class="mp-vol-icon">🔊</span>
        <input type="range" id="mp-volume-slider" class="mp-volume-slider"
               min="0" max="1" step="0.01" value="${_state.volume}">
      </div>
      <div class="mp-playlist">
        ${PLAYLIST.map((t, i) => `
          <div class="mp-playlist-row ${i === _state.index ? 'mp-row-active' : ''}" data-idx="${i}">
            <span class="mp-row-num">${i + 1}</span>
            <span class="mp-row-title">${t.title}</span>
            ${i === _state.index && _state.playing ? '<span class="mp-row-playing">♫</span>' : ''}
          </div>
        `).join('')}
      </div>
    `;

    // ผูก events
    container.querySelector('.mp-play-btn').onclick    = toggle;
    container.querySelector('.mp-prev-btn').onclick    = prev;
    container.querySelector('.mp-next-btn').onclick    = next;
    container.querySelector('.mp-loop-btn').onclick    = toggleLoop;
    container.querySelector('.mp-shuffle-btn').onclick = toggleShuffle;

    container.querySelector('#mp-volume-slider').oninput = e => setVolume(+e.target.value);

    // progress seek
    container.querySelector('.mp-progress-track').onclick = e => {
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      if (_audio.duration) _audio.currentTime = ratio * _audio.duration;
    };

    // playlist click
    container.querySelectorAll('.mp-playlist-row').forEach(row => {
      row.onclick = () => selectTrack(+row.dataset.idx);
    });
  }

  // ── Render Mini-player (In-game) ──────────────────────────
  function renderMini() {
    const mini = document.getElementById('music-mini-player');
    if (!mini) return;

    mini.innerHTML = `
      <div class="mp-mini-progress-track">
        <div class="mp-mini-progress-bar" id="mp-mini-progress-bar"></div>
      </div>
      <button class="mp-mini-btn mp-mini-prev">⏮</button>
      <button class="mp-mini-btn mp-mini-play">${_state.playing ? '⏸' : '▶'}</button>
      <button class="mp-mini-btn mp-mini-next">⏭</button>
      <span class="mp-mini-title">${PLAYLIST[_state.index]?.title || '—'}</span>
      <input type="range" id="mp-mini-volume" class="mp-mini-vol"
             min="0" max="1" step="0.05" value="${_state.volume}">
    `;

    mini.querySelector('.mp-mini-play').onclick = toggle;
    mini.querySelector('.mp-mini-prev').onclick = prev;
    mini.querySelector('.mp-mini-next').onclick = next;
    mini.querySelector('#mp-mini-volume').oninput = e => setVolume(+e.target.value);
  }

  _loadState();
  _audio.loop   = _state.loop;
  _audio.volume = _state.volume;

  // โหลด track ปัจจุบันทันที (ไม่เล่น)
  if (PLAYLIST.length) {
    _audio.src = PLAYLIST[_state.index].file;
  }

  return {
    play, pause, toggle, next, prev,
    setVolume, toggleLoop, toggleShuffle, selectTrack,
    renderSettings, renderMini,
    get isPlaying() { return _state.playing; },
    get currentTrack() { return PLAYLIST[_state.index] || null; },
    PLAYLIST,
  };
})();

window.MusicPlayer = MusicPlayer;
