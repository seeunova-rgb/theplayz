// ===== SOCKET.JS =====
// จัดการ Socket.io events — แยก room ตาม worldId

const { players, WORLD, WORLD_IDS, socketWorld, world_drops, newDropId, saveDrops } = require('./gameState');
const { randomColor } = require('./utils');

// ── ค่า limit สำหรับ server-side validation ──────────────────────────────
const MAX_DAMAGE       = 1000;   // ดาเมจสูงสุดที่ยอมรับต่อนัด (กัน cheat ส่งค่าเกิน)
const MAX_SPEED_PX     = 30;    // ความเร็วสูงสุดที่ยอมรับต่อ tick (px) — กัน teleport
const TICK_INTERVAL_MS = 33;    // ~30 tick/s (network.js ส่งทุก 2 frame @ 60fps)

// broadcast online counts ให้ทุกคน
function broadcastCounts(io) {
  const counts = {};
  WORLD_IDS.forEach(id => {
    counts[id] = Object.keys(players[id]).length;
  });
  io.emit('world_counts', counts);
}

function initSocket(io) {
  io.on('connection', (socket) => {
    console.log(`Connected: ${socket.id}`);

    // ── join world room ─────────────────────────────────────
    socket.on('join_world', ({ worldId, spawnX, spawnY, name, color, charId }) => {
      const wid = WORLD_IDS.includes(worldId) ? worldId : 'safezone';

      socket.join(wid);
      socketWorld[socket.id] = wid;

      const sx = (typeof spawnX === 'number' && spawnX > 0) ? spawnX : 300 + Math.random() * (WORLD - 600);
      const sy = (typeof spawnY === 'number' && spawnY > 0) ? spawnY : 300 + Math.random() * (WORLD - 600);

      players[wid][socket.id] = {
        id:           socket.id,
        worldId:      wid,
        x:            sx,
        y:            sy,
        hp:           100,
        maxHp:        100,
        reducePct:    0,          // fallback รวม (legacy / entity)
        bodyReducePct: 0,         // เกราะตัว (body armor)
        headReducePct: 0,         // เกราะหัว (head armor)
        angle:        0,
        alive:        true,
        name:         (typeof name === 'string' && name.trim()) ? name.trim() : 'Player_' + socket.id.slice(0, 4),
        color:        (typeof color === 'string' && color.trim()) ? color.trim() : randomColor(),
        charId:       (typeof charId === 'string' && charId.trim()) ? charId.trim() : 'default',
        gunId:        null,
        isAiming:     false,
        kills:        0,
        reputation:   0,          // reputation ของผู้เล่น (sync จาก client)
        walkTimer:    0,
        isMoving:     false,
      };

      // ส่ง state ปัจจุบัน + drops ที่มีอยู่ใน world ให้ผู้เล่นใหม่
      socket.emit('init', {
        myId:    socket.id,
        players: players[wid],
        worldId: wid,
        drops:   world_drops[wid],
      });

      socket.to(wid).emit('player_joined', players[wid][socket.id]);
      broadcastCounts(io);

      console.log(`[JOIN] ${socket.id} joined world: ${wid} | drops in world: ${world_drops[wid].length} | drops: ${JSON.stringify(world_drops[wid].map(d=>d.dropId))}`);
    });

    // ── update position ──────────────────────────────────────
    // [FIX #1] ไม่รับ hp/alive จาก client แล้ว — server เป็น source of truth
    // [FIX #2] clamp reducePct ก่อนบันทึก (ป้องกัน cheat armor 100%)
    // [FIX #3] ตรวจ speed เกิน (anti-teleport)
    socket.on('update', (data) => {
      const wid = socketWorld[socket.id];
      if (!wid || !players[wid][socket.id]) return;

      const p = players[wid][socket.id];

      // ── anti-teleport: ตรวจระยะทางที่ขยับต่อ tick ──────────
      const dx   = (typeof data.x === 'number' ? data.x : p.x) - p.x;
      const dy   = (typeof data.y === 'number' ? data.y : p.y) - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxMove = MAX_SPEED_PX * (TICK_INTERVAL_MS * 2); // รอง 2 frame buffer

      if (dist <= maxMove) {
        p.x = data.x;
        p.y = data.y;
      }
      // ถ้าเกิน maxMove → ไม่อัพเดตตำแหน่ง (กัน teleport cheat)

      p.angle = (typeof data.angle === 'number') ? data.angle : p.angle;

      // [FIX #2] reducePct — รับจาก client แต่ clamp ไว้ที่ 0-75
      if (typeof data.reducePct === 'number') {
        p.reducePct = Math.min(75, Math.max(0, data.reducePct));
      }
      // armor แยกส่วน: bodyReducePct และ headReducePct
      if (typeof data.bodyReducePct === 'number') {
        p.bodyReducePct = Math.min(75, Math.max(0, data.bodyReducePct));
      }
      if (typeof data.headReducePct === 'number') {
        p.headReducePct = Math.min(75, Math.max(0, data.headReducePct));
      }
      // reputation — รับจาก client เพื่อให้ผู้เล่นอื่นเห็น
      if (typeof data.reputation === 'number') {
        p.reputation = Math.round(data.reputation);
      }
      // charId / color / name / walkTimer / isMoving — sync ให้ผู้เล่นอื่นเห็น
      if (typeof data.charId  === 'string' && data.charId.trim())  p.charId   = data.charId.trim();
      if (typeof data.color   === 'string' && data.color.trim())   p.color    = data.color.trim();
      if (typeof data.gunId   === 'string' || data.gunId === null) p.gunId    = data.gunId;
      if (typeof data.isAiming === 'boolean') p.isAiming = data.isAiming;
      if (typeof data.name    === 'string' && data.name.trim())    p.name     = data.name.trim();
      if (typeof data.walkTimer  === 'number')  p.walkTimer  = data.walkTimer;
      if (typeof data.isMoving   === 'boolean') p.isMoving   = data.isMoving;

      // [FIX #1] ไม่รับ hp / alive จาก client
      // hp และ alive ถูก update เฉพาะตอน hit/respawn เท่านั้น

      // broadcast ไปคนอื่นใน world (ส่งค่า hp/alive จาก server)
      socket.to(wid).emit('player_update', {
        id:         socket.id,
        x:          p.x,
        y:          p.y,
        angle:      p.angle,
        reducePct:  p.reducePct,
        hp:         p.hp,        // ← ค่าจาก server เสมอ
        alive:      p.alive,
        reputation: p.reputation, // ← ส่ง rep ให้คนอื่นเห็น
        charId:     p.charId,
        color:      p.color,
        gunId:      p.gunId,
        isAiming:   p.isAiming,
        name:       p.name,
        walkTimer:  p.walkTimer  ?? 0,
        isMoving:   p.isMoving   ?? false,
      });
    });

    // ── bullet ───────────────────────────────────────────────
    socket.on('bullet', (data) => {
      const wid = socketWorld[socket.id];
      if (!wid) return;
      socket.to(wid).emit('bullet', { ...data, owner: socket.id });
    });

    // ── hit ──────────────────────────────────────────────────
    // [FIX #3] validate damage ที่ server ก่อนใช้งาน
    socket.on('hit', (data) => {
      const wid    = socketWorld[socket.id];
      if (!wid) return;
      const target = players[wid][data.targetId];
      if (!target || !target.alive) return;

      // [FIX #3] clamp damage — ไม่รับค่าที่ผิดปกติจาก client
      const rawDamage = typeof data.damage === 'number' ? data.damage : 0;
      const safeDamage = Math.min(Math.max(0, rawDamage), MAX_DAMAGE);
      if (safeDamage <= 0) return;

      // ── คำนวณดาเมจแยก head/body armor ──────────────────────
      // hitZone: 'head' = โดนหัว → ใช้ headReducePct
      //          'body' = โดนตัว → ใช้ bodyReducePct (default)
      const hitZone = data.hitZone === 'head' ? 'head' : 'body';
      let reducePct;
      if (hitZone === 'head') {
        reducePct = target.headReducePct || 0;
      } else {
        reducePct = target.bodyReducePct || 0;
      }
      // fallback ถ้ายังไม่มีค่าแยก (เช่น client เก่า) → ใช้ reducePct รวม
      if (reducePct === 0 && (target.reducePct || 0) > 0) {
        reducePct = target.reducePct;
      }

      const headshotMult = hitZone === 'head' ? 2 : 1;
      const armorMult = 1 - reducePct / 100;
      const finalDmg  = Math.max(1, Math.round(safeDamage * headshotMult * armorMult));
      target.hp -= finalDmg;

      if (target.hp <= 0) {
        target.hp    = 0;
        target.alive = false;
        const attacker = players[wid][socket.id];
        if (attacker) attacker.kills++;
        io.to(wid).emit('player_died', { id: data.targetId, killerId: socket.id });
      } else {
        io.to(data.targetId).emit('took_damage', { hp: target.hp, damage: finalDmg });
      }
    });

    // ── drop_items: ผู้เล่นตายส่งของมาฝากไว้ใน world ──────────
    socket.on('drop_items', (data) => {
      const wid = socketWorld[socket.id];
      if (!wid) return;
      if (!Array.isArray(data.items) || data.items.length === 0) return;

      const drop = {
        dropId: newDropId(),
        x:      data.x,
        y:      data.y,
        items:  data.items,
      };
      world_drops[wid].push(drop);

      io.to(wid).emit('drop_spawned', drop);
      saveDrops();  // บันทึกทันทีที่มีของตก
      socket.emit('drop_ack', { dropId: drop.dropId });  // ยืนยันว่า server รับ drop แล้ว
      console.log(`[DROP_ITEMS] ${socket.id} dropped in ${wid} | dropId: ${drop.dropId} | items: ${JSON.stringify(data.items)} | total drops now: ${world_drops[wid].length}`);
    });

    // ── pickup_item: ผู้เล่นเก็บของ ──────────────────────────
    socket.on('pickup_item', (data) => {
      const wid = socketWorld[socket.id];
      if (!wid) return;

      const drops = world_drops[wid];
      const idx   = drops.findIndex(d => d.dropId === data.dropId);
      if (idx === -1) return;

      const drop = drops[idx];
      drops.splice(idx, 1);

      socket.emit('pickup_received', { dropId: drop.dropId, items: drop.items });
      io.to(wid).emit('drop_removed', { dropId: drop.dropId });
      saveDrops();  // บันทึกทันทีที่มีการเก็บของ
      console.log(`[Drop] ${socket.id} picked up ${drop.dropId} in ${wid}`);
    });

    // ── heal: ผู้เล่นใช้ยา bandage ───────────────────────────
    // validate ที่ server ก่อน — ป้องกัน heal cheat
    // clamp healAmt ไว้ที่ 100 (HEAL_AMT ของ bandage)
    const MAX_HEAL_AMT   = 100;
    const HEAL_COOLDOWN  = 2900;  // ms — น้อยกว่า client (3000ms) นิดนึงเผื่อ latency
    const _lastHeal = {};         // { socketId: timestamp }

    socket.on('heal', (data) => {
      const wid = socketWorld[socket.id];
      if (!wid || !players[wid][socket.id]) return;

      const p = players[wid][socket.id];
      if (!p.alive) return;

      // cooldown check ที่ server
      const now      = Date.now();
      const lastUsed = _lastHeal[socket.id] || 0;
      if (now - lastUsed < HEAL_COOLDOWN) return;

      // clamp heal amount
      const rawAmt  = typeof data.amount === 'number' ? data.amount : 0;
      const healAmt = Math.min(Math.max(0, rawAmt), MAX_HEAL_AMT);
      if (healAmt <= 0) return;

      _lastHeal[socket.id] = now;
      p.hp = Math.min(p.maxHp, p.hp + healAmt);

      // ยืนยัน HP กลับไปให้ client ที่ heal (เป็น source of truth)
      socket.emit('healed', { hp: p.hp });

      // broadcast HP ที่ถูกต้องไปคนอื่นใน world
      socket.to(wid).emit('player_update', {
        id:        socket.id,
        x:         p.x,
        y:         p.y,
        angle:     p.angle,
        reducePct: p.reducePct,
        hp:        p.hp,
        alive:     p.alive,
        charId:    p.charId,
        color:     p.color,
        gunId:     p.gunId,
        isAiming:  p.isAiming,
        name:      p.name,
        walkTimer: p.walkTimer  ?? 0,
        isMoving:  p.isMoving   ?? false,
      });
    });

    // ── respawn: ผู้เล่น respawn ──────────────────────────────
    socket.on('respawn', (data) => {
      const wid = socketWorld[socket.id];
      if (!wid || !players[wid][socket.id]) return;

      const p = players[wid][socket.id];
      p.hp    = p.maxHp;
      p.alive = true;
      p.x     = data.spawnX ?? (300 + Math.random() * (WORLD - 600));
      p.y     = data.spawnY ?? (300 + Math.random() * (WORLD - 600));

      socket.to(wid).emit('player_respawned', { id: socket.id, x: p.x, y: p.y, hp: p.hp });
      console.log(`[Respawn] ${socket.id} respawned in ${wid}`);
    });

    // ── disconnect ────────────────────────────────────────────
    socket.on('disconnect', () => {
      const wid = socketWorld[socket.id];
      if (wid && players[wid]) {
        delete players[wid][socket.id];
        io.to(wid).emit('player_left', { id: socket.id });
      }
      delete socketWorld[socket.id];
      broadcastCounts(io);
      const _wid2 = socketWorld[socket.id]; // already deleted above but capture before
      console.log(`[DISCONNECT] ${socket.id} | drops remaining in worlds: ${JSON.stringify(Object.fromEntries(WORLD_IDS.map(id=>[id, world_drops[id].length])))}`);
      console.log(`Disconnected: ${socket.id}`);
    });
  });
}

module.exports = { initSocket };
