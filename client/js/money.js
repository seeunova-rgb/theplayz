// ===== MONEY.JS =====
// ระบบเงินกลาง (money + point) เชื่อม Firebase Realtime Database
// depends on: config_money.js
//
// API สาธารณะ:
//   Money.init(uid, fb)        — เรียกตอน login, ส่ง uid + { ref, get, set, onValue, off, db }
//   Money.get()                — { money, point }
//   Money.spend(currency, amt) — ตัดเงิน, return true/false
//   Money.earn(currency, amt)  — เพิ่มเงิน (เช่น kill reward)
//   Money.onReady(fn)          — เรียก fn เมื่อโหลดจาก Firebase เสร็จ
//   Money.syncHUD()            — อัปเดต element ทุกจุดใน DOM

const Money = (() => {

  let _uid   = null;
  let _fb    = null;   // { ref, get, set, onValue, off, db }
  let _money = 0;
  let _point = 0;
  let _ready = false;
  let _unsubscribe = null;
  const _onReadyCallbacks = [];

  // ── Firebase ref helper ───────────────────────────────────
  function walletRef() {
    return _fb.ref(_fb.db, `${MONEY_CONFIG.FIREBASE_PATH}/${_uid}/wallet`);
  }

  // ── โหลดจาก Firebase ──────────────────────────────────────
  async function load() {
    try {
      const snap = await _fb.get(walletRef());
      if (snap.exists()) {
        const d = snap.val();
        _money = d.money ?? MONEY_CONFIG.STARTING_MONEY;
        _point = d.point ?? MONEY_CONFIG.STARTING_POINT;
      } else {
        // ผู้เล่นใหม่ — ตั้งค่าเริ่มต้น
        _money = MONEY_CONFIG.STARTING_MONEY;
        _point = MONEY_CONFIG.STARTING_POINT;
        await _save();
      }
    } catch (e) {
      console.warn('[Money] load failed, using defaults:', e);
      _money = MONEY_CONFIG.STARTING_MONEY;
      _point = MONEY_CONFIG.STARTING_POINT;
    }
    _ready = true;
    syncHUD();
    _onReadyCallbacks.forEach(fn => fn());
  }

  // ── บันทึกไป Firebase ─────────────────────────────────────
  async function _save() {
    if (!_uid || !_fb) return;
    try {
      await _fb.set(walletRef(), { money: _money, point: _point });
    } catch (e) {
      console.warn('[Money] save failed:', e);
    }
  }

  // ── real-time listener — sync หลาย tab/อุปกรณ์ ───────────
  function _startListener() {
    _unsubscribe = _fb.onValue(walletRef(), snap => {
      if (!snap.exists()) return;
      const d = snap.val();
      if (d.money !== _money || d.point !== _point) {
        _money = d.money ?? _money;
        _point = d.point ?? _point;
        syncHUD();
      }
    });
  }

  // ── อัปเดต DOM ทุกจุด ─────────────────────────────────────
  function _fmtPoint(v) {
    // แสดงทศนิยมเฉพาะเมื่อมีค่า เช่น 10.5 → "10.5", 10.00 → "10"
    return Number.isInteger(v) ? v.toLocaleString() : v.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  }

  function syncHUD() {
    const sm = document.getElementById('shop-money');
    const sp = document.getElementById('shop-point');
    if (sm) sm.textContent = Math.floor(_money).toLocaleString();
    if (sp) sp.textContent = _fmtPoint(_point);

    const hm = document.getElementById('hud-money');
    const hp = document.getElementById('hud-point');
    if (hm) hm.textContent = Math.floor(_money).toLocaleString();
    if (hp) hp.textContent = _fmtPoint(_point);
  }

  // ── API: ตัดเงิน ──────────────────────────────────────────
  function spend(currency, amount) {
    const amt = Math.round(Number(amount) * 100) / 100; // ปัดทศนิยม 2 ตำแหน่ง
    if (!isFinite(amt) || amt <= 0) return false;

    if (currency === 'money') {
      if (_money < amt) return false;
      _money = Math.round((_money - amt) * 100) / 100;
    } else {
      if (_point < amt) return false;
      _point = Math.round((_point - amt) * 100) / 100;
    }
    syncHUD();
    _save();
    return true;
  }

  // ── API: เพิ่มเงิน ─────────────────────────────────────────
  function earn(currency, amount) {
    const amt = Math.round(Number(amount) * 100) / 100; // ปัดทศนิยม 2 ตำแหน่ง
    if (!isFinite(amt) || amt <= 0) return;

    if (currency === 'money') _money = Math.round((_money + amt) * 100) / 100;
    else                      _point = Math.round((_point + amt) * 100) / 100;
    syncHUD();
    _save();
  }

  // ── API: ดึงยอด ───────────────────────────────────────────
  function get() {
    return { money: _money, point: _point };
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
    load().then(() => _startListener());
  }

  // ── reset เมื่อ logout ────────────────────────────────────
  function reset() {
    if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
    _uid   = null;
    _fb    = null;
    _money = 0;
    _point = 0;
    _ready = false;
    syncHUD();
  }

  return { init, reset, get, spend, earn, onReady, syncHUD };
})();

window.Money = Money;
