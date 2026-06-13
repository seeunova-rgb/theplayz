// ===== PROMOTION.JS =====
// depends on: money.js, stash.js, character.js

const Promotion = (() => {

  // ── ข้อมูลแต่ละโปรโมชั่น ──────────────────────────────────
  // SET = head_lucifer + body_lucifer + asr_lucifer (1 ชุด)
  // EA  = snp_lucifer (1 ชิ้น)
  // lock = ไอเทมล็อก (ยังไม่ได้ใช้ในระบบ ข้ามไป)
  // char = ปลดล็อก yagi

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

    // ตัด point
    const ok = Money.spend('point', price);
    if (!ok) {
      window.showToast('Point ไม่พอ!', 'error');
      return;
    }

    // เพิ่มไอเทมลงคลัง
    pack.items.forEach(({ id, qty }) => {
      Stash.add(id, qty);
    });

    // ปลดล็อก character (ถ้ามี) — inject โดยตรงผ่าน buyChar แต่ราคา 0
    // ใช้วิธี: ถ้า Character มี giveChar ใช้เลย ถ้าไม่มีใช้ workaround
    if (pack.chars) {
      pack.chars.forEach(charId => {
        if (typeof Character !== 'undefined') {
          // ถ้า Character มี giveChar (ถ้าเพิ่มไว้)
          if (typeof Character.giveChar === 'function') {
            Character.giveChar(charId);
          } else {
            // workaround: ให้ point ชั่วคราวแล้วซื้อ
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

    window.showToast(`ซื้อโปรโมชั่น ${price.toLocaleString()} Point สำเร็จ! ✓`, 'success');
  }

  return { buy };
})();

window.Promotion = Promotion;
