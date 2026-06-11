// ===== CONFIG_ENTITY.JS =====
// ตั้งค่า Entity (zombie, boss) ทั้งหมด แก้ที่นี่ที่เดียวมีผลทุกที่
// Entity ทำงาน client-side (ไม่ sync กับ server) เพราะเป็น PvE local

var ENTITY_CONFIG = {

  // ── Zombie ────────────────────────────────────────────────────────────────
  zombie: {
    r:           16,            // รัศมีตัว (px)
    hp:          100,            // HP
    speed:       1.0,           // px/frame
    damage:      12,            // ดาเมจต่อครั้งที่กัด
    attackRange: 22,            // ระยะกัด (px จากขอบถึงขอบ)
    attackRate:  1000,          // ms ระหว่างการโจมตี
    detectRange: 350,           // ระยะมองเห็น player
    color:       '#4a7c59',     // สีตัว
    eyeColor:    '#ff4444',     // สีตาแดง
    label:       'ZOMBIE',
    labelColor:  '#88ff88',
    reward:      { money: 10, point: 0 }, // ให้รางวัลเมื่อตาย

    // spawn: จำนวน + zone สุ่มใน world_airport (ห่างจากกลาง)
    spawnCount:  30,            // จำนวน zombie ที่สุ่มสร้างตอน init
    respawnTime: 15000,         // ms รอก่อน respawn ซอมบี้ที่ตายแล้ว
  },

  // ── Boss ──────────────────────────────────────────────────────────────────
  boss: {
    r:           36,            // รัศมีตัว (ใหญ่กว่า zombie)
    hp:          5000,           // HP สูง
    speed:       1.5,           // เร็วกว่า zombie เล็กน้อย
    damage:      35,            // ดาเมจต่อครั้ง
    attackRange: 44,            // ระยะโจมตี
    attackRate:  1500,          // ms ระหว่างโจมตี (ช้ากว่า zombie)
    detectRange: 500,           // มองไกลกว่า
    color:       '#8b0000',     // แดงเลือด
    eyeColor:    '#ffff00',     // ตาเหลือง
    outlineColor:'#ff6600',     // ขอบสีส้ม
    label:       '☠ BOSS',
    labelColor:  '#ff4400',
    reward:      { money: 100, point: 0 },

    // boss เกิดที่กลาง world_airport เสมอ (x≈3000, y≈3000)
    spawnX:      3000,
    spawnY:      3000,
    respawnTime: 60000,         // ms รอ 60 วิก่อน boss respawn
  },
};
