// ===== CONFIG_GACHA.JS =====
// ตั้งค่ากาชาทั้งหมด แก้ที่นี่ที่เดียวมีผลทุกที่
//
// rarity:
//   'gold'   — หายากสุด   (แสดงเส้นสีทอง)
//   'purple' — หายาก      (แสดงเส้นสีม่วง)
//   'blue'   — ปานกลาง    (แสดงเส้นสีฟ้า)
//   'grey'   — ธรรมดา     (แสดงเส้นสีเทา)
//
// chance:  น้ำหนักการออก (ยิ่งมาก ยิ่งออกบ่อย)
// qty:     จำนวนคงที่  (ใช้เมื่อไม่ได้ระบุ minQty/maxQty)
// minQty:  จำนวนต่ำสุดของการสุ่ม  \  ถ้าระบุทั้งคู่จะสุ่มใน range นี้
// maxQty:  จำนวนสูงสุดของการสุ่ม  /  แทนการใช้ qty คงที่

var GACHA_CONFIG = [
  {
    id:       'gacha_event',
    name:     'GACHA EVENT',
    icon:     'assets/items/snp_piggy.png',
    currency: 'money',
    price:    1000,
    color:    '#ff33ff',

    pool: [
      { itemId: 'snp_piggy', qty: 1,  rarity: 'gold', chance: 4 },
      { itemId: 'asr_piggy', qty: 1,  rarity: 'purple', chance: 7 },
      { itemId: 'body_piggy', qty: 1,  rarity: 'purple', chance: 7 },
      { itemId: 'head_piggy', qty: 1,  rarity: 'purple', chance: 7 },
      { itemId: 'snp_ppap', qty: 1,  rarity: 'purple', chance: 25 },
      { itemId: 'body_ppap', qty: 1,  rarity: 'purple', chance: 25 },
      { itemId: 'head_ppap', qty: 1,  rarity: 'purple', chance: 25 },
    ],
  },
  {
    id:       'gacha_v1',
    name:     'GACHA V1',
    icon:     'assets/items/snp_evil.png',
    currency: 'point',
    price:    0.1,
    color:    '#c62828',

    pool: [
      { itemId: 'snp_evil',  qty: 1,  rarity: 'gold',   chance: 1  },
      { itemId: 'asr_evil',  qty: 1,  rarity: 'purple',   chance: 3  },
      { itemId: 'body_evil', qty: 1,  rarity: 'purple',   chance: 3  },
      { itemId: 'head_evil', qty: 1,  rarity: 'purple',   chance: 3  },
      { itemId: 'bandage',  minQty: 5, maxQty: 10, rarity: 'blue', chance: 15 },
      { itemId: 'ammo_box', minQty: 5, maxQty: 10, rarity: 'blue', chance: 15 },
      { itemId: 'bandage',  minQty: 1, maxQty: 5, rarity: 'grey', chance: 30 },
      { itemId: 'ammo_box', minQty: 1, maxQty: 5, rarity: 'grey', chance: 30 },
    ],
  },
];

var GACHA_RARITY = {
  gold:   { label: 'GOLD',   color: '#ffd700', glow: 'rgba(255,215,0,0.6)'   },
  purple: { label: 'PURPLE', color: '#ab47bc', glow: 'rgba(171,71,188,0.6)'  },
  blue:   { label: 'BLUE',   color: '#42a5f5', glow: 'rgba(66,165,245,0.6)'  },
  grey:   { label: 'GREY',   color: '#9e9e9e', glow: 'rgba(158,158,158,0.4)' },
};
