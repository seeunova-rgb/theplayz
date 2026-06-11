// ===== REPUTATION.JS =====
// ระบบ Reputation เชื่อม Firebase Realtime Database
// depends on: config_reputation.js
//
// API สาธารณะ:
//   Reputation.init(uid, fb)          — เรียกตอน login
//   Reputation.get()                   — { rep, tier }  (tier = object จาก TIERS)
//   Reputation.getSide()               — 'good' | 'evil' | 'neutral'
//   Reputation.add(amount)             — เพิ่ม/ลด rep (บวกหรือลบก็ได้)
//   Reputation.onKillPlayer(victimRep) — เรียกเมื่อผู้เล่นฆ่าผู้เล่นอื่น
//   Reputation.onKillEntity(type)      — เรียกเมื่อผู้เล่นฆ่า zombie/boss
//   Reputation.onReady(fn)             — เรียก fn เมื่อโหลดจาก Firebase เสร็จ
//   Reputation.syncHUD()               — อัปเดต HUD
//   Reputation.reset()                 — เรียกตอน logout

const Reputation = (() => {

  let _uid  = null;
  let _fb   = null;
  let _rep  = 0;
  let _ready = false;
  let _unsubscribe = null;
  const _onReadyCallbacks = [];

  // ── Firebase ref ─────────────────────────────────────────
  function _repRef() {
    return _fb.ref(_fb.db, `${REPUTATION_CONFIG.FIREBASE_PATH}/${_uid}/reputation`);
  }

  // ── โหลดจาก Firebase ──────────────────────────────────────
  async function _load() {
    try {
      const snap = await _fb.get(_repRef());
      if (snap.exists()) {
        _rep = snap.val().rep ?? REPUTATION_CONFIG.STARTING_REP;
      } else {
        _rep = REPUTATION_CONFIG.STARTING_REP;
        await _save();
      }
    } catch (e) {
      console.warn('[Reputation] load failed, using default:', e);
      _rep = REPUTATION_CONFIG.STARTING_REP;
    }
    _ready = true;
    syncHUD();
    _onReadyCallbacks.forEach(fn => fn());
  }

  // ── บันทึกไป Firebase ─────────────────────────────────────
  async function _save() {
    if (!_uid || !_fb) return;
    try {
      await _fb.set(_repRef(), { rep: _rep });
    } catch (e) {
      console.warn('[Reputation] save failed:', e);
    }
  }

  // ── real-time listener ────────────────────────────────────
  function _startListener() {
    _unsubscribe = _fb.onValue(_repRef(), snap => {
      if (!snap.exists()) return;
      const d = snap.val();
      if (d.rep !== _rep) {
        _rep = d.rep ?? _rep;
        syncHUD();
      }
    });
  }

  // ── หา tier จากค่า rep ───────────────────────────────────
  function _getTier(repVal) {
    const tiers = REPUTATION_CONFIG.TIERS;
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (repVal >= tiers[i].min) return tiers[i];
    }
    return tiers[0]; // fallback
  }

  // ── คำนวณว่าผู้เล่นเป็น side ไหน ─────────────────────────
  function getSide(repVal) {
    const r = (repVal !== undefined) ? repVal : _rep;
    return _getTier(r).side;
  }

  // ── คำนวณ rep ที่ได้จากการฆ่า PvP ───────────────────────
  // killerRep  = rep ของผู้ฆ่า
  // victimRep  = rep ของเหยื่อ
  function _calcPvpRepChange(killerRep, victimRep) {
    const killerTier = _getTier(killerRep);
    const victimTier = _getTier(victimRep);

    const reward = REPUTATION_CONFIG.KILL_REWARDS[victimTier.id];
    if (!reward) return 0;

    const killerSide = killerTier.side;

    if (killerSide === 'good') return reward.good_gets;
    if (killerSide === 'evil') return reward.evil_gets;

    // neutral คนฆ่า: ใช้ค่าเฉลี่ยของทั้งสอง
    return Math.round((reward.good_gets + reward.evil_gets) / 2);
  }

  // ── เพิ่ม/ลด rep ──────────────────────────────────────────
  function add(amount) {
    const amt = Number(amount);
    if (!isFinite(amt) || amt === 0) return;
    _rep += Math.round(amt);
    syncHUD();
    _save();
    _showRepChange(amt);
  }

  // ── API: ฆ่าผู้เล่นอื่น ──────────────────────────────────
  // victimRep = reputation ของเหยื่อ (number)
  function onKillPlayer(victimRep) {
    if (!_ready) return;
    const change = _calcPvpRepChange(_rep, victimRep);
    if (change !== 0) add(change);
  }

  // ── API: ฆ่า zombie/boss ─────────────────────────────────
  function onKillEntity(type) {
    if (!_ready) return;
    const reward = REPUTATION_CONFIG.ENTITY_KILL_REP[type] ?? 0;
    if (reward !== 0) add(reward);
  }

  // ── อัปเดต HUD ───────────────────────────────────────────
  function syncHUD() {
    const tier = _getTier(_rep);

    // ค่าตัวเลข
    const el = document.getElementById('hud-reputation');
    if (el) {
      el.textContent = (_rep >= 0 ? '+' : '') + _rep;
      el.style.color = tier.side === 'good' ? '#88ff88'
                     : tier.side === 'evil' ? '#ff6666'
                     : '#cccccc';
    }

    // รูปยศ
    const img = document.getElementById('hud-reputation-icon');
    if (img) {
      if (tier.img) {
        img.src     = `assets/reputations/${tier.img}`;
        img.style.display = 'inline-block';
        img.title   = tier.label;
      } else {
        img.style.display = 'none';
      }
    }

    // label ยศ
    const lbl = document.getElementById('hud-reputation-label');
    if (lbl) lbl.textContent = tier.label;
  }

  // ── แสดง popup เล็กๆ เมื่อ rep เปลี่ยน ───────────────────
  function _showRepChange(amount) {
    const container = document.getElementById('rep-change-popup');
    if (!container) return;

    const span = document.createElement('span');
    span.className = 'rep-change-anim';
    span.textContent = (amount > 0 ? '+' : '') + Math.round(amount) + ' REP';
    span.style.color = amount > 0 ? '#88ff88' : '#ff6666';
    container.appendChild(span);

    // fade out แล้วลบ
    setTimeout(() => { span.classList.add('fade-out'); }, 1200);
    setTimeout(() => { if (span.parentNode) span.parentNode.removeChild(span); }, 2000);
  }

  // ── get ──────────────────────────────────────────────────
  function get() {
    return { rep: _rep, tier: _getTier(_rep) };
  }

  // ── onReady ──────────────────────────────────────────────
  function onReady(fn) {
    if (_ready) fn();
    else _onReadyCallbacks.push(fn);
  }

  // ── init ─────────────────────────────────────────────────
  function init(uid, fb) {
    _uid   = uid;
    _fb    = fb;
    _ready = false;
    _load().then(() => _startListener());
  }

  // ── reset (logout) ───────────────────────────────────────
  function reset() {
    if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
    _uid   = null;
    _fb    = null;
    _rep   = 0;
    _ready = false;
    syncHUD();
  }

  return { init, reset, get, getSide, add, onKillPlayer, onKillEntity, onReady, syncHUD };
})();

window.Reputation = Reputation;
