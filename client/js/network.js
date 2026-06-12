// ===== NETWORK.JS =====
// จัดการ Socket.io connection

const Network = (() => {
  let socket = null;
  let myId   = null;
  const remotePlayers = {};  // { id: playerData }

  // callbacks ที่ game.js จะ register
  const _cb = {
    onInit:            null,  // (myId, players, drops)
    onPlayerJoined:    null,  // (playerData)
    onPlayerUpdate:    null,  // (data)
    onPlayerLeft:      null,  // (id)
    onBullet:          null,  // (data)
    onTookDamage:      null,  // ({ hp, damage })
    onPlayerDied:      null,  // ({ id, killerId })
    onDropSpawned:     null,  // (drop)
    onDropRemoved:     null,  // ({ dropId })
    onPickupReceived:  null,  // ({ dropId, items })
    onPlayerRespawned: null,  // ({ id, x, y, hp })
    onHealed:          null,  // ({ hp }) — server ยืนยัน HP หลัง heal
  };

  function connect() {
    // [FIX] disconnect socket เก่าก่อนเสมอ — ป้องกัน socket ซ้อน
    // และล้าง remotePlayers ให้ clean ก่อน join world ใหม่
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    myId = null;
    Object.keys(remotePlayers).forEach(k => delete remotePlayers[k]);

    socket = io('https://theplayz.up.railway.app', { transports: ['websocket', 'polling'] });

    // [FIX] ลง listener 'init' ก่อน emit 'join_world' เสมอ
    // ป้องกัน race condition: server อาจตอบ 'init' กลับมาก่อนที่ listener จะลงทัน
    socket.on('init', ({ myId: id, players, drops }) => {
      myId = id;
      // [FIX] ใส่ alive: true ให้ทุกคนที่ server ส่งมาตอน init
      // เพราะ server อาจไม่ส่ง field alive มาด้วย
      Object.entries(players).forEach(([pid, pdata]) => {
        remotePlayers[pid] = Object.assign({ alive: true, hp: 100 }, pdata);
      });
      delete remotePlayers[myId];
      if (_cb.onInit) _cb.onInit(id, players, drops || []);

      // ── flush drop ที่ค้างจากรอบก่อน ──────────────────────
      // game.js เก็บ toDrop ไว้ใน window._pendingDropItems ก่อน clearAll
      // พอ init สำเร็จ (เชื่อม server แน่นอนแล้ว) ค่อยส่ง drop
      try {
        const toDrop = window._pendingDropItems;
        if (Array.isArray(toDrop) && toDrop.length > 0) {
          const sp = players[id] || { x: 3000, y: 3000 };
          console.log('[DROP] flushing pending drop on init:', toDrop.length, 'items');
          socket.emit('drop_items', { x: sp.x, y: sp.y, items: toDrop });
          window._pendingDropItems = null;
          window._pendingDropWorld = null;
        }
      } catch(e) { console.warn('[DROP] flush error:', e); }
    });

    // ── join world room (emit หลัง listener พร้อมแล้ว) ──────
    const worldId   = window._selectedWorldId || 'safezone';
    const _spawnPos = (typeof findSafeSpawn !== 'undefined')
      ? findSafeSpawn(worldId)
      : { x: 3000, y: 3000 };
    const _joinName   = window._playerName   || 'Player';
    const _joinColor  = window._playerColor  || '#2563EB';
    const _joinCharId = window._playerCharId || 'default';
    socket.emit('join_world', {
      worldId,
      spawnX:  _spawnPos.x,
      spawnY:  _spawnPos.y,
      name:    _joinName,
      color:   _joinColor,
      charId:  _joinCharId,
    });


    socket.on('player_joined', (data) => {
      // [FIX] ใส่ alive: true เพราะ server ไม่ส่งมาตอน join
      remotePlayers[data.id] = Object.assign({ alive: true, hp: 100 }, data);
      if (_cb.onPlayerJoined) _cb.onPlayerJoined(data);
    });

    // [FIX #5] player_update จาก server มี hp/alive จาก server แล้ว
    // ใช้ Object.assign โดยตรง — รวมถึง reducePct ที่ตอนนี้ส่งมาด้วย
    socket.on('player_update', (data) => {
      if (remotePlayers[data.id]) Object.assign(remotePlayers[data.id], data);
      if (_cb.onPlayerUpdate) _cb.onPlayerUpdate(data);
    });

    socket.on('player_left', ({ id }) => {
      delete remotePlayers[id];
      if (_cb.onPlayerLeft) _cb.onPlayerLeft(id);
    });

    socket.on('bullet', (data) => {
      if (_cb.onBullet) _cb.onBullet(data);
    });

    socket.on('took_damage', (data) => {
      if (_cb.onTookDamage) _cb.onTookDamage(data);
    });

    socket.on('player_died', (data) => {
      if (_cb.onPlayerDied) _cb.onPlayerDied(data);
    });

    // ── drops ────────────────────────────────────────────
    socket.on('drop_spawned', (drop) => {
      if (_cb.onDropSpawned) _cb.onDropSpawned(drop);
    });

    socket.on('drop_removed', (data) => {
      if (_cb.onDropRemoved) _cb.onDropRemoved(data);
    });

    socket.on('pickup_received', (data) => {
      if (_cb.onPickupReceived) _cb.onPickupReceived(data);
    });

    // ── respawn ───────────────────────────────────────────
    socket.on('player_respawned', (data) => {
      if (remotePlayers[data.id]) {
        remotePlayers[data.id].alive = true;
        remotePlayers[data.id].hp   = data.hp;
        remotePlayers[data.id].x    = data.x;
        remotePlayers[data.id].y    = data.y;
      }
      if (_cb.onPlayerRespawned) _cb.onPlayerRespawned(data);
    });

    // ── healed: server ยืนยัน HP หลังใช้ยา ────────────────
    socket.on('healed', (data) => {
      if (_cb.onHealed) _cb.onHealed(data);
    });

    // ── drop_ack: server ยืนยันรับ drop แล้ว ──
    socket.on('drop_ack', (data) => {
      if (_onceCbs.drop_ack) { _onceCbs.drop_ack(data); delete _onceCbs.drop_ack; }
    });

    // ── online counts (สำหรับ WorldSelect UI) ───────────
    socket.on('world_counts', (counts) => {
      if (typeof WorldSelect !== 'undefined') {
        Object.entries(counts).forEach(([wid, count]) => {
          WorldSelect.setOnlineCount(wid, count);
        });
      }
    });
  }

  // ── ส่งข้อมูลไป server ──────────────────────────────────

  // [FIX #6] เพิ่ม reducePct ใน sendUpdate ให้ server รู้ armor ของผู้เล่นคนอื่น
  // ส่งแยก bodyReducePct และ headReducePct เพื่อคำนวณดาเมจแยกส่วน
  function sendUpdate(player) {
    if (!socket) return;
    const _armor = (typeof Armor !== 'undefined') ? Armor : null;
    const _rep   = (typeof Reputation !== 'undefined' && Reputation.get) ? Reputation.get().rep : 0;
    socket.emit('update', {
      x:             player.x,
      y:             player.y,
      angle:         player.angle,
      walkTimer:     player.walkTimer ?? 0,           // ใช้วาด leg animation ฝั่ง remote
      isMoving:      player.isMoving  ?? false,
      charId:        player.charId    || 'default',   // ส่ง charId ทุก frame เพื่อ sync
      color:         player.color     || '#2563EB',
      gunId:         (typeof Backpack !== 'undefined' && Backpack.getEquippedInSlot) ? (Backpack.getEquippedInSlot('gun') || null) : null,
      isAiming:      (typeof Input !== 'undefined' && Input.isAiming) ? Input.isAiming() : false,
      name:          player.name      || (window._playerName || 'Player'),
      reducePct:     player.reducePct ?? 0,
      bodyReducePct: _armor ? _armor.getBodyReducePct() : 0,
      headReducePct: _armor ? _armor.getHeadReducePct() : 0,
      reputation:    _rep,
      // [FIX #1] ไม่ส่ง hp/alive — server เป็น source of truth
    });
  }

  function sendBullet(bullet, angle) {
    if (!socket) return;
    socket.emit('bullet', { x: bullet.x, y: bullet.y, vx: bullet.vx, vy: bullet.vy, angle });
  }

  // hitZone: 'head' | 'body' — บอก server ว่ากระสุนโดนส่วนไหน
  function sendHit(targetId, damage, hitZone) {
    if (!socket) return;
    socket.emit('hit', { targetId, damage, hitZone: hitZone || 'body' });
  }

  function sendDropItems(x, y, items) {
    if (!socket) return;
    socket.emit('drop_items', { x, y, items });
  }

  function sendPickup(dropId) {
    if (!socket) return;
    socket.emit('pickup_item', { dropId });
  }

  function sendRespawn(spawnX, spawnY) {
    if (!socket) return;
    socket.emit('respawn', { spawnX, spawnY });
  }

  function sendHeal(amount) {
    if (!socket) return;
    socket.emit('heal', { amount });
  }

  // ── register callbacks ──────────────────────────────────

  function on(event, fn) { _cb[event] = fn; }

  // รับ callback ครั้งเดียวแล้วลบทิ้ง (ใช้รอ drop_ack)
  const _onceCbs = {};
  function once(event, fn) { _onceCbs[event] = fn; }

  // [FIX] ตัด socket ออกสะอาด — เรียกเมื่อกลับ lobby
  function disconnect() {
    if (socket) { socket.disconnect(); socket = null; }
    myId = null;
    Object.keys(remotePlayers).forEach(k => delete remotePlayers[k]);
  }

  return {
    connect,
    disconnect,
    sendUpdate,
    sendBullet,
    sendHit,
    sendDropItems,
    sendPickup,
    sendRespawn,
    sendHeal,
    on,
    once,
    getRemotePlayers: () => remotePlayers,
    getMyId:          () => myId,
  };
})();

window.Network = Network;
