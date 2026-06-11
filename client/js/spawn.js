// ===== SPAWN.JS =====
// ระบบหาจุดเกิดที่ปลอดภัย — ไม่ทับ wall/object
// depends: world.js (wallCollide, initWorldCollision), config_world.js

// ── หาจุดเกิดแบบ random ที่ไม่ทับ wall ─────────────────────────────────────
// กลยุทธ์:
//   safezone  → สุ่มภายใน circle ของ safeZone เท่านั้น
//   โลกอื่น   → สุ่มทั่วโลก หลีกเลี่ยง margin ขอบ 300px
// ลองสูงสุด MAX_TRIES ครั้ง ถ้าไม่ได้ก็ใช้ fallback กลางแผนที่

const _SPAWN_MAX_TRIES = 200;
const _SPAWN_R         = CONFIG.PLAYER_R;  // 18px
const _SPAWN_MARGIN    = 300;              // ห่างขอบแผนที่

function findSafeSpawn(worldId) {
  // โหลด collision ของโลกนั้นก่อน (กรณีเรียกก่อน initGame)
  if (typeof initWorldCollision !== 'undefined') {
    initWorldCollision(worldId);
  }

  const wc   = (typeof getWorldConfig !== 'undefined') ? getWorldConfig(worldId) : null;
  const W    = CONFIG.WORLD;

  // ── safezone: สุ่มภายใน safeZone circle ─────────────────────────────
  if (wc && wc.hasSafeZone && wc.safeZone) {
    const sz = wc.safeZone;
    // ลด radius นิดหนึ่งเพื่อให้อยู่ห่างจากขอบ safe zone
    const spawnR = sz.r - _SPAWN_R - 20;

    for (let i = 0; i < _SPAWN_MAX_TRIES; i++) {
      // สุ่มจุดในวงกลม (uniform distribution)
      const angle = Math.random() * Math.PI * 2;
      const dist  = Math.sqrt(Math.random()) * spawnR;
      const x     = sz.x + Math.cos(angle) * dist;
      const y     = sz.y + Math.sin(angle) * dist;

      if (_isSpawnValid(x, y)) return { x, y };
    }

    // fallback: จุดกลาง safeZone
    return { x: sz.x, y: sz.y };
  }

  // ── โลกอื่น: สุ่มทั่วโลก หลีกเลี่ยงขอบ ──────────────────────────────
  const minXY = _SPAWN_MARGIN;
  const maxXY = W - _SPAWN_MARGIN;

  for (let i = 0; i < _SPAWN_MAX_TRIES; i++) {
    const x = minXY + Math.random() * (maxXY - minXY);
    const y = minXY + Math.random() * (maxXY - minXY);

    if (_isSpawnValid(x, y)) return { x, y };
  }

  // fallback: กลางแผนที่
  return { x: W / 2, y: W / 2 };
}

// เช็คว่าจุด (x, y) ปลอดภัยหรือเปล่า — ไม่ทับ wall และอยู่ในแผนที่
function _isSpawnValid(x, y) {
  const W = CONFIG.WORLD;
  const r = _SPAWN_R;

  // ต้องอยู่ในแผนที่
  if (x - r < 0 || x + r > W || y - r < 0 || y + r > W) return false;

  // ต้องไม่ทับ wall (ใช้ wallCollide จาก world.js)
  if (typeof wallCollide !== 'undefined' && wallCollide(x, y, r + 4)) return false;

  return true;
}
