// ===== PROMOTION.JS =====
// depends on: money.js, stash.js, character.js

const Promotion = (() => {

  // ── ข้อมูลแต่ละโปรโมชั่น ──────────────────────────────────
  const PACKS = {
    50: {
      items: [
        { id: 'head_lucifer', qty: 3 },
        { id: 'body_lucifer', qty: 3 },
        { id: 'asr_lucifer',  qty: 3 },
        { id: 'snp_lucifer',  qty: 1 },
      ],
    },
    90: {
      items: [
        { id: 'head_lucifer', qty: 5 },
        { id: 'body_lucifer', qty: 5 },
        { id: 'asr_lucifer',  qty: 5 },
        { id: 'snp_lucifer',  qty: 2 },
      ],
    },
    150: {
      items: [
        { id: 'head_lucifer', qty: 9 },
        { id: 'body_lucifer', qty: 9 },
        { id: 'asr_lucifer',  qty: 9 },
        { id: 'snp_lucifer',  qty: 3 },
      ],
    },
    300: {
      items: [
        { id: 'head_lucifer', qty: 18 },
        { id: 'body_lucifer', qty: 18 },
        { id: 'asr_lucifer',  qty: 18 },
        { id: 'snp_lucifer',  qty: 6  },
      ],
    },
    500: {
      items: [
        { id: 'head_lucifer', qty: 30 },
        { id: 'body_lucifer', qty: 30 },
        { id: 'asr_lucifer',  qty: 30 },
        { id: 'snp_lucifer',  qty: 10 },
      ],
      chars: ['yagi'],
    },
    1000: {
      items: [
        { id: 'head_lucifer', qty: 60 },
        { id: 'body_lucifer', qty: 60 },
        { id: 'asr_lucifer',  qty: 60 },
        { id: 'snp_lucifer',  qty: 20 },
      ],
      chars: ['yagi'],
    },
  };

  // ── ซื้อโปรโมชั่น ──────────────────────────────────────────
  function buy(price) {
    const pack = PACKS[price];
    if (!pack) return;

    // ตรวจสอบว่า Stash พร้อมใช้งาน
    if (typeof Stash === 'undefined') {
      window.showToast('ระบบยังไม่พร้อม กรุณาลองใหม่', 'error');
      return;
    }

    // ตัด point
    const ok = Money.spend('point', price);
    if (!ok) {
      const remaining = Money.get().point;
      window.showToast(`Point ไม่พอ! (มี ${remaining.toLocaleString()} Point)`, 'error');
      return;
    }

    // เพิ่มไอเทมลงคลัง
    pack.items.forEach(({ id, qty }) => {
      Stash.add(id, qty);
    });

    // แจ้ง Inventory ให้ re-render
    if (typeof Inventory !== 'undefined') {
      Inventory.renderStash?.();
    }

    // ปลดล็อก character (ถ้ามี)
    if (pack.chars) {
      pack.chars.forEach(charId => {
        if (typeof Character !== 'undefined') {
          if (typeof Character.giveChar === 'function') {
            Character.giveChar(charId);
          } else {
            const charDef = (typeof CHARACTERS !== 'undefined')
              ? CHARACTERS.find(c => c.id === charId)
              : null;
            if (charDef) {
              Money.earn(charDef.currency || 'point', charDef.price || 0);
              Character.buyChar(charId);
            }
          }
        }
      });
    }

    // แสดง Point ที่เหลืออยู่
    const remaining = Money.get().point;
    window.showToast(
      `✓ ซื้อโปรโมชั่น ${price.toLocaleString()} Point สำเร็จ! | Point คงเหลือ: ${remaining.toLocaleString()}`,
      'success'
    );
  }

  return { buy };
})();

window.Promotion = Promotion;
