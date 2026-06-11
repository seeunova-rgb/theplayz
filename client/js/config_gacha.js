// ===== CONFIG_GACHA.JS =====
// ตั้งค่ากาชาทั้งหมด แก้ที่นี่ที่เดียวมีผลทุกที่
//
// rarity:
//   'gold'   — หายากสุด   (แสดงเส้นสีทอง)
//   'purple' — หายาก      (แสดงเส้นสีม่วง)
//   'blue'   — ปานกลาง    (แสดงเส้นสีฟ้า)
//   'grey'   — ธรรมดา     (แสดงเส้นสีเทา)
//
// chance: น้ำหนักการออก (ยิ่งมาก ยิ่งออกบ่อย)
// itemId + qty: ของที่ได้ (เพิ่มเข้า Stash)

var GACHA_CONFIG = [
  {
    id:       'red_devil',
    name:     'GACHA RED DEVIL',
    icon:     'assets/items/asr_reddevil.png',
    currency: 'point',
    price:    1,           // 10 💎 ต่อ 1 ลอง
    color:    '#c62828',    // สีธีมกาชา

    // pool: รายการของทั้งหมดที่สุ่มได้
    pool: [
      // ── GOLD (หายากสุด) ──────────────────────────────────
      { itemId: 'asr_reddevil',  qty: 1,  rarity: 'gold',   chance: 3  },
      { itemId: 'snp_reddevil',  qty: 1,  rarity: 'gold',   chance: 3  },
      { itemId: 'body_reddevil', qty: 1,  rarity: 'gold',   chance: 4  },
      { itemId: 'head_reddevil', qty: 1,  rarity: 'gold',   chance: 4  },

      // ── PURPLE ───────────────────────────────────────────
      { itemId: 'bandage',       qty: 10, rarity: 'purple', chance: 8  },
      { itemId: 'ammo_box',      qty: 10, rarity: 'purple', chance: 8  },

      // ── BLUE ─────────────────────────────────────────────
      { itemId: 'bandage',       qty: 5,  rarity: 'blue',   chance: 20 },
      { itemId: 'ammo_box',      qty: 5,  rarity: 'blue',   chance: 20 },

      // ── GREY (ธรรมดา) ─────────────────────────────────────
      { itemId: 'bandage',       qty: 1,  rarity: 'grey',   chance: 65 },
      { itemId: 'ammo_box',      qty: 1,  rarity: 'grey',   chance: 65 },
    ],
  },
];

// ── สีและชื่อ rarity ─────────────────────────────────────────
var GACHA_RARITY = {
  gold:   { label: 'GOLD',   color: '#ffd700', glow: 'rgba(255,215,0,0.6)'   },
  purple: { label: 'PURPLE', color: '#ab47bc', glow: 'rgba(171,71,188,0.6)'  },
  blue:   { label: 'BLUE',   color: '#42a5f5', glow: 'rgba(66,165,245,0.6)'  },
  grey:   { label: 'GREY',   color: '#9e9e9e', glow: 'rgba(158,158,158,0.4)' },
};
