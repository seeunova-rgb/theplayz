// ===== MODEL_CHARACTER.JS =====
// โมเดลการวาดตัวละครทั้งหมด แก้ที่นี่เพื่อเพิ่ม/แก้รูปลักษณ์ตัวละคร
// dependencies: (none — self-contained)

// ── drawing helpers ───────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  let tl, tr, br, bl;
  if (typeof r === 'number') { tl = tr = br = bl = r; }
  else { tl = r.tl||0; tr = r.tr||0; br = r.br||0; bl = r.bl||0; }
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.arcTo(x + w, y, x + w, y + tr, tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
  ctx.lineTo(x + bl, y + h);
  ctx.arcTo(x, y + h, x, y + h - bl, bl);
  ctx.lineTo(x, y + tl);
  ctx.arcTo(x, y, x + tl, y, tl);
  ctx.closePath();
}

function roundRectStroke(ctx, x, y, w, h, r) {
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();
}

function shadeColor(hex, amount) {
  let r = parseInt(hex.slice(1,3),16);
  let g = parseInt(hex.slice(3,5),16);
  let b = parseInt(hex.slice(5,7),16);
  r = Math.max(0, Math.min(255, r + amount));
  g = Math.max(0, Math.min(255, g + amount));
  b = Math.max(0, Math.min(255, b + amount));
  return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
}

// ── วาด Default ───────────────────────────────────────────
function _drawBodyDefault(ctx, player) {
  const { x, y, r, color, walkTimer } = player;
  const s = r / 22;
  const legSwing = Math.sin(walkTimer) * 6 * s;

  ctx.save();
  ctx.translate(x, y);

  // LEGS
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.ellipse(-8*s, 22*s + legSwing, 7*s, 11*s, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse( 8*s, 22*s - legSwing, 7*s, 11*s, 0, 0, Math.PI*2); ctx.fill();

  // BODY
  const bw=38*s, bh=46*s, bx=-bw/2, by=-bh/2, brad=9*s;
  ctx.fillStyle = color;
  roundRect(ctx, bx, by+bh*0.52, bw, bh*0.48, {bl:brad,br:brad,tl:0,tr:0}); ctx.fill();
  ctx.fillStyle = '#F2D8A8';
  roundRect(ctx, bx, by, bw, bh*0.52, {tl:brad,tr:brad,bl:0,br:0}); ctx.fill();
  ctx.strokeStyle='#111'; ctx.lineWidth=2.5*s;
  roundRectStroke(ctx, bx, by, bw, bh, brad);
  ctx.strokeStyle='#111'; ctx.lineWidth=2*s;
  ctx.beginPath(); ctx.moveTo(bx, by+bh*0.52); ctx.lineTo(bx+bw, by+bh*0.52); ctx.stroke();
  // pocket
  ctx.fillStyle = shadeColor(color,-20); ctx.strokeStyle='#111'; ctx.lineWidth=1.5*s;
  roundRect(ctx, bx+4*s, by+bh*0.58, 11*s, 9*s, 3*s); ctx.fill(); ctx.stroke();
  // EYES
  const eyeY = by+bh*0.28;
  ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(-9*s,eyeY,5.5*s,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(-7.5*s,eyeY-2*s,2*s,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(9*s,eyeY,5.5*s,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(10.5*s,eyeY-2*s,2*s,0,Math.PI*2); ctx.fill();
  // SMILE
  ctx.strokeStyle='#111'; ctx.lineWidth=2*s; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(-7*s,by+bh*0.44); ctx.quadraticCurveTo(0,by+bh*0.52,7*s,by+bh*0.44); ctx.stroke();
  // highlight
  ctx.fillStyle='rgba(255,255,255,0.18)';
  ctx.beginPath(); ctx.ellipse(-6*s, by+bh*0.12, 8*s, 5*s, -0.3, 0, Math.PI*2); ctx.fill();

  ctx.restore();
}

// ── วาด Yagi ──────────────────────────────────────────────
// ใช้โครงสร้างเดียวกับ Default ทุกอย่าง ต่างกันแค่สกิน:
//   - ผมสีบลอนด์ทับหน้าผาก
//   - ตาสีฟ้า + เปลือกตาบนเข้ม
//   - ไม่มีกระเป๋า → มีแถบสีคาดหน้าอก
function _drawBodyYagi(ctx, player) {
  const { x, y, r, color, walkTimer } = player;
  const s = r / 22;
  const legSwing = Math.sin(walkTimer) * 6 * s;

  ctx.save();
  ctx.translate(x, y);

  // LEGS (เหมือน Default)
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.ellipse(-8*s, 22*s + legSwing, 7*s, 11*s, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse( 8*s, 22*s - legSwing, 7*s, 11*s, 0, 0, Math.PI*2); ctx.fill();

  // BODY (เหมือน Default)
  const bw=38*s, bh=46*s, bx=-bw/2, by=-bh/2, brad=9*s;
  ctx.fillStyle = color;
  roundRect(ctx, bx, by+bh*0.52, bw, bh*0.48, {bl:brad,br:brad,tl:0,tr:0}); ctx.fill();
  ctx.fillStyle = '#F2D8A8';
  roundRect(ctx, bx, by, bw, bh*0.52, {tl:brad,tr:brad,bl:0,br:0}); ctx.fill();
  ctx.strokeStyle='#111'; ctx.lineWidth=2.5*s;
  roundRectStroke(ctx, bx, by, bw, bh, brad);
  ctx.strokeStyle='#111'; ctx.lineWidth=2*s;
  ctx.beginPath(); ctx.moveTo(bx, by+bh*0.52); ctx.lineTo(bx+bw, by+bh*0.52); ctx.stroke();
  // แถบคาดหน้าอก (แทนกระเป๋า)
  ctx.fillStyle = shadeColor(color, -30); ctx.strokeStyle='#111'; ctx.lineWidth=1.5*s;
  roundRect(ctx, bx+4*s, by+bh*0.58, bw-8*s, 5*s, 2*s); ctx.fill(); ctx.stroke();

  // EYES (เหมือน Default แต่ม่านตาสีฟ้า)
  const eyeY = by+bh*0.28;
  ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(-9*s,eyeY,5.5*s,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#60A5FA'; ctx.beginPath(); ctx.arc(-9*s,eyeY,3.5*s,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(-7.5*s,eyeY-2*s,2*s,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(9*s,eyeY,5.5*s,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#60A5FA'; ctx.beginPath(); ctx.arc(9*s,eyeY,3.5*s,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(10.5*s,eyeY-2*s,2*s,0,Math.PI*2); ctx.fill();
  // เปลือกตาบนเข้ม
  ctx.strokeStyle='#111'; ctx.lineWidth=2*s; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(-15*s,eyeY-3*s); ctx.lineTo(-3*s,eyeY-5*s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(3*s,eyeY-5*s); ctx.lineTo(15*s,eyeY-3*s); ctx.stroke();

  // SMILE (เหมือน Default)
  ctx.strokeStyle='#111'; ctx.lineWidth=2*s; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(-7*s,by+bh*0.44); ctx.quadraticCurveTo(0,by+bh*0.52,7*s,by+bh*0.44); ctx.stroke();

  // ผมสีบลอนด์ทับหน้าผาก (วาดทับหลังสุด ให้อยู่หน้า body)
  const hc = '#D4A017';
  ctx.fillStyle = hc;
  ctx.beginPath();
  ctx.moveTo(-19*s, by+2*s);
  ctx.quadraticCurveTo(-16*s, by-8*s, -10*s, by-6*s);
  ctx.quadraticCurveTo(-4*s,  by-4*s,  0,    by-3*s);
  ctx.quadraticCurveTo( 4*s,  by-4*s, 10*s,  by-6*s);
  ctx.quadraticCurveTo(16*s,  by-8*s, 19*s,  by+2*s);
  ctx.quadraticCurveTo(0, by+6*s, -19*s, by+2*s);
  ctx.closePath(); ctx.fill();
  // เส้นผม
  ctx.strokeStyle = shadeColor(hc, -40); ctx.lineWidth = 1.2*s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-8*s, by-3*s); ctx.quadraticCurveTo(-6*s, by+3*s, -5*s, by+8*s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo( 0,   by-3*s); ctx.quadraticCurveTo( 1*s, by+3*s,  2*s, by+8*s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo( 8*s, by-3*s); ctx.quadraticCurveTo( 7*s, by+3*s,  6*s, by+8*s); ctx.stroke();

  // highlight (เหมือน Default)
  ctx.fillStyle='rgba(255,255,255,0.18)';
  ctx.beginPath(); ctx.ellipse(-6*s, by+bh*0.12, 8*s, 5*s, -0.3, 0, Math.PI*2); ctx.fill();

  ctx.restore();
}

// ── dispatch: map charId → draw function ──────────────────
// เพิ่มตัวละครใหม่: ลงทะเบียนที่นี่
var _charDrawers = {
  'default': _drawBodyDefault,
  'yagi':    _drawBodyYagi,
};

// ── API สาธารณะ ────────────────────────────────────────────
// drawCharacterBody(ctx, player) — วาดตัวละครตาม player.charId
function drawCharacterBody(ctx, player) {
  const drawFn = _charDrawers[player.charId] ?? _drawBodyDefault;
  drawFn(ctx, player);
}
