// ===== CONFIG_GACHA.JS =====
// ตั้งค่ากาชาทั้งหมด แก้ที่นี่ที่เดียวมีผลทุกที่
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
    color:    '#ff69b4',

    pool: [
      { itemId: 'snp_piggy',  qty: 1, rarity: 'blue',   chance: 7  },
      { itemId: 'asr_piggy',  qty: 1, rarity: 'green', chance: 11  },
      { itemId: 'body_piggy', qty: 1, rarity: 'green', chance: 11  },
      { itemId: 'head_piggy', qty: 1, rarity: 'green', chance: 11  },
      { itemId: 'snp_ppap',   qty: 1, rarity: 'grey',   chance: 20 },
      { itemId: 'body_ppap',  qty: 1, rarity: 'grey',   chance: 20 },
      { itemId: 'head_ppap',  qty: 1, rarity: 'grey',   chance: 20 },
    ],
  },
  {
    id:       'gacha_v1',
    name:     'GACHA V1',
    icon:     'assets/items/snp_evil.png',
    currency: 'point',
    price:    0.1,
    color:    '#42a5f5',

    pool: [
      { itemId: 'snp_evil',  qty: 1,  rarity: 'gold',   chance: 1  },
      { itemId: 'asr_evil',  qty: 1,  rarity: 'purple',   chance: 3  },
      { itemId: 'body_evil', qty: 1,  rarity: 'purple',   chance: 3  },
      { itemId: 'head_evil', qty: 1,  rarity: 'purple',   chance: 3  },
      { itemId: 'snp_piggy',  qty: 1, rarity: 'blue',   chance: 7  },
      { itemId: 'asr_piggy',  qty: 1, rarity: 'green', chance: 11  },
      { itemId: 'body_piggy', qty: 1, rarity: 'green', chance: 11  },
      { itemId: 'head_piggy', qty: 1, rarity: 'green', chance: 11  },
      { itemId: 'bandage',  minQty: 3, maxQty: 9, rarity: 'grey', chance: 25 },
      { itemId: 'ammo_box', minQty: 3, maxQty: 9, rarity: 'grey', chance: 25 },
    ],
  },
];

var GACHA_RARITY = {
  red:    { label: 'RED',    color: '#ff3333', glow: 'rgba(255,51,51,0.90)'    },
  gold:   { label: 'GOLD',   color: '#ffd700', glow: 'rgba(255,215,0,0.75)'    },
  purple: { label: 'PURPLE', color: '#ab47bc', glow: 'rgba(171,71,188,0.60)'  },
  blue:   { label: 'BLUE',   color: '#42a5f5', glow: 'rgba(66,165,245,0.45)'   },
  green:  { label: 'GREEN',  color: '#66bb6a', glow: 'rgba(102,187,106,0.30)' },
  grey:   { label: 'GREY',   color: '#9e9e9e', glow: 'rgba(158,158,158,0.15)' },
};
