// ===== items.js =====
const SHOP_ITEMS = {
  weapon: [
    // ── PPAP ──
    {
      id:         'snp_ppap',
      name:       'SNP PPAP',
      icon:       '<img src="assets/items/snp_ppap.png" style="width:56px;height:auto;object-fit:contain;image-rendering:auto;">',
      currency:   'money',
      price:      () => GAME_CONFIG.PRICE_SNP_PPAP,
      consumable: true,
      noStackBP:  true,
      equip:      { type: 'weapon', img: 'assets/items/snp_ppap.png' },
      weaponId:   'snp_ppap',
    },
  ],
  knife: [],
  armor: [
    // ── PPAP ──
    {
      id:         'body_ppap',
      name:       'BODY PPAP',
      icon:       '<img src="assets/items/body_ppap.png" style="width:56px;height:auto;object-fit:contain;image-rendering:auto;">',
      currency:   'money',
      price:      () => GAME_CONFIG.PRICE_BODY_PPAP,
      consumable: true,
      noStackBP:  true,
      equip:      { type: 'armor', img: 'assets/items/body_ppap.png' },
      armorId:    'body_ppap',
      armor:      78,
    },
  ],
  helmet: [
    // ── PPAP ──
    {
      id:         'head_ppap',
      name:       'HEAD PPAP',
      icon:       '<img src="assets/items/head_ppap.png" style="width:56px;height:auto;object-fit:contain;image-rendering:auto;">',
      currency:   'money',
      price:      () => GAME_CONFIG.PRICE_HEAD_PPAP,
      consumable: true,
      noStackBP:  true,
      equip:      { type: 'helmet', img: 'assets/items/head_ppap.png' },
      armorId:    'head_ppap',
      armor:      79,
    },
  ],
  med: [
    {
      id:         'bandage',
      name:       'BANDAGE',
      icon:       '<img src="assets/items/bandage.png" style="width:32px;height:auto;object-fit:contain;">',
      currency:   'money',
      price:      () => GAME_CONFIG.PRICE_BANDAGE ?? 50,
      consumable: true,
      noStackBP:  true,
      equip:      { type: 'med' },
      heal:       100,
    },
  ],
  supply: [
    {
      id:         'ammo_box',
      name:       'AMMO BOX',
      icon:       '📦',
      currency:   'money',
      price:      () => GAME_CONFIG.PRICE_AMMO_BOX,
      consumable: true,
      noStackBP:  false,
      equip:      null,
    },
  ],
};
