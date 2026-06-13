// ===== GAME.JS =====

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

canvas.width  = window.innerWidth;
canvas.height = window.innerHeight;

let _lastW = window.innerWidth;
window.addEventListener('resize', () => {
  // ป้องกัน canvas ย่อ/ขยายตอน address bar ของเบราว์เซอร์ซ่อน/โผล่
  // (เกิดเฉพาะ height เปลี่ยนเล็กน้อย แต่ width เท่าเดิม)
  // resize จริงเฉพาะตอน width เปลี่ยน (เช่น หมุนจอ) เท่านั้น
  if (window.innerWidth === _lastW) return;
  _lastW = window.innerWidth;
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
});

// ===== STATE =====
let player;
const camera = { x: 0, y: 0 };
let _netTick   = 0;
let _regenTimer = 0;

// ===== DAMAGE NUMBERS =====
const _dmgNums = [];

function _spawnDmgNum(x, y, dmg, color, isHeadshot) {
  _dmgNums.push({
    x, y,
    text:  `${dmg}`,
    color,
    alpha: 1,
    vy:    -1.8,
    timer: 0,
    life:  isHeadshot ? 1400 : 900,
    size:  isHeadshot ? 16 : 13,
  });
}

// ── Kill reward floating texts ────────────────────────────────
const _rewardNums = [];

function _spawnRewardNum(x, y, type, money, point) {
  const isBoss = type === 'boss';
  const r = ENTITY_CONFIG?.[type]?.r || 18;
  const baseY = y + _charTopY(r) - 18;  // เหนือ entity

  if (money > 0) {
    _rewardNums.push({
      x, y: baseY,
      text: `+${money.toLocaleString()} 💵`,
      color: isBoss ? '#ffd740' : '#66bb6a',
      alpha: 1,
      vy: -1.1,
      vx: (Math.random() - 0.5) * 0.6,
      timer: 0,
      life: isBoss ? 2200 : 1600,
      size: isBoss ? 15 : 12,
    });
  }
  if (point > 0) {
    _rewardNums.push({
      x, y: baseY - (money > 0 ? 18 : 0),
      text: `+${point} 💎`,
      color: '#64b5f6',
      alpha: 1,
      vy: -1.1,
      vx: (Math.random() - 0.5) * 0.6,
      timer: 0,
      life: isBoss ? 2200 : 1600,
      size: isBoss ? 15 : 12,
    });
  }
}

window._onEntityKillReward = function(x, y, type, money, point) {
  _spawnRewardNum(x, y, type, money, point);
};

function _charTopY(r) {
  const s  = r / 22;
  const bh = 46 * s;
  return -bh / 2 - 10;
}

// ===== REP ICON (หน้าชื่อผู้เล่น) =====
// cache รูปยศ reputation — โหลดครั้งเดียวแล้วใช้ซ้ำทุก frame
const _repIconCache = {};
function _getRepIcon(imgName) {
  if (!imgName) return null;
  if (_repIconCache[imgName]) return _repIconCache[imgName];
  const img = new Image();
  img.src = `assets/reputations/${imgName}`;
  _repIconCache[imgName] = img;
  return img;
}

// วาด nametag พร้อมรูป rep ไว้หน้าชื่อ (ใช้กับทั้งตัวเองและผู้เล่นอื่น)
// คืนค่าไม่มี — วาดลง ctx ที่ position ปัจจุบัน (translate มาแล้ว)
// badge config ตาม account
const _ACCOUNT_BADGE = {
  premium: { text: '⭐',  color: '#ffd700' },
  dev:     { text: 'DEV', color: '#ff3333' },
};

function _drawNameWithRep(ctx, name, repVal, x, y, playerId) {
  const tier = (typeof Reputation !== 'undefined' && Reputation.getTier) ? Reputation.getTier(repVal) : null;
  const icon = tier && tier.img ? _getRepIcon(tier.img) : null;
  const iconSize = 14;
  const gap = 4;

  // ── ชื่อสี จาก RTDB (Dev กำหนดเอง) ───────────────────────
  const nameColorData = playerId && window._nameColors && window._nameColors[playerId];
  let nameColor;
  if (nameColorData && nameColorData.color === 'rgb') {
    // สี RGB ไล่ hue ไปเรื่อยๆ ตามเวลา
    const hue = (Date.now() / 20) % 360;
    nameColor = `hsl(${hue}, 100%, 60%)`;
  } else {
    nameColor = nameColorData ? nameColorData.color : '#ffffff';
  }

  // ── badge จาก account ──────────────────────────────────────
  const account = playerId && window._accounts && window._accounts[playerId];
  const badge   = account ? _ACCOUNT_BADGE[account] : null;

  ctx.font         = `bold ${Math.max(10, CONFIG.PLAYER_R * 0.6)}px Rajdhani, 'Noto Sans Thai', sans-serif`;
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'bottom';

  const fontSize     = Math.max(10, CONFIG.PLAYER_R * 0.6);
  const badgeFontSize = Math.max(8, CONFIG.PLAYER_R * 0.45);
  ctx.font = `bold ${fontSize}px Rajdhani, 'Noto Sans Thai', sans-serif`;

  const textW  = ctx.measureText(name).width;
  const hasIcon = icon && icon.complete && icon.naturalWidth > 0;

  // คำนวณ badge width
  let badgeW = 0;
  const badgeGap = 5;
  if (badge) {
    ctx.font = `bold ${badgeFontSize}px Rajdhani, 'Noto Sans Thai', sans-serif`;
    badgeW = ctx.measureText(badge.text).width + badgeGap;
    ctx.font = `bold ${fontSize}px Rajdhani, 'Noto Sans Thai', sans-serif`;
  }

  const totalW = textW + (hasIcon ? iconSize + gap : 0) + badgeW;
  let drawX = x - totalW / 2;

  if (hasIcon) {
    const pad = 2;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.beginPath();
    ctx.roundRect(drawX - pad, y - iconSize - pad, iconSize + pad * 2, iconSize + pad * 2, 3);
    ctx.fill();
    ctx.drawImage(icon, drawX, y - iconSize, iconSize, iconSize);
    drawX += iconSize + gap;
  }

  ctx.font        = `bold ${fontSize}px Rajdhani, 'Noto Sans Thai', sans-serif`;
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth   = 3;
  ctx.strokeText(name, drawX, y);
  ctx.fillStyle   = nameColor;
  ctx.fillText(name, drawX, y);
  drawX += textW;

  // วาด badge [PREMIUM] หรือ [DEV] ท้ายชื่อ
  if (badge) {
    drawX += badgeGap;
    ctx.font = `bold ${badgeFontSize}px Rajdhani, 'Noto Sans Thai', sans-serif`;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth   = 3;
    ctx.strokeText(badge.text, drawX, y);
    ctx.fillStyle   = badge.color;
    ctx.fillText(badge.text, drawX, y);
  }
}

// ===== SOUNDS =====
const _HIT_SOUNDS  = ['hit1', 'hit2', 'hit3'];
const _HURT_SOUNDS = ['hurt1', 'hurt2'];
function _playRandom(list, vol) {
  if (typeof Sounds === 'undefined') return;
  Sounds.play(list[Math.floor(Math.random() * list.length)], vol);
}

// ===== WORLD DROPS =====
const _worldDrops  = {};
const PICKUP_RANGE = 80;

function _addDrop(drop)      { _worldDrops[drop.dropId] = drop; }
function _removeDrop(dropId) { delete _worldDrops[dropId]; }

// expose ให้ dev.js ใช้
window._addDrop          = _addDrop;
window._worldDrops       = _worldDrops;
window._dropPlayerItems  = _dropPlayerItems;  // expose ให้ lobby.js เรียกตอนกลับ lobby ขณะตาย

function _tryPickupNear() {
  let nearest = null, nearDist = Infinity;
  Object.values(_worldDrops).forEach(d => {
    const dx = d.x - player.x, dy = d.y - player.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < PICKUP_RANGE && dist < nearDist) { nearDist = dist; nearest = d; }
  });
  if (!nearest) return;
  Network.sendPickup(nearest.dropId);
}

function _applyPickup(items) {
  if (!items || !items.length) return;
  items.forEach(({ id, qty }) => {
    if (typeof Backpack !== 'undefined') {
      Backpack.addItem(id, qty);
    }
  });
  const defs = items.map(({ id, qty }) => {
    if (typeof Backpack !== 'undefined' && Backpack.findDef) {
      const def = Backpack.findDef(id);
      return def ? `${def.name} ×${qty}` : `${id} ×${qty}`;
    }
    return `${id} ×${qty}`;
  });
  if (typeof window.showToast === 'function') window.showToast(`📦 เก็บได้: ${defs.join(', ')}`, 'success');
}

// ===== HOLD-TO-PICKUP SYSTEM =====
const _PICKUP_HOLD_MS = 1000;
let _pickupHoldTimer  = 0;
let _pickupHolding    = false;
let _pickupTarget     = null;
let _pickupDone       = false;

function _getNearestDrop() {
  let nearest = null, nearDist = Infinity;
  Object.values(_worldDrops).forEach(d => {
    const dx = d.x - player.x, dy = d.y - player.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < PICKUP_RANGE && dist < nearDist) { nearDist = dist; nearest = d; }
  });
  return nearest;
}

function startPickupHold() {
  if (!player || !player.alive) return;
  _pickupHolding = true;
  _pickupDone    = false;
}

function stopPickupHold() {
  _pickupHolding    = false;
  _pickupHoldTimer  = 0;
  _pickupTarget     = null;
  _pickupDone       = false;
  _updatePickupBtn(0, false);
}

function _updatePickupBtn(progress, visible) {
  const btn  = document.getElementById('pickup-btn');
  const ring = document.getElementById('pickup-progress-ring');
  if (!btn) return;
  btn.classList.toggle('holding', _pickupHolding && visible);
  if (ring) {
    const circ = 2 * Math.PI * 24;
    ring.style.strokeDashoffset = circ * (1 - progress);
  }
}

function _tickPickup(dt) {
  const nearest = _getNearestDrop();
  const btnEl   = document.getElementById('pickup-btn');

  if (!nearest) {
    if (btnEl) btnEl.style.display = 'none';
    if (_pickupHolding) { _pickupHoldTimer = 0; _pickupTarget = null; }
    _updatePickupBtn(0, false);
    return;
  }

  if (btnEl) btnEl.style.display = '';

  if (!_pickupHolding) {
    _pickupHoldTimer = 0;
    _pickupTarget    = null;
    _pickupDone      = false;
    _updatePickupBtn(0, false);
    return;
  }

  if (_pickupTarget && _pickupTarget.dropId !== nearest.dropId) {
    _pickupHoldTimer = 0;
    _pickupDone      = false;
  }
  _pickupTarget = nearest;

  if (_pickupDone) return;

  _pickupHoldTimer += dt;
  const progress = Math.min(_pickupHoldTimer / _PICKUP_HOLD_MS, 1);
  _updatePickupBtn(progress, true);

  if (_pickupHoldTimer >= _PICKUP_HOLD_MS) {
    _pickupDone      = true;
    _pickupHoldTimer = 0;
    _updatePickupBtn(1, true);
    _tryPickupNear();
  }
}

// ===== DEATH / RESPAWN =====
let _deathOverlay = null;

function _showDeathScreen(killerName, recap) {
  if (_deathOverlay) return;

  // สร้าง recap rows
  let recapHtml = '';
  if (recap && recap.hits && recap.hits.length > 0) {
    const rows = recap.hits.map(h => {
      const zone  = h.hitZone === 'head' ? '🎯 หัว' : '🔫 ตัว';
      const dmgCl = h.hitZone === 'head' ? 'recap-dmg-head' : 'recap-dmg-body';
      const gun   = h.gunId || '?';
      return `<div class="recap-row">
        <span class="recap-attacker">${h.attackerName}</span>
        <span class="recap-gun">${gun}</span>
        <span class="recap-zone">${zone}</span>
        <span class="${dmgCl}">-${h.damage}</span>
      </div>`;
    }).join('');
    recapHtml = `<div class="recap-box">
      <div class="recap-title">📋 สาเหตุการตาย</div>
      <div class="recap-header"><span>ผู้โจมตี</span><span>อาวุธ</span><span>โดน</span><span>DMG</span></div>
      ${rows}
    </div>`;
  }

  _deathOverlay = document.createElement('div');
  _deathOverlay.id = 'death-overlay';
  _deathOverlay.innerHTML = `
    <div class="death-content">
      <div class="death-skull">💀</div>
      <div class="death-title">YOU DIED</div>
      ${killerName ? `<div class="death-killer">โดน <span>${killerName}</span> สังหาร</div>` : '<div class="death-killer">คุณได้รับบาดเจ็บสาหัส</div>'}
      ${recapHtml}
      <div class="death-actions">
        <button class="death-btn death-btn-respawn" id="btn-respawn">
          <span class="death-btn-icon">🔄</span>
          <span class="death-btn-label">เกิดใหม่</span>
        </button>
        <button class="death-btn death-btn-lobby" id="btn-lobby">
          <span class="death-btn-icon">🏠</span>
          <span class="death-btn-label">กลับล็อบบี้</span>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(_deathOverlay);

  document.getElementById('btn-respawn').addEventListener('click', () => {
    _hideDeathScreen();
    _doRespawn();
  });
  document.getElementById('btn-lobby').addEventListener('click', () => {
    _hideDeathScreen();
    _goLobby(true);
  });
}

function _hideDeathScreen() {
  if (_deathOverlay) { _deathOverlay.remove(); _deathOverlay = null; }
}

function _goLobby(skipSync = false) {
  // มอบหน้าที่ให้ lobby.js จัดการทั้งหมด (รอ drop_ack ก่อน disconnect)
  if (typeof window._goBackToLobby === 'function') {
    window._goBackToLobby();
  }
}

// [FIX #7] แก้ลำดับ drop: unequip ก่อน → drop → clearAll
// ป้องกัน Weapon.updateAmmoUI() อ้างอิง equip ที่ถูก clear ไปแล้ว
function _dropPlayerItems() {
  const toDrop = [];
  if (typeof Backpack !== 'undefined') {
    const eq = Backpack.getEquip();
    Object.entries(eq).forEach(([slotId, itemId]) => {
      if (itemId) {
        const qty = Backpack.getEquippedQtyInSlot(slotId) || 1;
        toDrop.push({ id: itemId, qty });
      }
    });
    Backpack.getItems().forEach(slot => { if (slot.id && slot.qty > 0) toDrop.push({ id: slot.id, qty: slot.qty }); });
  }
  console.log('[DROP] _dropPlayerItems called | toDrop:', JSON.stringify(toDrop), '| socket alive:', !!(typeof Network !== "undefined" && Network.getMyId()));
  if (toDrop.length > 0) {
    Network.sendDropItems(player.x, player.y, toDrop);
    console.log('[DROP] sendDropItems called with', toDrop.length, 'items');
  } else {
    console.log('[DROP] backpack empty, nothing to drop');
  }
  // [FIX #7] ซ่อน HUD ก่อน clearAll
  const _gunIconHud = document.getElementById('gun-icon-hud');
  if (_gunIconHud) _gunIconHud.style.display = 'none';
  const _repHud = document.getElementById('reputation-hud');
  if (_repHud) _repHud.style.display = 'none';
  if (typeof Weapon !== 'undefined') Weapon.updateAmmoUI();
  // ล้างกระเป๋าหลังจาก UI อัพเดตแล้ว
  if (typeof Backpack !== 'undefined') Backpack.clearAll();
  // เก็บ toDrop ไว้ใน memory สำหรับ network.js ใช้ตอน init รอบถัดไป
  // (ต้องทำหลัง clearAll เพราะ clearAll จะ overwrite localStorage)
  if (toDrop.length > 0) {
    window._pendingDropItems = toDrop;
  }
  return toDrop.length > 0;
}

function _doRespawn() {
  const wid = window._selectedWorldId || 'safezone';
  const sp  = (typeof findSafeSpawn !== 'undefined')
    ? findSafeSpawn(wid)
    : { x: CONFIG.WORLD / 2, y: CONFIG.WORLD / 2 };
  player.x     = sp.x;
  player.y     = sp.y;
  player.hp    = player.maxHp;
  player.alive = true;
  _regenTimer  = 0;
  Network.sendRespawn(sp.x, sp.y);
}

// ── hook ให้ entity.js เรียกเมื่อ player ตายจาก zombie/boss ──
window._onPlayerSelfDeath = function(killerName) {
  if (!player) return;
  if (window._devGod) return;  // [DEV] อมตะ
  if (player.hp > 0) return;
  if (!player.alive) return;  // ป้องกัน drop ซ้ำ
  player.alive = false;
  player.hp    = 0;
  _dropPlayerItems();
  if (typeof Ranking !== 'undefined') Ranking.addDeath();
  // [FIX] ถ้ากำลังกลับ lobby อยู่ → drop ของแล้วพอ ไม่ต้องแสดง death screen
  if (window._isLeavingGame) return;
  _showDeathScreen(killerName || null);
};

// ===== INIT =====
function initGame() {
  // [FIX] ล้าง drop cache เก่าก่อนเสมอ — ป้องกันของค้างจากรอบก่อน
  // ข้อมูล drops ที่ถูกต้องจะมาจาก server ผ่าน onInit ใหม่ทุกครั้ง
  Object.keys(_worldDrops).forEach(k => delete _worldDrops[k]);
  if (typeof initWorldCollision !== 'undefined') {
    initWorldCollision(window._selectedWorldId || 'safezone');
  }

  const passive = (typeof Character !== 'undefined') ? Character.getActivePassive() : null;
  const color   = (typeof Character !== 'undefined') ? Character.getActiveColor()   : '#2563EB';
  const charId  = (typeof Character !== 'undefined') ? Character.getSelected().id   : 'default';

  const _wid = window._selectedWorldId || 'safezone';
  const _spawnPt = (typeof findSafeSpawn !== 'undefined')
    ? findSafeSpawn(_wid)
    : { x: CONFIG.WORLD / 2, y: CONFIG.WORLD / 2 };

  player = createPlayer(_spawnPt.x, _spawnPt.y);

  const speedMult    = 1 + (passive ? passive.speedPct  || 0 : 0) / 100;
  player.baseSpeed   = CONFIG.PLAYER_SPEED * speedMult;
  player.speed       = player.baseSpeed;
  player.hp          = CONFIG.PLAYER_HP;
  player.maxHp       = CONFIG.PLAYER_HP;
  // reducePct รวม: character passive + armor (ใช้ค่าสูงสุด)
  const _charReducePct  = passive ? passive.reducePct || 0 : 0;
  const _armorReducePct = (typeof Armor !== 'undefined') ? Armor.getCombinedReducePct() : 0;
  player.reducePct = Math.max(_charReducePct, _armorReducePct);
  // [FIX] regenPct = 0 หมายถึงไม่มี regen เลย, > 0 = regen ต่อวินาที
  // ไม่ใช้ base regen 1 อีกต่อไป เพื่อให้ Default (regenPct=0) ไม่ได้ regen
  const _regenPct = passive ? (passive.regenPct || 0) : 0;
  player.regenPerSec = _regenPct > 0 ? _regenPct : 0;
  player.color       = color;
  player.charId      = charId;
  player.alive       = true;
  _regenTimer        = 0;

  // [FIX MULTIPLAYER] เก็บข้อมูลตัวละครไว้ใน window ให้ network.js ส่งไปด้วยทุก frame
  window._playerColor  = color;
  window._playerCharId = charId;

  if (typeof Backpack !== 'undefined') Backpack.renderPanel();
  if (typeof Weapon   !== 'undefined') Weapon.initAmmo();
  if (typeof Bandage  !== 'undefined') Bandage.init();

  // expose player ให้ bandage.js ใช้
  window._player = player;

  // ── Entity ────────────────────────────────────────────────
  if (typeof Entity !== 'undefined') {
    Entity.init(_wid);
    Entity.onPlayerAttacked((ent, dmg) => {
      _playRandom(_HIT_SOUNDS, 0.7);
      // entity โจมตีผู้เล่นเป็น body เสมอ → สีขาว
      _spawnDmgNum(player.x, player.y + _charTopY(CONFIG.PLAYER_R), dmg, '#ffffff', false);
    });
  }

  // ── Network ───────────────────────────────────────────────
  // [FIX] ลง callbacks ก่อน connect() เสมอ
  // เพื่อกัน race condition: server อาจตอบ 'init' กลับมาก่อนที่ Network.on จะลงทัน

  Network.on('onInit', (id, players, drops) => {
    console.log('[INIT] received drops from server:', (drops||[]).length, JSON.stringify((drops||[]).map(d=>d.dropId)));

    // sync ผู้เล่นที่อยู่ใน world แล้วเข้า remotePlayers ให้ game loop วาดได้
    const rp = Network.getRemotePlayers();
    Object.entries(players).forEach(([pid, pdata]) => {
      if (pid !== id) {
        rp[pid] = Object.assign({ alive: true, hp: 100 }, pdata);
      }
    });

    (drops || []).forEach(d => _addDrop(d));
    console.log('[INIT] _worldDrops after init:', Object.keys(_worldDrops).length);
  });

  // [DEV] dev_stats_ack: server ยืนยันค่า HP/maxHp หลัง SET HP — sync HUD ให้ตรง server
  Network.on('onDevStatsAck', ({ hp, maxHp }) => {
    if (typeof maxHp === 'number') player.maxHp = maxHp;
    if (typeof hp    === 'number') player.hp    = hp;
  });


  Network.on('onTookDamage', ({ hp, damage, hitZone }) => {
    // [DEV] อมตะ — ไม่รับดาเมจ, คง HP เดิม
    if (window._devGod) { return; }
    const prevHp = player.hp;
    player.hp    = hp;
    const dmgTaken = damage ?? (prevHp - hp);
    if (dmgTaken > 0 && !window._isLeavingGame) {
      _playRandom(_HIT_SOUNDS, 0.7);
      const isHead = hitZone === 'head';
      const dmgColor = isHead ? '#ff4444' : '#ffffff';
      _spawnDmgNum(player.x, player.y + _charTopY(CONFIG.PLAYER_R), dmgTaken, dmgColor, isHead);
      // ส่งเสียงโดนดาเมจไปให้ผู้เล่นอื่น
      const _hurtId = _HURT_SOUNDS[Math.floor(Math.random() * _HURT_SOUNDS.length)];
      if (typeof Network !== 'undefined' && Network.sendSound) Network.sendSound(_hurtId);
    }
    if (player.hp <= 0 && player.alive) {
      player.alive = false;
      player.hp    = 0;
      _dropPlayerItems();
      // [FIX] กำลังกลับ lobby → drop ของแล้วพอ ไม่ต้องแสดง death screen
      if (!window._isLeavingGame) _showDeathScreen(null);
    }
  });

  // [FIX] hit_confirm: server ส่งดาเมจจริง (หลังหักเกราะ/headshot) กลับมา
  // ใช้แสดงเลขดาเมจบนเป้าให้ผู้ยิงเห็นค่าที่ถูกต้อง
  Network.on('onHitConfirm', ({ targetId, damage, hitZone }) => {
    const rp = Network.getRemotePlayers()[targetId];
    if (rp) {
      const isHead = hitZone === 'head';
      const dmgColor = isHead ? '#ff4444' : '#ffffff';
      _spawnDmgNum(rp.x, rp.y + _charTopY(CONFIG.PLAYER_R), damage, dmgColor, isHead);
    }
  });

  Network.on('onPlayerDied', ({ id, killerId }) => {
    const rp = Network.getRemotePlayers();

    // ── Reputation: ผู้ฆ่าได้ rep จากการฆ่าผู้เล่น ──────────
    // เรียกเฉพาะฝั่ง killer (คือเรา) เท่านั้น เพื่อไม่ให้คำนวณซ้ำ
    if (killerId === Network.getMyId() && id !== Network.getMyId()) {
      if (typeof Reputation !== 'undefined' && Reputation.get) {
        // หา rep ของเหยื่อจาก remote players (ถ้ามี) ไม่งั้นใช้ 0
        const victimData = rp[id];
        const victimRep  = (victimData && typeof victimData.reputation === 'number')
                           ? victimData.reputation
                           : 0;
        Reputation.onKillPlayer(victimRep);
      }
      // ── Money: รางวัลเงินต่อ kill ─────────────────────────
      if (typeof Money !== 'undefined' && typeof MONEY_CONFIG !== 'undefined') {
        Money.earn('money', MONEY_CONFIG.REWARD_PER_KILL);
      }
      // ── Ranking: นับ kill ──────────────────────────────────
      if (typeof Ranking !== 'undefined') Ranking.addKill();
    }

    if (id === Network.getMyId()) {
      if (player.alive) {
        player.alive = false;
        player.hp    = 0;
        _dropPlayerItems();
      }
      // [FIX] กำลังกลับ lobby → drop ของแล้วพอ ไม่ต้องแสดง death screen
      if (!window._isLeavingGame) {
        const killerName = (killerId && rp[killerId]) ? (rp[killerId].name || 'Unknown') : null;
        // recap จะถูกเซ็ตโดย death_recap event ที่มาก่อนหน้า
        _showDeathScreen(killerName, window._lastDeathRecap || null);
        window._lastDeathRecap = null;
      }
    } else {
      if (rp[id]) rp[id].alive = false;
    }
  });

  Network.on('onDropSpawned',    (drop)         => _addDrop(drop));
  Network.on('onDropRemoved',    ({ dropId })   => _removeDrop(dropId));
  Network.on('onPickupReceived', ({ dropId, items }) => { _removeDrop(dropId); _applyPickup(items); });

  Network.on('onPlayerRespawned', ({ id, x, y, hp }) => {
    const rp = Network.getRemotePlayers();
    if (rp[id]) { rp[id].alive = true; rp[id].hp = hp; rp[id].x = x; rp[id].y = y; }
  });

  // [FIX MULTIPLAYER] callbacks ที่หายไป — ทำให้ผู้เล่นอื่นมองไม่เห็นกัน

  // ผู้เล่นใหม่เข้า world — เพิ่มลงใน remotePlayers
  // [FIX] ต้องใส่ alive: true ด้วย เพราะ server ไม่ส่งมา
  // และใช้ Object.assign แทนการ overwrite ทั้ง object
  // เพื่อไม่ให้ทับข้อมูลที่ network.js เพิ่มไว้แล้ว
  Network.on('onPlayerJoined', (data) => {
    const rp = Network.getRemotePlayers();
    if (!rp[data.id]) {
      rp[data.id] = Object.assign({ alive: true, hp: 100 }, data);
    } else {
      Object.assign(rp[data.id], { alive: true }, data);
    }
  });

  // รับ position/state update จากผู้เล่นอื่น — อัปเดตให้ real-time
  // [FIX] สร้าง entry ใหม่ถ้ายังไม่มี — กรณี A อยู่ก่อน B เข้า
  Network.on('onPlayerUpdate', (data) => {
    const rp = Network.getRemotePlayers();
    if (!rp[data.id]) rp[data.id] = { alive: true, hp: 100 };
    Object.assign(rp[data.id], data);
  });

  // ผู้เล่นออกจาก world — ลบออก
  Network.on('onPlayerLeft', (id) => {
    const rp = Network.getRemotePlayers();
    delete rp[id];
  });

  // กระสุนของผู้เล่นอื่น — สร้าง bullet ให้แสดงในเกม
  Network.on('onBullet', (data) => {
    if (typeof Weapon !== 'undefined' && Weapon.addRemoteBullet) {
      Weapon.addRemoteBullet(data);
    } else {
      // fallback: ใช้ bullets array โดยตรงผ่าน Weapon module ถ้า addRemoteBullet ยังไม่มี
      const rBullet = {
        x:      data.x,
        y:      data.y,
        vx:     data.vx,
        vy:     data.vy,
        dist:   0,
        trail:  [],
        remote: true,  // tag ว่าเป็น bullet จากคนอื่น — ไม่ตรวจ hit กับ remote players
      };
      if (typeof Weapon !== 'undefined') Weapon.getBullets().push(rBullet);
    }
  });

  // server ยืนยัน HP หลังใช้ยา bandage
  Network.on('onHealed', ({ hp }) => {
    if (player) player.hp = hp;
  });

  // ── เสียงจากผู้เล่นอื่น — distance-based volume ──────────
  // maxDist: 800 world px → ยิ่งไกลยิ่งเบา ยิ่งใกล้ยิ่งดัง
  const _REMOTE_SOUND_BASE_VOL = {
    snp_1: 0.9, snp_2: 0.9,
    asr_1: 0.85,
    shg_1: 0.9,
    hurt1: 0.7, hurt2: 0.7,
    heal:  0.6,
    walk:  0.3,
  };
  Network.on('onPlayerSound', ({ id: soundId, x: sx, y: sy }) => {
    if (typeof Sounds === 'undefined' || !Sounds.playAt) return;
    const baseVol = _REMOTE_SOUND_BASE_VOL[soundId] ?? 0.6;
    Sounds.playAt(soundId, baseVol, sx, sy, player.x, player.y, 900);
  });

  // [FIX] connect หลังจาก callbacks พร้อมแล้วเท่านั้น
  Network.connect();
}

// ===== UPDATE =====
let _lastTime = 0;
function update(timestamp) {
  // [FIX #8] clamp dt ไม่เกิน 100ms — ป้องกัน physics กระโดดเมื่อ tab เสีย focus
  const rawDt = timestamp - _lastTime || 16.67;
  const dt    = Math.min(rawDt, 100);
  _lastTime   = timestamp;

  // sync player ref ให้ bandage.js ตลอดเวลา
  window._player = player;

  if (!player.alive) {
    const vw = canvas.width  / CONFIG.ZOOM;
    const vh = canvas.height / CONFIG.ZOOM;
    camera.x = clamp(player.x - vw / 2, 0, CONFIG.WORLD - vw);
    camera.y = clamp(player.y - vh / 2, 0, CONFIG.WORLD - vh);
    // [FIX #9] ไม่ส่ง network update ขณะตาย — ประหยัด bandwidth
    return;
  }

  const { dx, dy } = Input.getMove();
  const aimAngle   = Input.getAimAngle(player, camera);

  player.speed = Input.isSprinting() ? player.baseSpeed * 1.5 : player.baseSpeed;

  updatePlayer(player, dx, dy, aimAngle);
  Weapon.shoot(player);
  Weapon.update();

  // ── Entity ────────────────────────────────────────────────
  if (typeof Entity !== 'undefined') {
    Entity.update(dt, player);

    // [FIX #10] ดึงค่าจาก WEAPON_CONFIG ผ่าน reference เดียว — ไม่ hardcode ชื่อ
    const _eBullets = Weapon.getBullets();
    const _activeGun = Weapon.getActiveGunConfig();   // ← ใช้ getter แทน hardcode
    if (_activeGun) {
      const _bulletR  = _activeGun.bulletR || 4;
      const _baseDmg  = _activeGun.damage;
      _eBullets.forEach(b => {
        if (b._hit) return;
        const result = Entity.checkBulletHit(b.x, b.y, _bulletR);
        if (!result.hit) return;
        b._hit = true;
        const finalDmg = result.isHeadshot ? Math.round(_baseDmg * 2) : _baseDmg;
        _playRandom(_HURT_SOUNDS, result.isHeadshot ? 0.9 : 0.6);
        const ent = Entity.getAlive().find(e => e.id === result.entityId);
        if (ent) _spawnDmgNum(ent.x, ent.y + _charTopY(ENTITY_CONFIG[ent.type].r), finalDmg, result.isHeadshot ? '#ff4444' : '#ffffff', result.isHeadshot);
        Entity.registerHit(result.entityId, _baseDmg, result.isHeadshot);
      });
    }
  }

  // ── เสียงเดิน ─────────────────────────────────────────────
  if (typeof Sounds !== 'undefined') {
    const _stepped = Sounds.tickWalk(dt, player.isMoving, Input.isSprinting());
    // ส่งเสียงเดินไปผู้เล่นอื่นทุกครั้งที่ก้าว (throttle อยู่ใน tickWalk แล้ว)
    if (_stepped && typeof Network !== 'undefined' && Network.sendSound) {
      Network.sendSound('walk');
    }
  }

  // ── regen HP (ทุก ms) ─────────────────────────────────────
  if (player.hp < player.maxHp) {
    player.hp = Math.min(player.maxHp, player.hp + (player.regenPerSec / 100) * dt);
  }

  // ── bullet โดน remote player ──────────────────────────────
  {
    const bullets       = Weapon.getBullets();
    const remotePlayers = Network.getRemotePlayers();
    const wc = (typeof getWorldConfig !== 'undefined' && window._selectedWorldId)
               ? getWorldConfig(window._selectedWorldId) : null;
    const sz = wc && wc.hasSafeZone ? wc.safeZone : null;
    function _inSz(x, y) {
      if (!sz) return false;
      const dx = x - sz.x, dy = y - sz.y;
      return Math.sqrt(dx*dx + dy*dy) < sz.r;
    }
    // [FIX #10] ดึง damage จาก Weapon module — ไม่ hardcode ชื่อ config
    const _gun = Weapon.getActiveGunConfig();
    if (_gun) {
      bullets.forEach(b => {
        if (b._hit || b.remote || _inSz(b.x, b.y)) return;  // [FIX] skip remote bullets
        Object.values(remotePlayers).forEach(rp => {
          if (!rp.alive || _inSz(rp.x, rp.y)) return;
          const dx = b.x - rp.x, dy = b.y - rp.y;
          if (Math.sqrt(dx*dx + dy*dy) < CONFIG.PLAYER_R + 4) {
            b._hit = true;

            // ── ตรวจ hitZone: หัว vs ตัว ────────────────────────
            // หัวอยู่ที่ y < rp.y - (PLAYER_R * 0.3)  (บนสุดของ circle)
            const headThreshold = rp.y - CONFIG.PLAYER_R * 0.3;
            const hitZone = b.y < headThreshold ? 'head' : 'body';

            Network.sendHit(rp.id, _gun.damage, hitZone);
          }
        });
      });
    }
  }

  // ── hold-to-pickup tick ───────────────────────────────────
  _tickPickup(dt);

  // ── damage numbers ────────────────────────────────────────
  for (let i = _rewardNums.length - 1; i >= 0; i--) {
    const n = _rewardNums[i];
    n.timer += dt;
    n.x += n.vx;
    n.y += n.vy;
    n.alpha = Math.max(0, 1 - n.timer / n.life);
    if (n.timer >= n.life) _rewardNums.splice(i, 1);
  }
  for (let i = _dmgNums.length - 1; i >= 0; i--) {
    const n = _dmgNums[i];
    n.timer += dt; n.y += n.vy; n.vy *= 0.94;
    n.alpha = Math.max(0, 1 - n.timer / n.life);
    if (n.timer >= n.life) _dmgNums.splice(i, 1);
  }

  // ── network tick ──────────────────────────────────────────
  _netTick++;
  if (_netTick % 2 === 0) {
    // อัปเดต reducePct รวมก่อนส่ง (armor อาจเปลี่ยนระหว่างเกม)
    if (typeof Armor !== 'undefined') {
      const _charReducePct2 = (typeof Character !== 'undefined' && Character.getActivePassive())
        ? (Character.getActivePassive().reducePct || 0) : 0;
      player.reducePct = Math.max(_charReducePct2, Armor.getCombinedReducePct());
    }
    Network.sendUpdate(player);
  }

  // camera
  const vw = canvas.width  / CONFIG.ZOOM;
  const vh = canvas.height / CONFIG.ZOOM;
  camera.x = clamp(player.x - vw / 2, 0, CONFIG.WORLD - vw);
  camera.y = clamp(player.y - vh / 2, 0, CONFIG.WORLD - vh);
}

// ===== DRAW =====
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(CONFIG.ZOOM, CONFIG.ZOOM);
  ctx.translate(-camera.x, -camera.y);

  drawWorld(ctx);
  Weapon.draw(ctx, player);
  if (typeof Entity !== 'undefined') Entity.draw(ctx);

  _drawDrops(ctx);
  drawPlayer(ctx, player);

  // ── วาด nametag ของตัวเอง (พร้อมรูป rep) ─────────────────
  {
    const r    = CONFIG.PLAYER_R;
    const s    = r / 22;
    const bh   = 46 * s;
    const topY = -bh / 2;
    const selfName = window._playerName || 'Player';
    const selfRep  = (typeof Reputation !== 'undefined' && Reputation.get) ? Reputation.get().rep : 0;
    ctx.save();
    ctx.translate(player.x, player.y);
    _drawNameWithRep(ctx, selfName, selfRep, 0, topY - 14, window._uid || Network.getMyId());
    ctx.restore();
  }

  {
    Object.values(Network.getRemotePlayers()).forEach(rp => {
      if (!rp.alive) return;
      drawRemotePlayer(ctx, rp);
    });
  }

  _dmgNums.forEach(n => {
    ctx.save();
    ctx.globalAlpha  = n.alpha;
    ctx.font         = `bold ${n.size}px Rajdhani, 'Noto Sans Thai', sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle  = 'rgba(0,0,0,0.7)';
    ctx.lineWidth    = 3;
    ctx.strokeText(n.text, n.x, n.y);
    ctx.fillStyle    = n.color;
    ctx.fillText(n.text, n.x, n.y);
    ctx.restore();
  });

  // ── reward floating text ──────────────────────────────────
  _rewardNums.forEach(n => {
    ctx.save();
    ctx.globalAlpha  = n.alpha;
    ctx.font         = `bold ${n.size}px Rajdhani, 'Noto Sans Thai', sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle  = 'rgba(0,0,0,0.85)';
    ctx.lineWidth    = 4;
    ctx.strokeText(n.text, n.x, n.y);
    ctx.fillStyle    = n.color;
    ctx.fillText(n.text, n.x, n.y);
    ctx.restore();
  });

  ctx.restore();

  // drawMinimap(ctx, canvas, player); // removed
  _updateHpHud();
  _updateArmorHud();
  _updateRepHud();
}

// ── วาด drops ────────────────────────────────────────────────
const _DROP_PULSE = { t: 0 };
function _drawDrops(ctx) {
  _DROP_PULSE.t += 0.05;
  const pulse = 0.7 + 0.3 * Math.sin(_DROP_PULSE.t);

  let nearestDrop = null, nearDist2 = Infinity;
  if (player.alive) {
    Object.values(_worldDrops).forEach(drop => {
      const dx = drop.x - player.x, dy = drop.y - player.y;
      const d2 = dx*dx + dy*dy;
      if (d2 < PICKUP_RANGE * PICKUP_RANGE && d2 < nearDist2) { nearDist2 = d2; nearestDrop = drop; }
    });
  }

  Object.values(_worldDrops).forEach(drop => {
    const { x, y, items } = drop;
    const isNearest = nearestDrop && drop.dropId === nearestDrop.dropId;

    ctx.save();
    ctx.globalAlpha = 0.85 * pulse;
    const grad = ctx.createRadialGradient(x, y, 2, x, y, 24);
    grad.addColorStop(0, 'rgba(255,220,50,0.6)');
    grad.addColorStop(1, 'rgba(255,180,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(x, y, 24, 0, Math.PI*2); ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = pulse;
    if (isNearest) {
      ctx.strokeStyle = `rgba(80,230,80,${0.7 + 0.3 * pulse})`;
      ctx.lineWidth = 2.5;
    } else {
      ctx.strokeStyle = '#f5c518';
      ctx.lineWidth = 2;
    }
    ctx.fillStyle = isNearest ? 'rgba(10,30,10,0.9)' : 'rgba(20,18,10,0.85)';
    _roundRect(ctx, x-14, y-14, 28, 28, 5);
    ctx.fill(); ctx.stroke();
    ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = 1;
    ctx.fillText('📦', x, y);
    ctx.restore();

    const total = items.reduce((s, i) => s + i.qty, 0);
    ctx.save();
    ctx.font = 'bold 10px Rajdhani, 'Noto Sans Thai', sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = isNearest ? '#80e080' : '#f5c518';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    ctx.strokeText(`x${total}`, x, y + 22); ctx.fillText(`x${total}`, x, y + 22);
    ctx.restore();
  });
}

function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y); ctx.closePath();
}

// ── HP HUD ───────────────────────────────────────────────────
function _updateHpHud() {
  const hud   = document.getElementById('hp-hud');
  const pctEl = document.getElementById('hp-pct');
  if (!hud || !pctEl) return;

  if (!player || !player.alive || player.hp <= 0) {
    hud.style.display = 'none'; return;
  }
  hud.style.display = 'flex';

  const hp    = Math.max(0, Math.ceil(player.hp    ?? 0));
  const maxHp = Math.max(1, player.maxHp ?? 100);
  const pct   = hp / maxHp;
  const pctRounded = Math.round(pct * 100);

  pctEl.textContent = pctRounded;

  // สีเลือดตาม %
  const col = pct > 0.75 ? '#4cde4c'
            : pct > 0.50 ? '#f0e040'
            : pct > 0.25 ? '#ff8c00'
            :               '#ff3333';

  // อัปเดต silhouette fill — ลดจากบนลงล่าง
  const fillRect = document.getElementById('hp-fill-rect');
  if (fillRect) {
    const totalH = 90;
    const fillH  = Math.round(pct * totalH);
    fillRect.setAttribute('y',      totalH - fillH);
    fillRect.setAttribute('height', fillH);
  }
  const bloodFill = document.getElementById('hp-blood-fill');
  if (bloodFill) bloodFill.setAttribute('fill', col);

  // อัปเดตสีตัวเลขเปอร์เซ็นต์
  pctEl.style.color = col;

}

// ── Armor HUD ────────────────────────────────────────────────
let _armorHudDebugLogged = false;
function _updateArmorHud() {
  if (!window._isInGame) return;
  const hpHud      = document.getElementById('hp-hud');
  const bodyHud    = document.getElementById('armor-body-hud');
  const headHud    = document.getElementById('armor-head-hud');
  if (!bodyHud || !headHud) return;

  if (!player || !player.alive || player.hp <= 0) {
    bodyHud.style.display = 'none';
    headHud.style.display = 'none';
    return;
  }

  const bodyId = (typeof Backpack !== 'undefined') ? Backpack.getEquippedInSlot('body') : null;
  const headId = (typeof Backpack !== 'undefined') ? Backpack.getEquippedInSlot('head') : null;
  const bodyCfg = (bodyId && typeof ARMOR_CONFIG !== 'undefined') ? ARMOR_CONFIG[bodyId] : null;
  const headCfg = (headId && typeof ARMOR_CONFIG !== 'undefined') ? ARMOR_CONFIG[headId] : null;

  // [DEBUG] ล็อกครั้งเดียวเพื่อช่วย debug ปัญหา armor HUD ไม่แสดง
  if (!_armorHudDebugLogged) {
    _armorHudDebugLogged = true;
    console.log('[ARMOR HUD DEBUG]', {
      bodyId, headId, bodyCfg, headCfg,
      hasBackpack: typeof Backpack !== 'undefined',
      hasArmorConfig: typeof ARMOR_CONFIG !== 'undefined',
      hpHudRect: hpHud ? hpHud.getBoundingClientRect() : null,
    });
  }

  // ── ซิงค์สีกรอบตาม HP ─────────────────────────────────────
  const borderColor = hpHud ? hpHud.style.borderTopColor || 'rgba(80,200,80,0.6)' : 'rgba(80,200,80,0.6)';

  // ── Body slot ──────────────────────────────────────────────
  if (bodyId && bodyCfg) {
    const img = document.getElementById('armor-body-img');
    const pct = document.getElementById('armor-body-pct');
    if (img) img.src = 'assets/items/' + bodyId + '.png';
    if (pct) pct.textContent = bodyCfg.armorPct + '%';
    bodyHud.style.display = 'flex';
  } else {
    bodyHud.style.display = 'none';
  }

  // ── Head slot ──────────────────────────────────────────────
  if (headId && headCfg) {
    const img = document.getElementById('armor-head-img');
    const pct = document.getElementById('armor-head-pct');
    if (img) img.src = 'assets/items/' + headId + '.png';
    if (pct) pct.textContent = headCfg.armorPct + '%';
    headHud.style.display = 'flex';
  } else {
    headHud.style.display = 'none';
  }

  // [FIX] armor อยู่ใน gun-icon-hud แล้ว — ไม่ต้องคำนวณตำแหน่ง JS
  // แสดง armor-stack เฉพาะเมื่อมีอย่างน้อยหนึ่งชิ้น
  const armorStack = document.getElementById('armor-stack');
  if (armorStack) {
    const anyArmor = (bodyId && bodyCfg) || (headId && headCfg);
    armorStack.style.display = anyArmor ? 'flex' : 'none';
  }
}

// ── Reputation HUD ───────────────────────────────────────────
function _updateRepHud() {
  if (!window._isInGame) return;
  const hud = document.getElementById('reputation-hud');
  if (!hud) return;

  // แสดง HUD ตลอด (ทั้งตายและมีชีวิต) — ซ่อนเฉพาะตอนออกจากเกม
  hud.style.display = 'flex';
  if (typeof Reputation !== 'undefined' && Reputation.syncHUD) {
    Reputation.syncHUD();
  }
}

// ── วาดผู้เล่นคนอื่น ─────────────────────────────────────────
function drawRemotePlayer(ctx, rp) {
  const r = CONFIG.PLAYER_R;

  // [FIX MULTIPLAYER] normalize rp ให้มีทุก field ที่ drawCharacterBody/drawGunOnPlayer ต้องการ
  // โดยไม่แก้ object ต้นฉบับ (เพราะ network อาจ update ตลอดเวลา)
  const fakePlayer = {
    x:         rp.x,
    y:         rp.y,
    r:         r,
    angle:     rp.angle     ?? 0,
    color:     rp.color     || '#888888',
    charId:    rp.charId    || 'default',
    walkTimer: rp.walkTimer ?? 0,
    isMoving:  rp.isMoving  ?? false,
    trail:     [],           // ไม่วาด trail ของคนอื่น
    hp:        rp.hp        ?? 100,
    maxHp:     100,
    alive:     true,
    name:      rp.name      || '?',
    gunId:     rp.gunId     || null,
    isAiming:  rp.isAiming  ?? false,
  };

  // วาด character body ด้วย model จริง (model_character.js)
  if (typeof drawCharacterBody === 'function') {
    drawCharacterBody(ctx, fakePlayer);
  } else {
    ctx.save();
    // fallback: วงกลมธรรมดา
    ctx.translate(rp.x, rp.y);
    ctx.fillStyle = fakePlayer.color;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // วาดปืน (model_weapon.js)
  if (typeof drawGunOnPlayer === 'function') {
    drawGunOnPlayer(ctx, fakePlayer);
  }

  // วาด nametag + HP bar เหนือหัว
  ctx.save();
  ctx.translate(rp.x, rp.y);

  const s    = r / 22;
  const bh   = 46 * s;
  const topY = -bh / 2;

  // nametag (พร้อมรูป rep)
  _drawNameWithRep(ctx, fakePlayer.name, rp.reputation, 0, topY - 14, rp.uid || rp.id);

  // HP bar
  const barW  = r * 2.5;
  const barH  = 5;
  const barX  = -barW / 2;
  const barY  = topY - 12;
  const hpPct = Math.max(0, (rp.hp ?? 100) / 100);
  const hpCol = hpPct > 0.5 ? '#4caf50' : hpPct > 0.25 ? '#ff9800' : '#f44336';
  ctx.fillStyle = '#333'; ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = hpCol;  ctx.fillRect(barX, barY, barW * hpPct, barH);
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, barH);

  ctx.restore();
}

// ===== LOOP =====
let _rafId = null;

function loop(timestamp) {
  _rafId = requestAnimationFrame(loop);
  update(timestamp);
  draw();
}

// ===== START =====
// [FIX] ยกเลิก loop เก่าก่อนเริ่มใหม่ — ป้องกัน loop ซ้อนกันเมื่อเข้าเกมครั้งที่ 2
if (_rafId !== null) {
  cancelAnimationFrame(_rafId);
  _rafId = null;
}
// [FIX] ตั้ง _isInGame = true ทันทีที่ game.js โหลด — ทำให้ Armor HUD แสดงได้ตั้งแต่เริ่มเกม
window._isInGame = true;
initGame();
_rafId = requestAnimationFrame(loop);

// expose pickup hold controls
window.startPickupHold = startPickupHold;
window.stopPickupHold  = stopPickupHold;

// Keyboard hold-to-pickup — อ่านจาก KeyBinds (default: E)
window.addEventListener('keydown', (e) => {
  const k = (typeof KeyBinds !== 'undefined') ? KeyBinds.get('pickup').toLowerCase() : 'e';
  if (e.key.toLowerCase() === k) startPickupHold();
});
window.addEventListener('keyup', (e) => {
  const k = (typeof KeyBinds !== 'undefined') ? KeyBinds.get('pickup').toLowerCase() : 'e';
  if (e.key.toLowerCase() === k) stopPickupHold();
});

// [FIX] expose _stopGameLoop ให้ lobby.js เรียกเพื่อหยุด loop ก่อนกลับ lobby
window._stopGameLoop = function() {
  if (_rafId !== null) {
    cancelAnimationFrame(_rafId);
    _rafId = null;
  }
  window._isInGame = false;
  // ซ่อน HUD ทั้งหมดเมื่อออกจากเกม
  const _ids = ['hp-hud', 'gun-icon-hud', 'reputation-hud'];
  _ids.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
};

window._startGameLoop = function() {
  if (_rafId !== null) { cancelAnimationFrame(_rafId); _rafId = null; }
  window._isInGame = true;
  _lastTime = 0;
  // แสดง reputation-hud ทันทีที่เข้าเกม
  const _repHudEl = document.getElementById('reputation-hud');
  if (_repHudEl) _repHudEl.style.display = 'flex';
  if (typeof Reputation !== 'undefined' && Reputation.syncHUD) Reputation.syncHUD();
  _rafId = requestAnimationFrame(loop);
};
