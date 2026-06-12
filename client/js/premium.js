// ===== PREMIUM.JS =====
// จัดการสถานะ Premium ผ่าน Realtime Database
// path: /users/{uid}/profile/account  →  "general" หรือ "premium"
//
// API สาธารณะ:
//   Premium.init(uid, rtdbHelpers)   — เรียกตอน login
//   Premium.isActive()               — คืน true/false
//   Premium.onReady(fn)              — เรียก fn เมื่อโหลดเสร็จ
//   Premium.reset()                  — เมื่อ logout

const Premium = (() => {

  let _uid      = null;
  let _active   = false;
  let _ready    = false;
  const _onReadyCallbacks = [];

  // ── โหลดจาก Realtime Database ────────────────────────────
  async function _load(get, ref, db) {
    try {
      const snap = await get(ref(db, `users/${_uid}/profile/account`));
      _active = snap.exists() && snap.val() === 'premium';
    } catch (e) {
      console.warn('[Premium] load failed:', e);
      _active = false;
    }
    _ready = true;
    _onReadyCallbacks.forEach(fn => fn());
  }

  function isActive() { return _active; }

  function onReady(fn) {
    if (_ready) fn();
    else _onReadyCallbacks.push(fn);
  }

  function init(uid, rtdbHelpers) {
    _uid    = uid;
    _ready  = false;
    _active = false;
    const { get, ref, db } = rtdbHelpers;
    _load(get, ref, db);
  }

  function reset() {
    _uid    = null;
    _active = false;
    _ready  = false;
  }

  return { init, isActive, onReady, reset };
})();

window.Premium = Premium;
