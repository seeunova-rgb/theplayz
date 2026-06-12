// ===== SOUNDS.JS =====

const Sounds = (() => {

  let _ctx = null;
  let _unlocked = false;
  const _buffers = {};    // id → AudioBuffer
  const _pending = {};    // id → ArrayBuffer (รอ decode หลัง unlock)

  function _getCtx() {
    if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
    return _ctx;
  }

  // decode ทุก pending buffer หลัง unlock
  function _decodePending() {
    const ctx = _getCtx();
    Object.entries(_pending).forEach(([id, ab]) => {
      ctx.decodeAudioData(ab.slice(0), buf => {
        _buffers[id] = buf;
        delete _pending[id];
      });
    });
  }

  // unlock + decode pending ทันทีใน same gesture
  function _unlock() {
    const ctx = _getCtx();
    if (_unlocked && ctx.state === 'running') return;

    const doUnlock = () => {
      if (!_unlocked) {
        _unlocked = true;
        _decodePending();
      }
    };

    if (ctx.state === 'running') {
      doUnlock();
    } else {
      // สร้าง silent buffer เพื่อ warm-up AudioContext ให้พร้อมทันที
      const silentBuf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = silentBuf;
      src.connect(ctx.destination);
      src.start(0);

      ctx.resume().then(doUnlock);
    }
  }

  document.addEventListener('pointerdown', _unlock);
  document.addEventListener('touchstart',  _unlock, { passive: true });

  // fetch ไฟล์เสียง เก็บเป็น ArrayBuffer ก่อน
  function preload(id, src) {
    // [FIX] เพิ่ม error handling ครบ: ตรวจ HTTP status + catch network error
    fetch(src)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status} loading sound: ${src}`);
        return r.arrayBuffer();
      })
      .then(ab => {
        if (_unlocked && _ctx) {
          _ctx.decodeAudioData(ab.slice(0), buf => {
            _buffers[id] = buf;
          }, err => {
            console.warn(`[Sounds] decodeAudioData failed for "${id}":`, err);
          });
        } else {
          _pending[id] = ab;
        }
      })
      .catch(err => {
        console.warn(`[Sounds] preload failed for "${id}" (${src}):`, err);
      });
  }

  function _playBuffer(id, volume) {
    const buf = _buffers[id];
    if (!buf) return;
    const ctx = _getCtx();
    if (ctx.state !== 'running') return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = Math.max(0, Math.min(1, volume));
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start(0);
  }

  function play(id, volume = 1.0) {
    if (!_unlocked) return;
    _playBuffer(id, volume);
  }

  // ── เสียง 3D: ปรับ volume ตามระยะห่างจาก listener ────────
  // sourceX/Y  = ตำแหน่งผู้เล่นที่ออกเสียง (world coords)
  // listenerX/Y = ตำแหน่ง local player (world coords)
  // maxDist    = ระยะที่ไกลที่สุดที่ได้ยิน (default 800px world)
  // baseVol    = volume สูงสุดเมื่ออยู่ใกล้มาก
  function playAt(id, baseVol, sourceX, sourceY, listenerX, listenerY, maxDist) {
    if (!_unlocked) return;
    maxDist = maxDist || 800;
    const dx   = sourceX - listenerX;
    const dy   = sourceY - listenerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist >= maxDist) return;                         // ไกลเกิน — ไม่เล่น
    // linear falloff: ใกล้สุด = baseVol, ไกลสุด = 0
    const vol = baseVol * Math.max(0, 1 - dist / maxDist);
    _playBuffer(id, vol);
  }

  // ── preload เสียงทั้งหมด ──────────────────────────────────
  preload('snp_1',    'assets/sounds/snp_1.ogg');
  preload('snp_2',    'assets/sounds/snp_2.ogg');
  preload('asr_1',    'assets/sounds/asr_1.ogg');
  preload('shg_1',    'assets/sounds/shg_1.ogg');
  preload('hit1',     'assets/sounds/hit1.ogg');
  preload('hit2',     'assets/sounds/hit2.ogg');
  preload('hit3',     'assets/sounds/hit3.ogg');
  preload('hurt1',    'assets/sounds/hurt1.ogg');
  preload('hurt2',    'assets/sounds/hurt2.ogg');
  preload('heal',     'assets/sounds/heal.ogg');
  preload('walk',     'assets/sounds/walk.ogg');
  preload('backpack', 'assets/sounds/backpack.ogg');
  preload('click',    'assets/sounds/click.ogg');

  // ── click sound ───────────────────────────────────────────
  const CLICK_SELECTOR = [
    'button',
    '.nav-btn',
    '.nav-settings',
    '.auth-tab',
    '.shop-tab',
    '.inv-tab',
    '.char-tab',
    '.shop-card',
    '.inv-item',
    '.char-card',
    '.ws-card',
    '.btn-play',
    '.btn-auth',
    '.btn-logout',
    '.settings-btn-logout',
    '.btn-cancel',
    '.btn-buy',
    '.btn-sell',
    '.btn-ws-join',
    // ── กระเป๋า (Backpack) ──
    '.bp-slot',
    '.bp-item-slot',
    '.bp-equip-slot',
    // ── กระเป๋าในเกม (InGameBP) ──
    '.igbp-slot',
    '.igbp-item-slot',
    '.igbp-equip-slot',
    // ── คลัง (Inventory / Stash) ──
    '.inv-stash-card',
    '.inv-stash-grid .stash-item',
    // ── ร้านค้า (Shop) ──
    '.wz-item-slot',
    '.wz-cat-btn',
  ].join(', ');

  const EXCLUDE_IDS = ['joystick-zone', 'attack-zone', 'sprint-btn'];

  function initClickSounds() {
    document.addEventListener('pointerdown', e => {
      const el = e.target.closest(CLICK_SELECTOR);
      if (!el) return;
      if (el.disabled) return;
      if (EXCLUDE_IDS.some(id => el.id === id || el.closest('#' + id))) return;
      play('click', 0.6);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initClickSounds);
  } else {
    initClickSounds();
  }

  // ── walk sound ────────────────────────────────────────────
  // เล่นเสียงเดิน throttle ด้วย interval ไม่ให้ถี่เกินไป
  let _walkTimer    = 0;
  const _WALK_INTERVAL = 380;   // ms ต่อก้าว

  function tickWalk(dt, isMoving, isSprinting) {
    if (!isMoving) {
      _walkTimer = 0;
      return false;
    }
    _walkTimer += dt;
    const interval = isSprinting ? _WALK_INTERVAL * 0.6 : _WALK_INTERVAL;
    if (_walkTimer >= interval) {
      _walkTimer -= interval;
      play('walk', 0.35);
      return true;   // บอก caller ว่าเพิ่งก้าว — ให้ส่ง network sound ได้
    }
    return false;
  }

  return { play, playAt, preload, tickWalk };
})();

window.Sounds = Sounds;
