// ===== CONFIG_CHARACTER.JS =====
// ตั้งค่าตัวละครทั้งหมด แก้ที่นี่ที่เดียวมีผลทุกที่
//
// stats คือ object ที่มี field ล้วนเป็น % bonus ทับค่า base ใน config.js:
//   speedPct  : เพิ่มความเร็วจาก CONFIG.PLAYER_SPEED (เช่น 10 = +10%)
//   reducePct : ลดดาเมจที่รับ เป็น % (เช่น 25 = รับดาเมจลด 25%)
//   regenPct  : เพิ่ม regen HP เป็น % ของ base regen (เช่น 10 = regen เร็วขึ้น 10%)

var CHARACTER_CONFIG = {};

var CHARACTERS = [
  {
    id: 'default',
    name: 'Default',
    icon: '🧍',
    color: '#2563EB',
    free: true,
    currency: 'money',
    price: 0,
    stats: { speedPct: 0, reducePct: 0, regenPct: 0 },
  },
  {
    id: 'yagi',
    name: 'Yagi',
    icon: 'assets/characters/yagi.png',
    iconType: 'image',
    color: '#A78BFA',
    free: false,
    currency: 'point',
    price: 100,
    stats: { speedPct: 30, reducePct: 0, regenPct: 1 },
  },
];

// ── export ให้ server (Node) เรียกใช้ได้ — ไม่กระทบฝั่ง browser ──
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CHARACTERS, CHARACTER_CONFIG };
}
