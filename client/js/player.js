// ===== PLAYER =====
// การวาดตัวละคร → model_character.js
// การวาดปืน      → model_weapon.js

function createPlayer(x, y) {
  return {
    x, y,
    r: CONFIG.PLAYER_R,
    speed: CONFIG.PLAYER_SPEED,
    angle: 0,
    color: '#2563EB',
    charId: 'default',   // id ตัวละครที่เลือก
    trail: [],
    walkTimer: 0,
    isMoving: false,
  };
}

function updatePlayer(player, dx, dy, aimAngle) {
  const W = CONFIG.WORLD;
  const { x: ndx, y: ndy } = normalizeVector(dx, dy);

  const nx = player.x + ndx * player.speed;
  const ny = player.y + ndy * player.speed;

  if (nx - player.r > 0 && nx + player.r < W && !wallCollide(nx, player.y, player.r))
    player.x = nx;
  if (ny - player.r > 0 && ny + player.r < W && !wallCollide(player.x, ny, player.r))
    player.y = ny;

  player.angle = aimAngle;

  const moving = dx !== 0 || dy !== 0;
  player.isMoving = moving;
  if (moving) player.walkTimer += 0.18;

  player.trail.push({ x: player.x, y: player.y });
  if (player.trail.length > 6) player.trail.shift();
}

function drawPlayer(ctx, player) {
  const { x, y, r, angle, color, trail } = player;
  const s = r / 22;

  // trail
  trail.forEach((p, i) => {
    ctx.globalAlpha = (i / trail.length) * 0.15;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * (i / trail.length), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // วาดตัวละครตาม charId (model_character.js)
  drawCharacterBody(ctx, player);

  // วาดปืน (model_weapon.js)
  drawGunOnPlayer(ctx, player);
}

// helper functions (roundRect, roundRectStroke, shadeColor) อยู่ใน model_character.js
