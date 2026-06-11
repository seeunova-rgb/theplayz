// ===== STASH.JS =====
// คลังไอเทม (supplyQty) เชื่อม Firebase Realtime Database
// path: /users/{uid}/stash  →  { itemId: qty, ... }
//
// API สาธารณะ:
//   Stash.init(uid, fb)          — เรียกตอน login, ส่ง uid + fb helpers
//   Stash.getQty(itemId)         — จำนวนในคลัง (number)
//   Stash.add(itemId, qty)       — เพิ่มของ (ซื้อ)
//   Stash.spend(itemId, qty)     — ตัดของ (consume ในเกม), return true/false
//   Stash.set(itemId, qty)       — set ตรงๆ (กรณีพิเศษ)
//   Stash.getAll()               — { itemId: qty } snapshot ทั้งหมด
//   Stash.onReady(fn)            — เรียก fn เมื่อโหลดจาก Firebase เสร็จ
//   Stash.reset()                — detach listener เมื่อ logout

const Stash = (() => {

  let _uid         = null;
  let _fb          = null;   // { ref, get, set, onValue, off, db }
  let _data        = {};     // { itemId: qty }
  let _ready       = false;
  let _unsubscribe = null;
  const _onReadyCallbacks = [];

  const FIREBASE_ROOT = 'users';

  // ── Firebase ref ──────────────────────────────────────────
  function _stashRef() {
    return _fb.ref(_fb.db, `${FIREBASE_ROOT}/${_uid}/stash`);
  }
  function _itemRef(itemId) {
    return _fb.ref(_fb.db, `${FIREBASE_ROOT}/${_uid}/stash/${itemId}`);
  }

  // ── โหลดจาก Firebase ──────────────────────────────────────
  async function _load() {
    try {
      const snap = await _fb.get(_stashRef());
      _data = snap.exists() ? (snap.val() ?? {}) : {};
    } catch (e) {
      console.warn('[Stash] load failed, using empty stash:', e);
      _data = {};
    }
    _ready = true;
    _onReadyCallbacks.forEach(fn => fn());
  }

  // ── บันทึกทั้งก้อน (ใช้ตอน reset/clear) ─────────────────
  async function _saveAll() {
    if (!_uid || !_fb) return;
    try {
      await _fb.set(_stashRef(), _data);
    } catch (e) {
      console.warn('[Stash] saveAll failed:', e);
    }
  }

  // ── บันทึกรายการเดียว (เร็วกว่า) ─────────────────────────
  async function _saveItem(itemId) {
    if (!_uid || !_fb) return;
    try {
      const qty = _data[itemId] ?? 0;
      if (qty <= 0) {
        // ลบ node ออกเมื่อ qty = 0 เพื่อไม่ให้ Firebase บวม
        await _fb.set(_itemRef(itemId), null);
      } else {
        await _fb.set(_itemRef(itemId), qty);
      }
    } catch (e) {
      console.warn(`[Stash] saveItem(${itemId}) failed:`, e);
    }
  }

  // ── real-time listener — sync หลาย tab/อุปกรณ์ ──────────
  function _startListener() {
    _unsubscribe = _fb.onValue(_stashRef(), snap => {
      const remote = snap.exists() ? (snap.val() ?? {}) : {};
      // อัปเดตเฉพาะถ้าต่างจาก local (หลีกเลี่ยง loop)
      if (JSON.stringify(remote) !== JSON.stringify(_data)) {
        _data = remote;
        // แจ้ง UI ที่ขึ้นอยู่กับ stash
        _notifyChange();
      }
    });
  }

  // ── แจ้ง Inventory + Shop ให้ re-render (debounced) ──────
  // [FIX] debounce 150ms — ป้องกัน Shop.render() ถูกเรียกซ้ำทุก Firebase push
  let _notifyTimer = null;
  function _notifyChange() {
    if (_notifyTimer) return;
    _notifyTimer = setTimeout(() => {
      _notifyTimer = null;
      if (typeof Inventory !== 'undefined') Inventory.renderStash?.();
      if (typeof Shop      !== 'undefined') Shop.render?.();
    }, 150);
  }

  // ── API: ดึงจำนวน ─────────────────────────────────────────
  function getQty(itemId) {
    return Math.max(0, _data[itemId] ?? 0);
  }

  // ── API: ดึงทั้งหมด ───────────────────────────────────────
  function getAll() {
    return { ..._data };
  }

  // ── API: เพิ่มของ (ซื้อ / earn) ──────────────────────────
  function add(itemId, qty = 1) {
    _data[itemId] = ((_data[itemId] ?? 0) + qty);
    _saveItem(itemId);
  }

  // ── API: ตัดของ (consume) ─────────────────────────────────
  // return true = สำเร็จ, false = ของไม่พอ
  function spend(itemId, qty = 1) {
    const current = _data[itemId] ?? 0;
    if (current < qty) return false;
    _data[itemId] = current - qty;
    if (_data[itemId] <= 0) delete _data[itemId];
    _saveItem(itemId);
    return true;
  }

  // ── API: set ตรงๆ ─────────────────────────────────────────
  function setQty(itemId, qty) {
    if (qty <= 0) {
      delete _data[itemId];
    } else {
      _data[itemId] = qty;
    }
    _saveItem(itemId);
  }

  // ── API: รอให้ ready ──────────────────────────────────────
  function onReady(fn) {
    if (_ready) fn();
    else _onReadyCallbacks.push(fn);
  }

  // ── API: init ─────────────────────────────────────────────
  function init(uid, fb) {
    _uid   = uid;
    _fb    = fb;
    _ready = false;
    _data  = {};
    _load().then(() => _startListener());
  }

  // ── reset เมื่อ logout ────────────────────────────────────
  function reset() {
    if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
    _uid   = null;
    _fb    = null;
    _data  = {};
    _ready = false;
  }

  return { init, reset, getQty, getAll, add, spend, setQty, onReady };
})();

window.Stash = Stash;
