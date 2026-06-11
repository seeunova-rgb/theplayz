// ===== WORLD.JS =====
// Core engine: collision, drawWorld, drawMinimap
// Layout ของแต่ละโลกอยู่ใน:
//   world_safezone.js  → _layoutSafezone()
//   world_airport.js   → _layoutAirport(), getAirportSpawn()
//   world_snow.js      → _layoutSnow()
//
// ─── สรุปบัคที่แก้ ───────────────────────────────────────
// บัค 1 (safezone)  : สะพานเดินข้ามไม่ได้
//   → ขยาย bridge hitbox ใน world_safezone.js ออกข้างละ 10px
//     เพิ่ม _onBridge margin 8px เพื่อรองรับ player r=18
// บัค 2 (airport)   : ตัวละครเกิดใน object เดินไม่ได้
//   → spawn ใช้ getAirportSpawn() จาก world_airport.js
//     แทน CONFIG.WORLD/2 ที่ตรงกับ Control Tower
// บัค 3 (snow)      : trees is not defined
//   → ประกาศ const trees = [] ใน _layoutSnow() แล้ว
//     (world_snow.js บรรทัดที่ 2)

// ─────────────────────────────────────────────────────────
// helper: สร้างผนังบ้านจาก bounding box + ขนาดช่องประตู
// ─────────────────────────────────────────────────────────
function _houseWalls(bx, by, bw, bh, wallT, doorW, doorSide) {
  const walls = [];
  const halfDoor = doorW / 2;
  const midX = bx + bw / 2;

  walls.push({ x: bx,              y: by, w: wallT, h: bh });
  walls.push({ x: bx + bw - wallT, y: by, w: wallT, h: bh });
  walls.push({ x: bx, y: by, w: bw, h: wallT });

  if (doorSide === 'S') {
    walls.push({ x: bx,              y: by + bh - wallT, w: midX - bx - halfDoor,         h: wallT });
    walls.push({ x: midX + halfDoor, y: by + bh - wallT, w: bx + bw - (midX + halfDoor),  h: wallT });
  } else {
    walls.push({ x: bx,              y: by, w: midX - bx - halfDoor,        h: wallT });
    walls.push({ x: midX + halfDoor, y: by, w: bx + bw - (midX + halfDoor), h: wallT });
    walls.push({ x: bx, y: by + bh - wallT, w: bw, h: wallT });
  }
  return walls;
}

// ─────────────────────────────────────────────────────────
// LAYOUT — เรียก _layout* จากไฟล์แยก
// ─────────────────────────────────────────────────────────
function getWorldLayout(worldId) {
  if (worldId === 'airport') return _layoutAirport();
  if (worldId === 'snow')    return _layoutSnow();
  return _layoutSafezone();
}

// ─────────────────────────────────────────────────────────
// buildWalls — รวม collision rects จาก layout
// ─────────────────────────────────────────────────────────
function buildWalls(worldId) {
  const L   = getWorldLayout(worldId);
  const all = [];

  // แม่น้ำ: frozen=true → ไม่ใส่ collision (เดินข้ามได้)
  L.rivers.forEach(r => { if (!r.frozen) all.push(r); });

  L.housesSmall.forEach(h => {
    _houseWalls(h.x, h.y, 160, 160, 14, 60, 'S').forEach(w => all.push(w));
  });
  L.housesBig.forEach(h => {
    _houseWalls(h.x, h.y, 240, 200, 16, 70, 'S').forEach(w => all.push(w));
  });

  L.buildings.forEach(b  => all.push(b));
  L.fences.forEach(f     => all.push(f));
  L.barricades.forEach(b => all.push(b));

  return all;
}

// ─────────────────────────────────────────────────────────
// state ที่ใช้จริงใน game — โหลดตอน initWorldCollision
// ─────────────────────────────────────────────────────────
let _WALLS   = [];
let _RIVERS  = [];
let _BRIDGES = [];

function initWorldCollision(worldId) {
  const L  = getWorldLayout(worldId);
  _WALLS   = buildWalls(worldId);
  _RIVERS  = L.rivers;
  _BRIDGES = L.bridges;
}

// fallback ถ้าไม่เคย init
if (typeof window._selectedWorldId === 'undefined') {
  initWorldCollision('safezone');
}

// ─────────────────────────────────────────────────────────
// collision
// ─────────────────────────────────────────────────────────

// FIX บัค 1: เพิ่ม BRIDGE_MARGIN 8px เพื่อให้ player (r=18)
// ถือว่า "บนสะพาน" ก่อนที่จะชนขอบ river จริงๆ
const _BRIDGE_MARGIN = 20;

function _onBridge(cx, cy, r) {
  const m = r + _BRIDGE_MARGIN;
  for (const b of _BRIDGES) {
    if (cx + m > b.x && cx - m < b.x + b.w &&
        cy + m > b.y && cy - m < b.y + b.h) return true;
  }
  return false;
}

function wallCollide(cx, cy, r) {
  for (const w of _WALLS) {
    const nearX = clamp(cx, w.x, w.x + w.w);
    const nearY = clamp(cy, w.y, w.y + w.h);
    if (dist(cx, cy, nearX, nearY) < r) {
      const isRiver = _RIVERS.some(rv => rv === w);
      if (isRiver && _onBridge(cx, cy, r)) continue;
      return true;
    }
  }
  return false;
}

// ─────────────────────────────────────────────────────────
// drawWorld
// ─────────────────────────────────────────────────────────
function drawWorld(ctx) {
  const W  = CONFIG.WORLD;
  const wid = window._selectedWorldId || 'safezone';
  const wc  = (typeof getWorldConfig !== 'undefined') ? getWorldConfig(wid) : {
    groundColor:'#4a7c3f', groundColor2:'#3d6b34', riverColor:'#1a6fa8',
    buildingColor:'#8a8a8a', wallColor:'#d4c4a0', roofColor:'#9b4f2a',
    borderColor:'#ff2222',
  };
  const L   = getWorldLayout(wid);

  // ── พื้น ─────────────────────────────────────────────
  ctx.fillStyle = wc.groundColor;
  ctx.fillRect(0, 0, W, W);

  if (wid === 'safezone') {
    ctx.fillStyle   = wc.groundColor2;
    ctx.globalAlpha = 0.18;
    for (let i = 0; i < W; i += 120) ctx.fillRect(i, 0, 60, W);
    ctx.globalAlpha = 1;
  } else if (wid === 'airport') {
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth   = 1;
    for (let i = 0; i < 40; i++) {
      const sx = (i * 317) % W, sy = (i * 491) % W;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + ((i * 73) % 200) - 100, sy + ((i * 59) % 200) - 100);
      ctx.stroke();
    }
  } else if (wid === 'snow') {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    for (let i = 0; i < W; i += 80) {
      for (let j = 0; j < W; j += 80) {
        const ox = (i * 7 + j * 3) % 60;
        const oy = (i * 11 + j * 5) % 60;
        ctx.beginPath();
        ctx.arc(i + ox, j + oy, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    L.icePatches.forEach(ip => {
      ctx.fillStyle   = 'rgba(160,210,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(ip.x + ip.w/2, ip.y + ip.h/2, ip.w/2, ip.h/2, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(100,170,255,0.5)';
      ctx.lineWidth   = 1.5;
      ctx.stroke();
    });
  }

  // ── Tarmac (airport) ─────────────────────────────────
  if (wid === 'airport') {
    L.tarmacs.forEach(t => {
      ctx.fillStyle = '#3a3a2e';
      ctx.fillRect(t.x, t.y, t.w, t.h);
      ctx.strokeStyle   = '#e8c030';
      ctx.lineWidth     = 4;
      ctx.setLineDash([60, 40]);
      ctx.beginPath();
      if (t.w > t.h) {
        ctx.moveTo(t.x, t.y + t.h / 2);
        ctx.lineTo(t.x + t.w, t.y + t.h / 2);
      } else {
        ctx.moveTo(t.x + t.w / 2, t.y);
        ctx.lineTo(t.x + t.w / 2, t.y + t.h);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }

  // ── แม่น้ำ ────────────────────────────────────────────
  L.rivers.forEach(r => {
    if (wid === 'snow' || r.frozen) {
      ctx.fillStyle = wc.riverColor || '#8ab8d8';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth   = 1.5;
      const isH = r.w > r.h;
      for (let i = 0; i < (isH ? r.w : r.h); i += 200) {
        const base = isH ? r.x + i : r.y + i;
        ctx.beginPath();
        if (isH) {
          ctx.moveTo(base + 30, r.y + r.h * 0.2);
          ctx.lineTo(base + 80, r.y + r.h * 0.6);
          ctx.lineTo(base + 140, r.y + r.h * 0.3);
        } else {
          ctx.moveTo(r.x + r.w * 0.2, base + 30);
          ctx.lineTo(r.x + r.w * 0.6, base + 80);
          ctx.lineTo(r.x + r.w * 0.3, base + 140);
        }
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(100,160,200,0.4)';
      ctx.lineWidth   = 2;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    } else {
      ctx.fillStyle = wc.riverColor || '#1a6fa8';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = 'rgba(100,200,255,0.12)';
      const isH = r.w > r.h;
      for (let i = 0; i < (isH ? r.w : r.h); i += 120) {
        if (isH) ctx.fillRect(r.x + i, r.y + 10, 60, r.h - 20);
        else     ctx.fillRect(r.x + 10, r.y + i, r.w - 20, 60);
      }
      ctx.strokeStyle = '#0e4f7a';
      ctx.lineWidth   = 3;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    }
  });

  // ── สะพาน (safezone) ──────────────────────────────────
  L.bridges.forEach(b => {
    ctx.fillStyle = '#b5874a';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = '#8a6030';
    ctx.lineWidth   = 2;
    const isH = b.w > b.h;
    const step = isH ? b.w / 5 : b.h / 5;
    for (let i = 1; i < 5; i++) {
      ctx.beginPath();
      if (isH) { ctx.moveTo(b.x + step * i, b.y); ctx.lineTo(b.x + step * i, b.y + b.h); }
      else     { ctx.moveTo(b.x, b.y + step * i); ctx.lineTo(b.x + b.w, b.y + step * i); }
      ctx.stroke();
    }
    ctx.strokeStyle = '#6b4820'; ctx.lineWidth = 4;
    if (isH) { ctx.strokeRect(b.x, b.y, b.w, 6); ctx.strokeRect(b.x, b.y + b.h - 6, b.w, 6); }
    else     { ctx.strokeRect(b.x, b.y, 6, b.h); ctx.strokeRect(b.x + b.w - 6, b.y, 6, b.h); }
  });

  // ── บ้านเล็ก (safezone) ───────────────────────────────
  L.housesSmall.forEach(h => {
    const bx = h.x, by = h.y, bw = 160, bh = 160;
    ctx.fillStyle = wc.wallColor || '#c8b89a';
    ctx.fillRect(bx + 14, by + 14, bw - 28, bh - 28);
    ctx.fillStyle = wc.wallColor || '#d4c4a0';
    _houseWalls(bx, by, bw, bh, 14, 60, 'S').forEach(w => {
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.strokeStyle = '#a09070'; ctx.lineWidth = 1.5;
      ctx.strokeRect(w.x, w.y, w.w, w.h);
    });
    ctx.fillStyle   = wc.roofColor || '#9b4f2a';
    ctx.fillRect(bx + 5, by - 12, bw - 10, 18);
    ctx.strokeStyle = '#7a3a1a'; ctx.lineWidth = 1.5;
    ctx.strokeRect(bx + 5, by - 12, bw - 10, 18);
  });

  // ── บ้านใหญ่ (safezone) ───────────────────────────────
  L.housesBig.forEach(h => {
    const bx = h.x, by = h.y, bw = 240, bh = 200;
    ctx.fillStyle = wc.wallColor || '#b8a88a';
    ctx.fillRect(bx + 16, by + 16, bw - 32, bh - 32);
    ctx.fillStyle = wc.wallColor || '#ccc0a0';
    _houseWalls(bx, by, bw, bh, 16, 70, 'S').forEach(w => {
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.strokeStyle = '#a09070'; ctx.lineWidth = 2;
      ctx.strokeRect(w.x, w.y, w.w, w.h);
    });
    ctx.fillStyle   = wc.roofColor || '#7a3010';
    ctx.fillRect(bx + 6, by - 14, bw - 12, 20);
    ctx.strokeStyle = '#5a2008'; ctx.lineWidth = 2;
    ctx.strokeRect(bx + 6, by - 14, bw - 12, 20);
    ctx.fillStyle   = '#aed6f1';
    ctx.fillRect(bx + 30, by + 40, 30, 25);
    ctx.fillRect(bx + bw - 60, by + 40, 30, 25);
    ctx.strokeStyle = '#7a5030'; ctx.lineWidth = 1.5;
    ctx.strokeRect(bx + 30, by + 40, 30, 25);
    ctx.strokeRect(bx + bw - 60, by + 40, 30, 25);
  });

  // ── ต้นไม้ (safezone) ─────────────────────────────────
  if (wid === 'safezone') {
    L.trees.forEach(t => {
      ctx.fillStyle   = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.ellipse(t.x + 5, t.y + 5, 22, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6b3f1a';
      ctx.fillRect(t.x - 5, t.y - 8, 10, 20);
      ctx.fillStyle = '#2d6e2a';
      ctx.beginPath();
      ctx.arc(t.x, t.y - 10, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a8a35';
      ctx.beginPath();
      ctx.arc(t.x - 8, t.y - 16, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(t.x + 8, t.y - 18, 12, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // ── อาคาร (safezone) / Hangar (airport) ──────────────
  if (wid === 'safezone') {
    L.buildings.forEach(b => {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x + 8, b.y + 8, b.w, b.h);
      ctx.fillStyle = wc.buildingColor || '#8a8a8a';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = '#9a9a9a';
      ctx.fillRect(b.x, b.y, b.w, 20);
      ctx.fillStyle = '#aed6f1';
      const cols = Math.floor(b.w / 70), rows = Math.floor(b.h / 70);
      for (let ci = 0; ci < cols; ci++)
        for (let ri = 0; ri < rows; ri++)
          ctx.fillRect(b.x + 15 + ci * 70, b.y + 25 + ri * 70, 28, 22);
      ctx.strokeStyle = '#4a4a4a'; ctx.lineWidth = 2.5;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
    });
  } else if (wid === 'airport') {
    L.hangars.forEach(h => {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(h.x + 10, h.y + 10, h.w, h.h);
      ctx.fillStyle = wc.buildingColor || '#6a6a5a';
      ctx.fillRect(h.x, h.y, h.w, h.h);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      const stripeCount = Math.floor(h.w / 40);
      for (let i = 0; i < stripeCount; i++)
        ctx.fillRect(h.x + i * 40, h.y, 20, h.h);
      ctx.fillStyle = '#3a3a30';
      const dw = Math.min(h.w * 0.5, 200);
      ctx.fillRect(h.x + (h.w - dw) / 2, h.y + h.h - 30, dw, 30);
      ctx.strokeStyle = '#4a4a3a'; ctx.lineWidth = 3;
      ctx.strokeRect(h.x, h.y, h.w, h.h);
    });
  }

  // ── รั้ว (airport) ────────────────────────────────────
  if (wid === 'airport') {
    L.fences.forEach(f => {
      ctx.fillStyle   = '#7a7a6a';
      ctx.fillRect(f.x, f.y, f.w, f.h);
      ctx.fillStyle   = '#9a9a8a';
      const isH = f.w > f.h;
      for (let i = 0; i < (isH ? f.w : f.h); i += 60) {
        if (isH) ctx.fillRect(f.x + i, f.y - 6, 6, f.h + 12);
        else     ctx.fillRect(f.x - 6, f.y + i, f.w + 12, 6);
      }
      ctx.strokeStyle = '#5a5a4a'; ctx.lineWidth = 1;
      ctx.strokeRect(f.x, f.y, f.w, f.h);
    });

    L.craters.forEach(c => {
      ctx.fillStyle   = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle   = '#2a2820';
      ctx.beginPath(); ctx.arc(c.x, c.y, c.r * 0.75, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#4a4840'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#6a6858';
      ctx.fillRect(c.x - c.r * 0.9, c.y - 8, c.r * 0.6, 16);
      ctx.fillRect(c.x + c.r * 0.3, c.y - 6, c.r * 0.5, 12);
    });
  }

  // ── กำแพงหิมะ / ป้อม (snow) ──────────────────────────
  if (wid === 'snow') {
    L.snowMounds.forEach(m => {
      ctx.fillStyle   = 'rgba(0,0,0,0.1)';
      ctx.fillRect(m.x + 4, m.y + 4, m.w, m.h);
      ctx.fillStyle   = '#f0f8ff';
      ctx.fillRect(m.x, m.y, m.w, m.h);
      ctx.fillStyle   = 'rgba(150,180,220,0.4)';
      ctx.fillRect(m.x, m.y, m.w, m.h * 0.4);
      ctx.strokeStyle = '#c0d8f0'; ctx.lineWidth = 1.5;
      ctx.strokeRect(m.x, m.y, m.w, m.h);
    });
    const regularBarricades = L.barricades.filter(b => b.w <= 110 && b.h <= 110);
    regularBarricades.forEach(b => {
      ctx.fillStyle   = 'rgba(0,0,0,0.08)';
      ctx.fillRect(b.x + 3, b.y + 3, b.w, b.h);
      ctx.fillStyle   = '#e8f4ff';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = '#b0c8e0'; ctx.lineWidth = 1.5;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
    });
    const fortBarricades = L.barricades.filter(b => !(b.w <= 110 && b.h <= 110));
    fortBarricades.forEach(b => {
      ctx.fillStyle   = 'rgba(0,0,0,0.12)';
      ctx.fillRect(b.x + 4, b.y + 4, b.w, b.h);
      ctx.fillStyle   = '#ddeeff';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = '#c0d8f0'; ctx.lineWidth = 1;
      const blockSize = 35;
      for (let bxi = b.x; bxi < b.x + b.w; bxi += blockSize)
        for (let byi = b.y; byi < b.y + b.h; byi += blockSize)
          ctx.strokeRect(bxi, byi, Math.min(blockSize, b.x + b.w - bxi), Math.min(blockSize, b.y + b.h - byi));
      ctx.strokeStyle = '#a0c0e0'; ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
    });
  }

  // ── Barricade (safezone + airport) ───────────────────
  if (wid !== 'snow') {
    L.barricades.forEach(b => {
      if (wid === 'airport') {
        const colors = ['#c0392b','#2980b9','#27ae60','#7f8c8d','#e67e22'];
        const ci = Math.abs(Math.round(b.x / 100 + b.y / 100)) % colors.length;
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(b.x + 4, b.y + 4, b.w, b.h);
        ctx.fillStyle = colors[ci];
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5;
        ctx.strokeRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1;
        const s = b.w > b.h ? b.w / 3 : b.h / 3;
        for (let i = 1; i < 3; i++) {
          ctx.beginPath();
          if (b.w > b.h) { ctx.moveTo(b.x + s*i, b.y); ctx.lineTo(b.x + s*i, b.y + b.h); }
          else            { ctx.moveTo(b.x, b.y + s*i); ctx.lineTo(b.x + b.w, b.y + s*i); }
          ctx.stroke();
        }
      } else {
        ctx.fillStyle   = '#c8a040';
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = '#8a6820'; ctx.lineWidth = 1.5;
        ctx.strokeRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = '#8a6820'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + b.w, b.y + b.h); ctx.stroke();
      }
    });
  }

  // ── Safe Zone (safezone) ──────────────────────────────
  if (wc.hasSafeZone && wc.safeZone) {
    const sz = wc.safeZone;
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle   = '#4caf50';
    ctx.beginPath(); ctx.arc(sz.x, sz.y, sz.r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#4caf50'; ctx.lineWidth = 3;
    ctx.setLineDash([20, 12]); ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.arc(sz.x, sz.y, sz.r, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    ctx.fillStyle   = '#4caf50'; ctx.globalAlpha = 0.90;
    ctx.font        = 'bold 32px Rajdhani'; ctx.textAlign = 'center';
    ctx.fillText('⛔ SAFE ZONE — ห้ามยิง', sz.x, sz.y - sz.r - 14);
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
  }

  // ── border ────────────────────────────────────────────
  ctx.strokeStyle = wc.borderColor || '#ff2222';
  ctx.lineWidth   = 6;
  ctx.strokeRect(3, 3, W - 6, W - 6);
}

// ─────────────────────────────────────────────────────────
// drawMinimap
// ─────────────────────────────────────────────────────────
function drawMinimap(ctx, canvas, player) {
  const mw = 120, mh = 120;
  const mx = canvas.width - mw - 10, my = 10;
  const scale = mw / CONFIG.WORLD;
  const wid = window._selectedWorldId || 'safezone';
  const wc  = (typeof getWorldConfig !== 'undefined') ? getWorldConfig(wid) : { groundColor:'#1e3a1e', riverColor:'#1a6fa8' };
  const L   = getWorldLayout(wid);

  ctx.fillStyle = 'rgba(20,30,20,0.85)';
  ctx.fillRect(mx, my, mw, mh);

  ctx.fillStyle = wc.riverColor || '#1a6fa8';
  L.rivers.forEach(r => ctx.fillRect(mx + r.x * scale, my + r.y * scale, r.w * scale, r.h * scale));

  ctx.fillStyle = '#b5874a';
  L.bridges.forEach(b => ctx.fillRect(mx + b.x * scale, my + b.y * scale, b.w * scale, b.h * scale));

  ctx.fillStyle = wc.wallColor || '#d4c4a0';
  L.housesSmall.forEach(h => ctx.fillRect(mx + h.x * scale, my + h.y * scale, 160 * scale, 160 * scale));
  L.housesBig.forEach(h   => ctx.fillRect(mx + h.x * scale, my + h.y * scale, 240 * scale, 200 * scale));

  ctx.fillStyle = wc.buildingColor || '#8a8a8a';
  L.buildings.forEach(b => ctx.fillRect(mx + b.x * scale, my + b.y * scale, b.w * scale, b.h * scale));
  if (wid === 'airport') {
    L.hangars.forEach(h => ctx.fillRect(mx + h.x * scale, my + h.y * scale, h.w * scale, h.h * scale));
    L.tarmacs.forEach(t => {
      ctx.fillStyle = '#3a3a2e';
      ctx.fillRect(mx + t.x * scale, my + t.y * scale, t.w * scale, t.h * scale);
      ctx.fillStyle = wc.buildingColor || '#8a8a8a';
    });
  }

  if (wid === 'snow') {
    ctx.fillStyle = '#ddeeff';
    L.snowMounds.forEach(m => ctx.fillRect(mx + m.x * scale, my + m.y * scale, m.w * scale, m.h * scale));
  }

  if (wc.hasSafeZone && wc.safeZone) {
    const sz = wc.safeZone;
    ctx.strokeStyle = '#4caf50'; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.arc(mx + sz.x * scale, my + sz.y * scale, sz.r * scale, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  const rps = (typeof Network !== 'undefined') ? Network.getRemotePlayers() : {};
  Object.values(rps).forEach(rp => {
    if (!rp.alive) return;
    ctx.fillStyle = rp.color || '#f88';
    ctx.beginPath(); ctx.arc(mx + rp.x * scale, my + rp.y * scale, 2, 0, Math.PI * 2); ctx.fill();
  });

  ctx.fillStyle = player.color;
  ctx.beginPath(); ctx.arc(mx + player.x * scale, my + player.y * scale, 3, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
  ctx.strokeRect(mx, my, mw, mh);

  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font      = '9px Rajdhani'; ctx.textAlign = 'center';
  ctx.fillText((wid || 'world').toUpperCase(), mx + mw / 2, my + mh + 12);
  ctx.textAlign = 'left';
}
