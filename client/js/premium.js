// ===== PREMIUM.JS =====
// จัดการสถานะ Premium ผ่าน Firestore
// path: /users/{uid}/premium  →  { active: true, since: timestamp }
//
// API สาธารณะ:
//   Premium.init(uid, firestoreRef)   — เรียกตอน login
//   Premium.isActive()                — คืน true/false
//   Premium.onReady(fn)               — เรียก fn เมื่อโหลดเสร็จ
//   Premium.reset()                   — เมื่อ logout

const Premium = (() => {

  let _uid      = null;
  let _active   = false;
  let _ready    = false;
  const _onReadyCallbacks = [];

  // ── ตรวจ premium จาก Firestore ───────────────────────────
  async function _load(getDoc, docRef) {
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        _active = data.active === true;
      } else {
        _active = false;
      }
    } catch (e) {
      console.warn('[Premium] load failed:', e);
      _active = false;
    }
    _ready = true;
    _onReadyCallbacks.forEach(fn => fn());
    _updateUI();
  }

  // ── อัปเดต UI ตาม premium status ─────────────────────────
  function _updateUI() {
    // ปุ่ม in-game shop — แสดงเฉพาะตอนอยู่ในเกม + เป็น premium
    const inGameShopBtn = document.getElementById('btn-ingame-shop');
    if (inGameShopBtn) {
      // ปุ่มนี้จะถูกควบคุมโดย lobby.js ว่าแสดงตอนไหน
      // แค่เก็บ flag ไว้ให้ lobby.js ใช้
    }
  }

  // ── API: เช็คสถานะ ────────────────────────────────────────
  function isActive() { return _active; }

  // ── API: รอ ready ─────────────────────────────────────────
  function onReady(fn) {
    if (_ready) fn();
    else _onReadyCallbacks.push(fn);
  }

  // ── API: init (รับ Firestore helpers จาก auth.js) ─────────
  function init(uid, firestoreHelpers) {
    _uid   = uid;
    _ready = false;
    _active = false;
    const { getDoc, doc, db } = firestoreHelpers;
    const ref = doc(db, 'users', uid, 'premium', 'status');
    _load(getDoc, ref);
  }

  // ── reset เมื่อ logout ─────────────────────────────────────
  function reset() {
    _uid    = null;
    _active = false;
    _ready  = false;
  }

  return { init, isActive, onReady, reset };
})();

window.Premium = Premium;
