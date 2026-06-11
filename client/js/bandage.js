// ===== BANDAGE.JS =====
// ใช้ยา bandage จาก EQUIP slot 'med' — HEAL +100 HP, cooldown 3 วินาที
// รองรับ stack: ใช้แล้วลด qty, หมดแล้ว unequip

const Bandage = (() => {

  const ITEM_ID  = 'bandage';
  const HEAL_AMT = 100;
  const COOLDOWN = 3000;   // ms

  let _lastUsed   = 0;
  let _cdInterval = null;

  function _getPlayer() {
    return (typeof window._player !== 'undefined') ? window._player : null;
  }

  function _isEquipped() {
    return typeof Backpack !== 'undefined' && Backpack.getEquippedInSlot('med') === ITEM_ID;
  }

  function _getQty() {
    return typeof Backpack !== 'undefined' ? (Backpack.getEquippedQtyInSlot('med') || 0) : 0;
  }

  // ── อัปเดต UI ปุ่มยา ───────────────────────────────────────
  function _updateUI() {
    const btn = document.getElementById('bandage-btn');
    if (!btn) return;

    const equipped = _isEquipped();
    const qty      = _getQty();
    const now      = Date.now();
    const elapsed  = now - _lastUsed;
    const onCd     = elapsed < COOLDOWN;

    // ซ่อนปุ่มเมื่อไม่มียาและไม่อยู่ใน cooldown
    if (!equipped && !onCd) {
      btn.style.display = 'none';
      return;
    }
    btn.style.display = 'flex';

    // แสดง qty badge บนปุ่ม
    let badge = btn.querySelector('.bandage-qty');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'bandage-qty';
      btn.appendChild(badge);
    }
    badge.textContent = equipped && qty > 1 ? `x${qty}` : '';

    if (onCd) {
      const remaining = ((COOLDOWN - elapsed) / 1000).toFixed(1);
      btn.classList.add('on-cooldown');
      btn.dataset.cd = remaining + 's';
      // [FIX #3] แสดง "ยาหมด" ชัดเจนเมื่อยาหมดแต่ยัง cooldown อยู่
      btn.title = equipped
        ? `รอ ${remaining}s`
        : `ยาหมดแล้ว (รอ ${remaining}s)`;
    } else if (!equipped) {
      // cooldown หมดแล้วและไม่มียา → ซ่อนปุ่ม
      btn.style.display = 'none';
    } else {
      btn.classList.remove('on-cooldown');
      btn.dataset.cd = '';
      btn.title = `ใช้ยา Bandage (x${qty})`;
    }
  }

  // ── ใช้ยา ──────────────────────────────────────────────────
  function use() {
    const now    = Date.now();
    const player = _getPlayer();

    if (now - _lastUsed < COOLDOWN) return;

    if (!_isEquipped()) {
      if (typeof window.showToast === 'function')
        window.showToast('ใส่ยาในช่อง EQUIP ก่อน!', 'error');
      return;
    }

    if (!player || !player.alive) return;

    // consume 1 qty — ตั้ง _lastUsed ก่อน เพื่อป้องกัน double-tap race condition
    _lastUsed = now;

    const qty = _getQty();
    if (qty <= 1) {
      // หมด → unequip
      Backpack.unequipSlot('med');
    } else {
      // ลด qty ใน equip slot
      Backpack.setEquipQty('med', qty - 1);
    }

    // [FIX #1] Optimistic heal ฝั่ง client ก่อน แล้ว sync ไป server
    // server จะ validate และยืนยัน HP กลับมาทาง 'healed' event
    player.hp = Math.min(player.maxHp, player.hp + HEAL_AMT);
    if (typeof Network !== 'undefined') Network.sendHeal(HEAL_AMT);

    if (typeof Sounds !== 'undefined') Sounds.play('heal', 0.9);
    if (typeof window.showToast === 'function')
      window.showToast(`+${HEAL_AMT} HP`, 'success');

    _updateUI();
    if (typeof Backpack !== 'undefined') Backpack.renderPanel();

    clearInterval(_cdInterval);
    _cdInterval = setInterval(() => {
      _updateUI();
      if (Date.now() - _lastUsed >= COOLDOWN) {
        clearInterval(_cdInterval);
        _cdInterval = null;
        _updateUI();
      }
    }, 100);
  }

  function init() {
    const btn = document.getElementById('bandage-btn');
    if (!btn) return;
    btn.addEventListener('click', () => use());
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); use(); }, { passive: false });
    _updateUI();
  }

  return { init, use, updateUI: _updateUI };
})();

window.Bandage = Bandage;
