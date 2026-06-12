// ===== MUSIC.JS =====
// ระบบ Music Player — ผู้เล่นใส่ YouTube URL เอง, เพิ่ม/ลบ track ได้ไม่จำกัด
// บันทึกลง localStorage อัตโนมัติ
// UI: Settings panel (Lobby) + Mini-player (In-game)

const MusicPlayer = (() => {

  const STORAGE_KEY = 'theplayz_music_v2';

  // ── Default playlist (ว่างเปล่า ผู้เล่นเพิ่มเอง) ──────────
  const DEFAULT_PLAYLIST = [];

  // ── State ──────────────────────────────────────────────────
  let _state = {
    index:    0,
    playing:  false,
    volume:   0.5,
    loop:     false,
    shuffle:  false,
    playlist: [],
  };

  // ── YouTube IFrame API ─────────────────────────────────────
  let _ytPlayer = null;
  let _ytReady  = false;
  let _ytPendingPlay = false;

  // ── Audio element (local files) ────────────────────────────
  const _audio = new Audio();
  _audio.preload = 'auto';

  // ── Persist ────────────────────────────────────────────────
  function _save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_state)); } catch {}
  }

  function _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) Object.assign(_state, JSON.parse(raw));
    } catch {}
    if (!Array.isArray(_state.playlist)) _state.playlist = [...DEFAULT_PLAYLIST];
    _state.playing = false;
    _audio.volume  = _state.volume;
  }

  const pl = () => _state.playlist;

  // ── YouTube helpers ────────────────────────────────────────
  function _ytId(url) {
    if (!url) return null;
    const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  function _isYt(track) { return !!(track && _ytId(track.url)); }

  function _ensureYtDiv() {
    if (document.getElementById('yt-player-hidden')) return;
    const d = document.createElement('div');
    d.id = 'yt-player-hidden';
    d.style.cssText = 'position:fixed;bottom:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
    document.body.appendChild(d);
  }

  function _loadYtApi() {
    if (window.YT && window.YT.Player) { _initYt(); return; }
    if (document.getElementById('yt-api-script')) return;
    const s = document.createElement('script');
    s.id  = 'yt-api-script';
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  }

  function _initYt() {
    _ensureYtDiv();
    if (_ytPlayer) { _ytReady = true; return; }
    _ytPlayer = new YT.Player('yt-player-hidden', {
      height: '1', width: '1', videoId: '',
      playerVars: { autoplay:0, controls:0, disablekb:1, fs:0, iv_load_policy:3, modestbranding:1, rel:0 },
      events: {
        onReady: () => {
          _ytReady = true;
          _ytPlayer.setVolume(_state.volume * 100);
          if (_ytPendingPlay) { _ytPendingPlay = false; _doPlayYt(); }
        },
        onStateChange: (e) => {
          if (e.data === 0) _state.loop ? _doPlayYt() : next();
        },
      },
    });
  }

  window.onYouTubeIframeAPIReady = _initYt;

  function _doPlayYt() {
    const t = pl()[_state.index];
    const vid = _ytId(t?.url);
    if (!vid) return;
    if (!_ytReady) { _ytPendingPlay = true; return; }
    _ytPlayer.setVolume(_state.volume * 100);
    const cur = _ytPlayer.getVideoData?.()?.video_id;
    cur !== vid ? _ytPlayer.loadVideoById(vid) : _ytPlayer.playVideo();
  }

  function _stopYt()  { try { _ytPlayer?.stopVideo();  } catch {} }
  function _pauseYt() { try { _ytPlayer?.pauseVideo(); } catch {} }

  // ── Core playback ──────────────────────────────────────────
  function _enabledList() {
    return pl().map((t, i) => ({ t, i })).filter(({ t }) => t.enabled !== false);
  }

  function _loadTrack(idx) {
    if (!pl().length) return;
    const enabled = _enabledList();
    if (!enabled.length) return;
    let norm = ((idx % pl().length) + pl().length) % pl().length;
    if (pl()[norm]?.enabled === false) {
      const found = enabled.find(({ i }) => i >= norm) || enabled[0];
      norm = found.i;
    }
    _state.index = norm;
    const t = pl()[_state.index];
    _stopYt();
    _audio.pause();
    if (!_isYt(t) && t.url) {
      _audio.src = t.url;
      _audio.load();
    }
    _save();
    _renderAll();
  }

  function play() {
    if (!pl().length) return;
    const t = pl()[_state.index];
    if (!t) return;
    if (_isYt(t)) {
      _audio.pause();
      _loadYtApi();
      _doPlayYt();
    } else if (t.url) {
      _stopYt();
      if (!_audio.src || _audio.src === window.location.href) {
        _audio.src = t.url; _audio.load();
      }
      _audio.play().catch(() => {});
    }
    _state.playing = true;
    _save(); _renderAll();
  }

  function pause() {
    _audio.pause(); _pauseYt();
    _state.playing = false;
    _save(); _renderAll();
  }

  function toggle() { _state.playing ? pause() : play(); }

  function next() {
    const enabled = _enabledList();
    if (!enabled.length) return;
    if (_state.shuffle) {
      const pick = enabled[Math.floor(Math.random() * enabled.length)];
      _loadTrack(pick.i);
    } else {
      const found = enabled.find(({ i }) => i > _state.index) || enabled[0];
      _loadTrack(found.i);
    }
    if (_state.playing) play();
  }

  function prev() {
    if (_audio.currentTime > 3) { _audio.currentTime = 0; return; }
    const enabled = _enabledList();
    if (!enabled.length) return;
    const before = enabled.filter(({ i }) => i < _state.index);
    const found  = before.length ? before[before.length - 1] : enabled[enabled.length - 1];
    _loadTrack(found.i);
    if (_state.playing) play();
  }

  function toggleEnabled(i) {
    if (!pl()[i]) return;
    pl()[i].enabled = pl()[i].enabled === false ? true : false;
    // ถ้า track ที่กำลังเล่นอยู่ถูก off ให้ข้ามไปตัวถัดไป
    if (i === _state.index && pl()[i].enabled === false && _state.playing) next();
    _save();
    renderSettings();
  }

  function setVolume(v) {
    _state.volume = Math.max(0, Math.min(1, v));
    _audio.volume = _state.volume;
    if (_ytReady) _ytPlayer.setVolume(_state.volume * 100);
    _save(); _updateVolUI();
  }

  function toggleLoop()    { _state.loop    = !_state.loop;    _audio.loop = _state.loop; _save(); _renderAll(); }
  function toggleShuffle() { _state.shuffle = !_state.shuffle; _save(); _renderAll(); }
  function selectTrack(i)  { _loadTrack(i); play(); }

  _audio.addEventListener('ended', () => { if (!_state.loop) next(); });

  // ── Playlist management ────────────────────────────────────
  function addTrack() {
    const id = 'track_' + Date.now();
    pl().push({ id, title: '', url: '' });
    _save();
    renderSettings();
    // focus title input ของ track ใหม่
    setTimeout(() => {
      const rows = document.querySelectorAll('.mp-track-edit');
      const last = rows[rows.length - 1];
      last?.querySelector('.mp-inp-title')?.focus();
    }, 50);
  }

  function removeTrack(i) {
    if (pl().length <= 0) return;
    pl().splice(i, 1);
    if (_state.index >= pl().length) _state.index = Math.max(0, pl().length - 1);
    _stopYt(); _audio.pause(); _state.playing = false;
    _save();
    renderSettings();
  }

  function saveTrack(i, title, url) {
    if (!pl()[i]) return;
    pl()[i].title = title.trim() || `Track ${i + 1}`;
    pl()[i].url   = url.trim();
    _save();
    renderSettings();
  }

  // ── Progress helpers ───────────────────────────────────────
  function _progress() {
    const t = pl()[_state.index];
    if (_isYt(t) && _ytReady) {
      const d = _ytPlayer.getDuration?.() || 0;
      const c = _ytPlayer.getCurrentTime?.() || 0;
      return d ? c / d : 0;
    }
    return (!_audio.duration || isNaN(_audio.duration)) ? 0 : _audio.currentTime / _audio.duration;
  }

  function _fmt(s) {
    if (!s || isNaN(s)) return '0:00';
    return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
  }

  function _curTime() {
    const t = pl()[_state.index];
    return (_isYt(t) && _ytReady) ? (_ytPlayer.getCurrentTime?.() || 0) : _audio.currentTime;
  }
  function _dur() {
    const t = pl()[_state.index];
    return (_isYt(t) && _ytReady) ? (_ytPlayer.getDuration?.() || 0) : _audio.duration;
  }

  setInterval(() => {
    const bar = document.getElementById('mp-progress-bar');
    if (bar) bar.style.width = (_progress() * 100) + '%';
    const timeEl = document.getElementById('mp-time');
    if (timeEl) timeEl.textContent = `${_fmt(_curTime())} / ${_fmt(_dur())}`;
    const mbar = document.getElementById('mp-mini-progress-bar');
    if (mbar) mbar.style.width = (_progress() * 100) + '%';
  }, 500);

  // ── Render ─────────────────────────────────────────────────
  function _renderAll() { _renderTop(); _renderMiniUI(); }

  function _renderTop() {
    const wrap = document.getElementById('music-settings-player');
    if (!wrap) return;
    const t = pl()[_state.index];

    const titleEl = wrap.querySelector('.mp-now-title');
    if (titleEl) titleEl.textContent = t?.title || (pl().length ? 'เลือกเพลง' : 'ยังไม่มีเพลง');

    wrap.querySelector('.mp-play-btn')?.classList.toggle('mp-playing', _state.playing);
    wrap.querySelector('.mp-play-btn') && (wrap.querySelector('.mp-play-btn').textContent = _state.playing ? '⏸' : '▶');
    wrap.querySelector('.mp-loop-btn')?.classList.toggle('mp-active', _state.loop);
    wrap.querySelector('.mp-shuffle-btn')?.classList.toggle('mp-active', _state.shuffle);
    _updateVolUI();
  }

  function _renderMiniUI() {
    const mini = document.getElementById('music-mini-player');
    if (!mini) return;
    const t = pl()[_state.index];
    const titleEl = mini.querySelector('.mp-mini-title');
    if (titleEl) titleEl.textContent = t?.title || '—';
    const btn = mini.querySelector('.mp-mini-play');
    if (btn) btn.textContent = _state.playing ? '⏸' : '▶';
  }

  function _updateVolUI() {
    const s = document.getElementById('mp-volume-slider');
    if (s) s.value = _state.volume;
    const ms = document.getElementById('mp-mini-volume');
    if (ms) ms.value = _state.volume;
  }

  // ── Render Settings UI ─────────────────────────────────────
  function renderSettings() {
    const container = document.getElementById('music-settings-player');
    if (!container) return;
    const t = pl()[_state.index];

    container.innerHTML = `
      <!-- Now playing -->
      <div class="mp-now">
        <div class="mp-now-title">${t?.title || (pl().length ? 'เลือกเพลง' : 'ยังไม่มีเพลง')}</div>
        <div class="mp-time" id="mp-time">0:00 / 0:00</div>
      </div>
      <div class="mp-progress-wrap">
        <div class="mp-progress-track">
          <div class="mp-progress-bar" id="mp-progress-bar"></div>
        </div>
      </div>
      <div class="mp-controls">
        <button class="mp-ctrl-btn mp-shuffle-btn ${_state.shuffle?'mp-active':''}">⇄</button>
        <button class="mp-ctrl-btn mp-prev-btn">⏮</button>
        <button class="mp-ctrl-btn mp-play-btn mp-play-main ${_state.playing?'mp-playing':''}">${_state.playing?'⏸':'▶'}</button>
        <button class="mp-ctrl-btn mp-next-btn">⏭</button>
        <button class="mp-ctrl-btn mp-loop-btn ${_state.loop?'mp-active':''}">↻</button>
      </div>
      <div class="mp-volume-row">
        <span class="mp-vol-icon">🔊</span>
        <input type="range" id="mp-volume-slider" class="mp-volume-slider"
               min="0" max="1" step="0.01" value="${_state.volume}">
      </div>

      <!-- Playlist header -->
      <div class="mp-pl-header">
        <span class="mp-pl-label">PLAYLIST</span>
        <button class="mp-add-btn" id="mp-add-btn">+ เพิ่มเพลง</button>
      </div>

      <!-- Tracks -->
      <div class="mp-tracklist" id="mp-tracklist">
        ${pl().length === 0 ? `
          <div class="mp-empty">
            กด <b>+ เพิ่มเพลง</b> แล้ววาง YouTube URL ได้เลย
          </div>` :
          pl().map((tk, i) => {
            const isActive = i === _state.index;
            const isOff   = tk.enabled === false;
            const hasYt    = !!_ytId(tk.url);
            const hasFile  = !hasYt && !!tk.url;
            const badge    = hasYt   ? `<span class="mp-badge mp-badge-yt">YT</span>`
                           : hasFile ? `<span class="mp-badge mp-badge-file">FILE</span>`
                           :           `<span class="mp-badge mp-badge-none">?</span>`;
            return `
            <div class="mp-track-edit ${isActive ? 'mp-track-active' : ''} ${isOff ? 'mp-track-off' : ''}" data-i="${i}">
              <div class="mp-track-row">
                <span class="mp-track-num">${i+1}</span>
                <div class="mp-track-fields">
                  <input class="mp-inp-title" data-i="${i}" type="text"
                         placeholder="ชื่อเพลง" value="${_esc(tk.title)}">
                  <input class="mp-inp-url" data-i="${i}" type="text"
                         placeholder="วาง YouTube URL หรือ path ไฟล์ เช่น https://youtu.be/xxxx"
                         value="${_esc(tk.url)}">
                </div>
                <div class="mp-track-actions">
                  ${badge}
                  <button class="mp-toggle-btn ${isOff ? 'mp-toggle-off' : 'mp-toggle-on'}" data-i="${i}" title="${isOff ? 'เปิดเพลงนี้' : 'ปิดเพลงนี้'}">${isOff ? '○' : '●'}</button>
                  <button class="mp-play-track-btn ${isOff ? 'mp-btn-disabled' : ''}" data-i="${i}" title="เล่น" ${isOff ? 'disabled' : ''}>▶</button>
                  <button class="mp-remove-btn" data-i="${i}" title="ลบ">✕</button>
                </div>
              </div>
            </div>`;
          }).join('')
        }
      </div>
    `;

    // === Events ===
    container.querySelector('.mp-play-btn').onclick    = toggle;
    container.querySelector('.mp-prev-btn').onclick    = prev;
    container.querySelector('.mp-next-btn').onclick    = next;
    container.querySelector('.mp-loop-btn').onclick    = toggleLoop;
    container.querySelector('.mp-shuffle-btn').onclick = toggleShuffle;
    container.querySelector('#mp-volume-slider').oninput = e => setVolume(+e.target.value);
    container.querySelector('#mp-add-btn').onclick     = addTrack;

    container.querySelector('.mp-progress-track')?.addEventListener('click', e => {
      const rect  = e.currentTarget.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      const d = _dur();
      if (!d) return;
      const tk = pl()[_state.index];
      if (_isYt(tk) && _ytReady) _ytPlayer.seekTo(ratio * d, true);
      else _audio.currentTime = ratio * d;
    });

    // play track button
    container.querySelectorAll('.mp-play-track-btn').forEach(btn => {
      btn.onclick = e => { e.stopPropagation(); selectTrack(+btn.dataset.i); };
    });

    // toggle enabled
    container.querySelectorAll('.mp-toggle-btn').forEach(btn => {
      btn.onclick = e => { e.stopPropagation(); toggleEnabled(+btn.dataset.i); };
    });

    // remove
    container.querySelectorAll('.mp-remove-btn').forEach(btn => {
      btn.onclick = e => { e.stopPropagation(); removeTrack(+btn.dataset.i); };
    });

    // auto-save on blur ของ input
    container.querySelectorAll('.mp-inp-title, .mp-inp-url').forEach(inp => {
      inp.addEventListener('blur', () => {
        const i      = +inp.dataset.i;
        const row    = container.querySelector(`.mp-track-edit[data-i="${i}"]`);
        const title  = row?.querySelector('.mp-inp-title')?.value || '';
        const url    = row?.querySelector('.mp-inp-url')?.value   || '';
        saveTrack(i, title, url);
      });
      // save on Enter
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') inp.blur();
      });
    });
  }

  // ── Render Mini-player ─────────────────────────────────────
  function renderMini() {
    const mini = document.getElementById('music-mini-player');
    if (!mini) return;
    const t = pl()[_state.index];
    mini.innerHTML = `
      <div class="mp-mini-progress-track">
        <div class="mp-mini-progress-bar" id="mp-mini-progress-bar"></div>
      </div>
      <button class="mp-mini-btn mp-mini-prev">⏮</button>
      <button class="mp-mini-btn mp-mini-play">${_state.playing ? '⏸' : '▶'}</button>
      <button class="mp-mini-btn mp-mini-next">⏭</button>
      <span class="mp-mini-title">${t?.title || '—'}</span>
      <input type="range" id="mp-mini-volume" class="mp-mini-vol"
             min="0" max="1" step="0.05" value="${_state.volume}">
    `;
    mini.querySelector('.mp-mini-play').onclick  = toggle;
    mini.querySelector('.mp-mini-prev').onclick  = prev;
    mini.querySelector('.mp-mini-next').onclick  = next;
    mini.querySelector('#mp-mini-volume').oninput = e => setVolume(+e.target.value);
  }

  function _esc(s) {
    return (s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  }

  // ── Init ───────────────────────────────────────────────────
  _load();
  _audio.loop   = _state.loop;
  _audio.volume = _state.volume;
  const first = pl()[_state.index];
  if (first && _isYt(first)) _loadYtApi();
  else if (first?.url) _audio.src = first.url;

  return {
    play, pause, toggle, next, prev,
    setVolume, toggleLoop, toggleShuffle, selectTrack,
    addTrack, removeTrack, saveTrack, toggleEnabled,
    renderSettings, renderMini,
    get isPlaying()    { return _state.playing; },
    get currentTrack() { return pl()[_state.index] || null; },
    get PLAYLIST()     { return pl(); },
  };
})();

window.MusicPlayer = MusicPlayer;
