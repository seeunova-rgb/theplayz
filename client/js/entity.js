// ===== ENTITY.JS =====
// ระบบ Entity: Zombie + Boss สำหรับ world_airport
// ทำงาน client-side local (ไม่ sync multiplayer)
//
// โครงสร้าง: ใช้ model เดียวกับ Default character (legs, body, eyes)
//   zombie → ขนาดเท่า player (r=18), ผิวเขียวซีด, ตาแดง, mirrored arms
//   boss   → ขนาดใหญ่กว่า (r=28), ผิวแดงเลือด, ตาเหลือง, armor overlay
//
// HITBOX 2 ชั้น:
//   body  → กึ่งกลาง  รัศมี cfg.r       ดาเมจ ×1.0
//   head  → ด้านบน   รัศมี cfg.r×0.5   ดาเมจ ×2.5 (headshot)

const Entity = (() => {

  let _entities        = [];
  let _active          = false;
  let _nextId          = 1;
  let _playerAttackCbs = [];
  let _pendingHits     = [];   // { entityId, damage, isHeadshot }

  // ── spawn zones (กระจายรอบ airport ห่างจากกลาง) ─────────────────────────
  const _ZOMBIE_ZONES = [
    { x:  800, y: 2800 }, { x: 1600, y: 2800 }, { x: 4200, y: 2800 },
    { x: 5000, y: 2800 }, { x: 2900, y:  600 }, { x: 2900, y: 1800 },
    { x: 2900, y: 5200 }, { x: 1700, y: 1200 }, { x: 1900, y:  900 },
    { x: 4200, y: 1200 }, { x: 4100, y:  900 }, { x: 1700, y: 4200 },
    { x: 1900, y: 4500 }, { x: 4200, y: 4200 }, { x: 4100, y: 4500 },
  ];

  // ──────────────────────────────────────────────────────────────────────────
  // INIT
  // ──────────────────────────────────────────────────────────────────────────
  function init(worldId) {
    _active          = (worldId === 'airport');
    _entities        = [];
    _nextId          = 1;
    _pendingHits     = [];
    _playerAttackCbs = [];   // [FIX] reset callbacks ทุกครั้ง ป้องกัน stack ซ้อนเมื่อเข้าเกมใหม่
    if (!_active) return;
    for (let i = 0; i < ENTITY_CONFIG.zombie.spawnCount; i++) _spawnZombie();
    _spawnBoss();
  }

  function _spawnZombie() {
    const z = _ZOMBIE_ZONES[Math.floor(Math.random() * _ZOMBIE_ZONES.length)];
    _entities.push(_make('zombie', z.x + (Math.random()-0.5)*400, z.y + (Math.random()-0.5)*400));
  }

  function _spawnBoss() {
    const c = ENTITY_CONFIG.boss;
    _entities.push(_make('boss', c.spawnX, c.spawnY));
  }

  function _make(type, x, y) {
    const c = ENTITY_CONFIG[type];
    return {
      id: _nextId++, type, x, y,
      hp: c.hp, maxHp: c.hp, alive: true,
      angle: 0,
      walkTimer: 0,
      _atkTimer: 0, _respawnTimer: 0,
      _flashTimer: 0, _headFlash: 0,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // HITBOX helpers
  // ──────────────────────────────────────────────────────────────────────────
  function _headCenter(ent) {
    const r = ENTITY_CONFIG[ent.type].r;
    const s = r / 22;
    const bh = 46 * s;
    return { x: ent.x, y: ent.y - bh * 0.5 + bh * 0.14 };
  }
  function _headR(ent) {
    const r = ENTITY_CONFIG[ent.type].r;
    return r * 0.5;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // BULLET HIT CHECK  (เรียกจาก game.js ทุก frame)
  // ──────────────────────────────────────────────────────────────────────────
  function checkBulletHit(bx, by, bulletR) {
    bulletR = bulletR || 4;
    for (const ent of _entities) {
      if (!ent.alive) continue;
      const c = ENTITY_CONFIG[ent.type];

      // HEAD (priority)
      const h  = _headCenter(ent);
      const hr = _headR(ent) + bulletR;
      const hdx = bx - h.x, hdy = by - h.y;
      if (hdx*hdx + hdy*hdy < hr*hr)
        return { hit: true, isHeadshot: true, entityId: ent.id };

      // BODY
      const br = c.r + bulletR;
      const bdx = bx - ent.x, bdy = by - ent.y;
      if (bdx*bdx + bdy*bdy < br*br)
        return { hit: true, isHeadshot: false, entityId: ent.id };
    }
    return { hit: false };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // UPDATE
  // ──────────────────────────────────────────────────────────────────────────
  function update(dt, player) {
    if (!_active) return;
    if (!player || !player.alive) return;

    // apply hits
    for (const h of _pendingHits) {
      const ent = _entities.find(e => e.id === h.entityId && e.alive);
      if (!ent) continue;
      if (h.isHeadshot) ent._headFlash = 200;
      _applyDamage(ent, h.damage, h.isHeadshot);
    }
    _pendingHits = [];

    for (const ent of _entities) {
      if (!ent.alive) { _tickRespawn(ent, dt); continue; }

      if (ent._flashTimer > 0) ent._flashTimer = Math.max(0, ent._flashTimer - dt);
      if (ent._headFlash  > 0) ent._headFlash  = Math.max(0, ent._headFlash  - dt);

      const c   = ENTITY_CONFIG[ent.type];
      const ddx = player.x - ent.x;
      const ddy = player.y - ent.y;
      const d   = Math.sqrt(ddx*ddx + ddy*ddy);

      if (d < c.detectRange) {
        const angle = Math.atan2(ddy, ddx);
        ent.angle   = angle;

        if (d > c.r + c.attackRange) {
          ent.walkTimer += 0.18;

          const step = c.speed;
          const nx = ent.x + Math.cos(angle) * step;
          const ny = ent.y + Math.sin(angle) * step;
          const W  = CONFIG.WORLD;

          if (nx - c.r > 0 && nx + c.r < W && !wallCollide(nx, ent.y, c.r)) ent.x = nx;
          if (ny - c.r > 0 && ny + c.r < W && !wallCollide(ent.x, ny, c.r)) ent.y = ny;
        } else {
          ent._atkTimer += dt;
          if (ent._atkTimer >= c.attackRate) {
            ent._atkTimer = 0;
            // ── คำนวณดาเมจหลังหักเกราะ ─────────────────────────────────
            // zombie/boss โจมตีแบบ 'body' เสมอ (ไม่มี headshot)
            // ถ้ามีระบบ Armor ให้ใช้ calcFinalDamage, ถ้าไม่มีใช้ค่าดิบ
            const finalEntityDmg = (typeof Armor !== 'undefined')
              ? Armor.calcFinalDamage(c.damage, 'body')
              : c.damage;
            player.hp = Math.max(0, player.hp - finalEntityDmg);
            if (player.hp <= 0) {
              player.hp = 0;
              if (player.alive) {
                // [FIX] ไม่เซ็ต player.alive = false ที่นี่
                // ให้ _onPlayerSelfDeath จัดการเอง ป้องกัน guard check ใน _onPlayerSelfDeath fail
                if (typeof window._onPlayerSelfDeath === "function") window._onPlayerSelfDeath(null);
              }
            }
            _playerAttackCbs.forEach(cb => cb(ent, finalEntityDmg));
          }
        }
      }
    }
  }

  function _applyDamage(ent, dmg, isHeadshot) {
    const final = isHeadshot ? Math.round(dmg * 2) : dmg;
    ent.hp -= final;
    ent._flashTimer = 120;
    if (ent.hp <= 0) {
      ent.hp = 0; ent.alive = false; ent._respawnTimer = 0;
      const rw = ENTITY_CONFIG[ent.type].reward;
      if (rw && typeof Money !== 'undefined') {
        if (rw.moneyMin != null && rw.moneyMax != null) {
          const moneyAmt = Math.floor(rw.moneyMin + Math.random() * (rw.moneyMax - rw.moneyMin + 1));
          Money.earn("money", moneyAmt);
        } else if (rw.money) {
          Money.earn("money", rw.money);
        }
        if (rw.point) Money.earn("point", rw.point);
      }
      // ── Reputation reward จาก PvE ──────────────────────
      if (typeof Reputation !== 'undefined' && Reputation.onKillEntity) {
        Reputation.onKillEntity(ent.type);
      }
    }
  }

  // [FIX #11] zombie respawn ที่ zone สุ่มใหม่ — ไม่ respawn ที่จุดที่ตาย
  // boss ยังคง respawn ที่ spawnX/spawnY ตามปกติ
  function _tickRespawn(ent, dt) {
    const c = ENTITY_CONFIG[ent.type];
    ent._respawnTimer += dt;
    if (ent._respawnTimer < c.respawnTime) return;

    if (ent.type === 'zombie') {
      // [FIX #11] สุ่ม zone ใหม่ — ป้องกัน camp จุดเดิม
      const z = _ZOMBIE_ZONES[Math.floor(Math.random() * _ZOMBIE_ZONES.length)];
      ent.x = z.x + (Math.random() - 0.5) * 400;
      ent.y = z.y + (Math.random() - 0.5) * 400;
    } else {
      // boss กลับ spawn point เดิมเสมอ
      ent.x = c.spawnX;
      ent.y = c.spawnY;
    }

    ent.hp = c.hp; ent.alive = true; ent.walkTimer = 0;
    ent._atkTimer = ent._respawnTimer = ent._flashTimer = ent._headFlash = 0;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // DRAW  —  โครงสร้างตาม Default character
  // ──────────────────────────────────────────────────────────────────────────
  function draw(ctx) {
    if (!_active) return;
    for (const ent of _entities) {
      if (!ent.alive) continue;
      ent.type === 'boss' ? _drawBoss(ctx, ent) : _drawZombie(ctx, ent);
    }
  }

  // ── Zombie ────────────────────────────────────────────────────────────────
  function _drawZombie(ctx, ent) {
    const r   = ENTITY_CONFIG.zombie.r;
    const s   = r / 22;
    const flx = ent._flashTimer > 0;
    const legSwing = Math.sin(ent.walkTimer) * 6 * s;

    const skinColor  = flx ? '#ffffff' : '#7ab87a';
    const shirtColor = flx ? '#ffffff' : '#2d4a2d';
    const eyeColor   = ent._headFlash > 0 ? '#ff8800' : '#ff2222';

    ctx.save();
    ctx.translate(ent.x, ent.y);

    ctx.fillStyle = flx ? '#cccccc' : '#1a2e1a';
    ctx.beginPath(); ctx.ellipse(-8*s, 22*s + legSwing, 7*s, 11*s, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse( 8*s, 22*s - legSwing, 7*s, 11*s, 0, 0, Math.PI*2); ctx.fill();
    if (!flx) {
      ctx.strokeStyle = '#0d1a0d'; ctx.lineWidth = 1.5*s;
      ctx.beginPath(); ctx.moveTo(-11*s, 26*s); ctx.lineTo(-5*s, 30*s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(5*s, 24*s); ctx.lineTo(11*s, 28*s); ctx.stroke();
    }

    const bw=38*s, bh=46*s, bx=-bw/2, by=-bh/2, brad=9*s;
    ctx.fillStyle = shirtColor;
    roundRect(ctx, bx, by+bh*0.52, bw, bh*0.48, {bl:brad,br:brad,tl:0,tr:0}); ctx.fill();
    ctx.fillStyle = skinColor;
    roundRect(ctx, bx, by, bw, bh*0.52, {tl:brad,tr:brad,bl:0,br:0}); ctx.fill();
    ctx.strokeStyle = flx ? '#aaaaaa' : '#0d1a0d'; ctx.lineWidth = 2.5*s;
    roundRectStroke(ctx, bx, by, bw, bh, brad);
    ctx.strokeStyle = flx ? '#aaaaaa' : '#0d1a0d'; ctx.lineWidth = 2*s;
    ctx.beginPath(); ctx.moveTo(bx, by+bh*0.52); ctx.lineTo(bx+bw, by+bh*0.52); ctx.stroke();

    if (!flx) {
      ctx.strokeStyle = '#8b0000'; ctx.lineWidth = 2*s; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(-6*s, by+bh*0.62); ctx.lineTo(-2*s, by+bh*0.72); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(4*s, by+bh*0.58); ctx.lineTo(9*s, by+bh*0.65); ctx.stroke();
    }

    const eyeY = by + bh*0.28;
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(-9*s, eyeY, 5.5*s, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = eyeColor;
    ctx.beginPath(); ctx.arc(-9*s, eyeY, 3.5*s, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-7.5*s, eyeY-2*s, 1.5*s, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc( 9*s, eyeY, 5.5*s, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = eyeColor;
    ctx.beginPath(); ctx.arc( 9*s, eyeY, 3.5*s, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(10.5*s, eyeY-2*s, 1.5*s, 0, Math.PI*2); ctx.fill();

    ctx.strokeStyle = '#111'; ctx.lineWidth = 2*s; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(-7*s, by+bh*0.44); ctx.lineTo(7*s, by+bh*0.44); ctx.stroke();
    if (!flx) {
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.rect(-5*s, by+bh*0.42, 3*s, 3*s); ctx.fill();
      ctx.beginPath(); ctx.rect(2*s, by+bh*0.42, 3*s, 3*s); ctx.fill();
    }

    _drawHPBar(ctx, r, ent.hp, ent.maxHp, bh);

    ctx.fillStyle = '#88ff88'; ctx.font = 'bold 10px Rajdhani, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('ZOMBIE', 0, by - 8);

    ctx.restore();
  }

  // ── Boss ──────────────────────────────────────────────────────────────────
  function _drawBoss(ctx, ent) {
    const r   = ENTITY_CONFIG.boss.r;
    const s   = r / 22;
    const flx = ent._flashTimer > 0;
    const legSwing = Math.sin(ent.walkTimer) * 6 * s;

    const skinColor  = flx ? '#ffffff' : '#8b0000';
    const armorColor = flx ? '#ffffff' : '#2a0000';
    const eyeColor   = ent._headFlash > 0 ? '#ff4400' : '#ffdd00';

    ctx.save();
    ctx.translate(ent.x, ent.y);

    if (!flx) {
      const bh_approx = 46 * s;
      const grad = ctx.createRadialGradient(0, 0, r*0.3, 0, 0, r*2.2);
      grad.addColorStop(0, 'rgba(180,0,0,0.25)');
      grad.addColorStop(1, 'rgba(180,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(0, 0, r*2.2, 0, Math.PI*2); ctx.fill();
    }

    ctx.fillStyle = flx ? '#cccccc' : '#1a0000';
    ctx.beginPath(); ctx.ellipse(-8*s, 22*s + legSwing, 8*s, 13*s, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse( 8*s, 22*s - legSwing, 8*s, 13*s, 0, 0, Math.PI*2); ctx.fill();
    if (!flx) {
      ctx.fillStyle = '#ff4400';
      for (let side of [-1, 1]) {
        const lx = side * 8 * s;
        const ly = 20 * s;
        ctx.beginPath(); ctx.moveTo(lx-3*s,ly); ctx.lineTo(lx,ly-6*s); ctx.lineTo(lx+3*s,ly); ctx.fill();
      }
    }

    const bw=38*s, bh=46*s, bx=-bw/2, by=-bh/2, brad=9*s;
    ctx.fillStyle = armorColor;
    roundRect(ctx, bx, by+bh*0.52, bw, bh*0.48, {bl:brad,br:brad,tl:0,tr:0}); ctx.fill();
    ctx.fillStyle = skinColor;
    roundRect(ctx, bx, by, bw, bh*0.52, {tl:brad,tr:brad,bl:0,br:0}); ctx.fill();
    ctx.strokeStyle = flx ? '#aaaaaa' : '#ff4400'; ctx.lineWidth = 3*s;
    roundRectStroke(ctx, bx, by, bw, bh, brad);
    ctx.strokeStyle = flx ? '#aaaaaa' : '#ff4400'; ctx.lineWidth = 2*s;
    ctx.beginPath(); ctx.moveTo(bx, by+bh*0.52); ctx.lineTo(bx+bw, by+bh*0.52); ctx.stroke();

    if (!flx) {
      ctx.fillStyle = '#3d0000'; ctx.strokeStyle = '#ff2200'; ctx.lineWidth = 1.5*s;
      roundRect(ctx, bx+4*s, by+bh*0.56, bw-8*s, 13*s, 3*s); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ff4400'; ctx.font = `bold ${10*s}px sans-serif`; ctx.textAlign='center';
      ctx.fillText('☠', 0, by + bh*0.68);
    }

    const eyeY = by + bh*0.28;
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(-9*s, eyeY, 6*s, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = eyeColor;
    ctx.beginPath(); ctx.arc(-9*s, eyeY, 4*s, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-7.5*s, eyeY-2*s, 1.8*s, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc( 9*s, eyeY, 6*s, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = eyeColor;
    ctx.beginPath(); ctx.arc( 9*s, eyeY, 4*s, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(10.5*s, eyeY-2*s, 1.8*s, 0, Math.PI*2); ctx.fill();
    if (!flx) {
      ctx.strokeStyle = '#ff2200'; ctx.lineWidth = 2.5*s; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(-15*s, eyeY-6*s); ctx.lineTo(-4*s, eyeY-3*s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(4*s, eyeY-3*s); ctx.lineTo(15*s, eyeY-6*s); ctx.stroke();
    }

    ctx.strokeStyle = '#111'; ctx.lineWidth = 2.5*s; ctx.lineCap='round';
    ctx.beginPath();
    ctx.moveTo(-8*s, by+bh*0.46);
    ctx.quadraticCurveTo(0, by+bh*0.40, 8*s, by+bh*0.46);
    ctx.stroke();
    if (!flx) {
      ctx.fillStyle = '#eee';
      for (let tx of [-5, 0, 5]) {
        const fx = tx * s;
        ctx.beginPath();
        ctx.moveTo(fx - 2.5*s, by+bh*0.46);
        ctx.lineTo(fx, by+bh*0.42);
        ctx.lineTo(fx + 2.5*s, by+bh*0.46);
        ctx.fill();
      }
    }

    if (!flx) {
      ctx.fillStyle = '#ff4400';
      for (let i = -1; i <= 1; i++) {
        const sx = i * 10 * s;
        const sLen = (i === 0 ? 10 : 7) * s;
        ctx.beginPath();
        ctx.moveTo(sx - 3*s, by); ctx.lineTo(sx, by - sLen); ctx.lineTo(sx + 3*s, by); ctx.fill();
      }
    }

    _drawHPBar(ctx, r, ent.hp, ent.maxHp, bh, '#ff2200');

    ctx.fillStyle = '#ff4400'; ctx.font = 'bold 14px Rajdhani, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('☠ BOSS', 0, by - 18);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px Rajdhani, sans-serif';
    ctx.fillText(`${ent.hp} / ${ent.maxHp}`, 0, by - 7);

    ctx.restore();
  }

  // ── HP Bar helper ─────────────────────────────────────────────────────────
  function _drawHPBar(ctx, r, hp, maxHp, bh, overrideColor) {
    const barW = r * 3;
    const barH = 5;
    const barX = -barW / 2;
    const barY = -bh / 2 - 6;
    const pct  = Math.max(0, hp / maxHp);
    const col  = overrideColor || (pct > 0.5 ? '#4caf50' : pct > 0.25 ? '#ff9800' : '#f44336');
    ctx.fillStyle = '#222'; ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = col;    ctx.fillRect(barX, barY, barW * pct, barH);
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ──────────────────────────────────────────────────────────────────────────
  function registerHit(entityId, damage, isHeadshot) {
    _pendingHits.push({ entityId, damage, isHeadshot: !!isHeadshot });
  }

  function getAlive() { return _entities.filter(e => e.alive); }

  function onPlayerAttacked(cb) { _playerAttackCbs.push(cb); }

  return { init, update, draw, checkBulletHit, registerHit, getAlive, onPlayerAttacked };
})();

window.Entity = Entity;
