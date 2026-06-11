// ===== CONFIG_WORLD.JS =====
// ตั้งค่าโลกทั้งหมด แก้ที่นี่ที่เดียวมีผลทุกที่

var WORLDS = [
  {
    id:          'safezone',
    name:        'SAFEZONE',
    tag:         'PVP',
    tagColor:    '#ef5350',
    desc:        'มีเซฟโซนกลางแผนที่ ภายในยิงกันไม่ได้',
    icon:        '🛡️',
    size:        6000,

    // ── ภาพ / สี ──────────────────────────────────────────
    groundColor:   '#4a7c3f',   // หญ้าสีเขียว
    groundColor2:  '#3d6b34',   // หญ้าสีเข้ม (stripe)
    riverColor:    '#1a6fa8',
    buildingColor: '#8a8a8a',
    wallColor:     '#d4c4a0',
    roofColor:     '#9b4f2a',
    borderColor:   '#ef5350',
    fogColor:      'rgba(10,12,15,0)',

    // ── Safe Zone ─────────────────────────────────────────
    hasSafeZone:       true,
    noShootInSafeZone: true,              // บล็อกการยิงจริงๆ (ไม่ใช่แค่บล็อกดาเมจ)
    safeZone: { x: 3000, y: 3000, r: 1200 },  // ขยายจาก 500 → 1200
  },

  {
    id:          'airport',
    name:        'AIRPORT',
    tag:         'PVP',
    tagColor:    '#ef5350',
    desc:        'สนามบินร้าง มีซอมบี้และบอสให้ฟาร์มไอเทม',
    icon:        '✈️',
    size:        6000,

    groundColor:   '#5a5a4a',   // คอนกรีตเก่า
    groundColor2:  '#4e4e40',
    riverColor:    '#2a2a22',   // ไม่มีแม่น้ำ — ใช้สีเดิมให้กลืน
    buildingColor: '#6a6a5a',
    wallColor:     '#aaa090',
    roofColor:     '#4a4a3a',
    borderColor:   '#ff9800',
    fogColor:      'rgba(10,10,5,0)',

    hasSafeZone:   false,
    safeZone:      null,
  },

  {
    id:          'snow',
    name:        'SNOW',
    tag:         'PVP',
    tagColor:    '#ef5350',
    desc:        'ทุ่งหิมะ ยิงกันได้ทุกที่ ไม่มีเซฟโซน',
    icon:        '❄️',
    size:        6000,

    groundColor:   '#dce8f0',   // หิมะขาว
    groundColor2:  '#c8d8e8',
    riverColor:    '#8ab8d8',   // น้ำแข็ง/แม่น้ำแช่แข็ง
    buildingColor: '#b0c8d8',
    wallColor:     '#e8f0f8',
    roofColor:     '#5588aa',
    borderColor:   '#4fc3f7',
    fogColor:      'rgba(200,220,240,0)',
  },
];

// helper: หา world config จาก id
function getWorldConfig(id) {
  return WORLDS.find(w => w.id === id) || WORLDS[0];
}
