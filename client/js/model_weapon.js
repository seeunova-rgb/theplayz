// ===== MODEL_WEAPON.JS =====
// โมเดลการวาดอาวุธทั้งหมด (sprite ปืน, กระสุน, muzzle flash)
// dependencies: config.js, config_weapon.js, input.js

// ── sprite map: weaponId → Image ────────────────────────────
var _gunImgs = {};
// ปืนที่ sprite หันปากกระบอกอยู่ขวา (ตรงข้ามกับมาตรฐาน) ต้อง flip เพิ่ม
var _GUN_FLIP = {
  asr_blueact: true,
  asr_lucifer: true,
  snp_blueact: true,
  snp_evil: true,
  snp_lucifer: true,
};
var _GUN_SPRITES = {
  // ── RED DEVIL ──
  asr_reddevil: 'assets/items/asr_reddevil.png',
  snp_reddevil: 'assets/items/snp_reddevil.png',
  // ── PPAP ──
  snp_ppap:     'assets/items/snp_ppap.png',
  // ── BLUE ACT ──
  asr_blueact:  'assets/items/asr_blueact.png',
  snp_blueact:  'assets/items/snp_blueact.png',
  // ── CHICAGO ──
  asr_chicago:  'assets/items/asr_chicago.png',
  snp_chicago:  'assets/items/snp_chicago.png',
  // ── EVIL ──
  asr_evil:     'assets/items/asr_evil.png',
  snp_evil:     'assets/items/snp_evil.png',
  // ── LUCIFER ──
  asr_lucifer:  'assets/items/asr_lucifer.png',
  snp_lucifer:  'assets/items/snp_lucifer.png',
  // ── PIGGY ──
  asr_piggy:    'assets/items/asr_piggy.png',
  snp_piggy:    'assets/items/snp_piggy.png',
};
Object.keys(_GUN_SPRITES).forEach(function(id) {
  var img = new Image();
  img.src = _GUN_SPRITES[id];
  _gunImgs[id] = img;
});

function _getEquippedGunId(player) {
  if (player && player.gunId) return player.gunId;
  if (typeof Backpack === 'undefined') return null;
  var slot = Backpack.getEquippedInSlot('gun');
  if (!slot) return null;
  return slot || null;  // getEquippedInSlot คืน string id โดยตรง (ไม่ใช่ object)
}

// ── วาด sprite ปืนบน player ──────────────────────────────
function drawGunOnPlayer(ctx, player) {
  var gunId = _getEquippedGunId(player);
  if (!gunId) return;
  var _gunImg = _gunImgs[gunId];
  if (!_gunImg || !_gunImg.complete || _gunImg.naturalWidth === 0) return;
  var aiming = (player && typeof player.isAiming === 'boolean') ? player.isAiming : Input.isAiming();
  if (!aiming) return;

  const { x, y, r, angle } = player;
  const gunW = r * 4.4;
  const gunH = gunW * (_gunImg.naturalHeight / _gunImg.naturalWidth);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const flipped = Math.cos(angle) < 0;
  if (flipped) ctx.scale(1, -1);

  ctx.save();
  ctx.scale(-1, 1); // flip แนวนอน ให้ barrel ชี้ +x (ทิศ aim)
  const offsetY = r * 0.1;
  let drawX;
  if (_GUN_FLIP[gunId]) {
    // barrel อยู่ขวาของรูป → ไม่ต้อง scale(-1,1), วางให้ grip (left edge) ติดตัวละคร
    ctx.restore(); // ออกจาก scale(-1,1) block ที่ save ไว้
    ctx.save();
    drawX = r * 0.5;
  } else {
    // barrel อยู่ซ้ายของรูป → ใช้ scale(-1,1) แล้ว, grip (right edge) ติดตัวละคร
    drawX = -r * 0.1 - gunW;
  }
  ctx.drawImage(_gunImg, drawX, offsetY - gunH / 2, gunW, gunH);
  ctx.restore();

  ctx.restore();
}

// ── วาด muzzle flash ─────────────────────────────────────
function drawMuzzleFlash(ctx, player, muzzleFlash) {
  if (muzzleFlash <= 0) return;

  const { x, y, r, angle } = player;
  const fx     = x + Math.cos(angle) * r * 1.4;
  const fy     = y + Math.sin(angle) * r * 1.4;
  const flashR = r * 0.9 * (muzzleFlash / 4);

  const grad = ctx.createRadialGradient(fx, fy, 0, fx, fy, flashR);
  grad.addColorStop(0,   'rgba(255,220,80,0.95)');
  grad.addColorStop(0.4, 'rgba(255,100,30,0.6)');
  grad.addColorStop(1,   'rgba(255,60,0,0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(fx, fy, flashR, 0, Math.PI * 2);
  ctx.fill();
}

// ── วาดกระสุนทั้งหมด ─────────────────────────────────────
function drawBullets(ctx, bullets, player) {
  var gunId = _getEquippedGunId(player);
  var GUN = (gunId && WEAPON_CONFIG[gunId]) ? WEAPON_CONFIG[gunId] : WEAPON_CONFIG.snp_reddevil;

  bullets.forEach(b => {
    b.trail.forEach((p, i) => {
      ctx.globalAlpha = (i / b.trail.length) * 0.4;
      ctx.fillStyle   = GUN.trailColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, GUN.bulletR * (i / b.trail.length), 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.globalAlpha = 1;
    const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, GUN.bulletR * 1.5);
    grad.addColorStop(0,   '#fff');
    grad.addColorStop(0.3, GUN.color);
    grad.addColorStop(1,   'rgba(255,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(b.x, b.y, GUN.bulletR * 1.5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.globalAlpha = 1;
}
