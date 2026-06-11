// ===== ARMOR.JS =====
// จัดการระบบ Armor — อ่านค่าจาก Backpack equip slot 'body' และ 'head'
// และคำนวณ reducePct แยกต่างหากสำหรับแต่ละส่วน
//
// การทำงาน:
//   - Armor ตัว (body slot)  → ป้องกันดาเมจที่โดนลำตัว
//   - Armor หัว (head slot)  → ป้องกันดาเมจที่โดนหัว
//   - คำนวณจาก ARMOR_CONFIG[itemId].armorPct

const Armor = (() => {

  // ── อ่าน armorPct จาก Backpack equip slot ──────────────────
  function _getArmorPct(slotName) {
    if (typeof Backpack === 'undefined') return 0;
    const itemId = Backpack.getEquippedInSlot(slotName);
    if (!itemId) return 0;
    if (typeof ARMOR_CONFIG === 'undefined') return 0;
    const cfg = ARMOR_CONFIG[itemId];
    if (!cfg) return 0;
    return cfg.armorPct || 0;
  }

  // ── ดึง reducePct สำหรับลำตัว ─────────────────────────────
  function getBodyReducePct() {
    return _getArmorPct('body');
  }

  // ── ดึง reducePct สำหรับหัว ───────────────────────────────
  function getHeadReducePct() {
    return _getArmorPct('head');
  }

  // ── คำนวณดาเมจสุดท้ายหลังหักเกราะ ────────────────────────
  // hitZone: 'head' | 'body' (default 'body' ถ้าไม่ระบุ)
  function calcFinalDamage(rawDamage, hitZone) {
    const zone = hitZone === 'head' ? 'head' : 'body';
    const pct  = zone === 'head' ? getHeadReducePct() : getBodyReducePct();
    const mult = 1 - pct / 100;
    return Math.max(1, Math.round(rawDamage * mult));
  }

  // ── ส่งออก reducePct รวม (body + head) สำหรับ Network.sendUpdate ─
  // server ใช้ค่านี้เป็น fallback สำหรับ entity หรือกรณีไม่มี hitZone
  // ใช้ค่าสูงสุดระหว่างสองชิ้น
  function getCombinedReducePct() {
    return Math.max(getBodyReducePct(), getHeadReducePct());
  }

  return {
    getBodyReducePct,
    getHeadReducePct,
    getCombinedReducePct,
    calcFinalDamage,
  };
})();

window.Armor = Armor;
