// ===== WEAPON.JS =====
const Weapon = (() => {

  let bullets     = [];
  let lastShot    = 0;
  let muzzleFlash = 0;
  let ammo        = 0;
  let reloading   = false;

  // ── ดึง GUN id และ config แบบ dynamic ─────────────────────
  // [FIX] เดิม hardcode 'snp_reddevil' → ทำให้ asr_reddevil ยิงไม่ได้
  function _getActiveGunId() {
    if (typeof Backpack === 'undefined') return null;
    return Backpack.getEquippedInSlot('gun') || null;
  }
  function _getActiveGunConfig() {
    const id = _getActiveGunId();
    return (id && WEAPON_CONFIG[id]) ? WEAPON_CONFIG[id] : null;
  }

  // ── stat bar references (max values สำหรับคำนวณ %) ────────
  // ดึงจาก WEAPON_CONFIG ทุกปืนเพื่อ normalize bar อัตโนมัติ
  function _getStatRanges() {
    const all = Object.values(WEAPON_CONFIG);
    return {
      maxDmg:    Math.max(...all.map(g => g.damage)),
      minFire:   Math.min(...all.map(g => g.fireRate)),  // เร็วสุด = bar เต็ม
      maxFire:   Math.max(...all.map(g => g.fireRate)),
      maxRange:  Math.max(...all.map(g => g.range)),
      maxReload: Math.max(...all.map(g => g.reloadTime)), // นานสุด = bar ว่าง
      minReload: Math.min(...all.map(g => g.reloadTime)),
    };
  }

  function _setBar(id, pct) {
    const el = document.getElementById(id);
    if (el) el.style.width = Math.round(Math.max(5, Math.min(100, pct))) + '%';
  }
  function _setNum(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function updateAmmoUI() {
    const hud = document.getElementById('ammo-hud');
    const cur = document.getElementById('ammo-cur');
    const max = document.getElementById('ammo-max');
    const reloadBtn = document.getElementById('reload-btn');
    if (!cur || !max || !hud) return;
    if (!hasGun()) {
      hud.style.display = 'none';
      if (reloadBtn) reloadBtn.style.display = 'none';
      const _gih = document.getElementById('gun-icon-hud');
      if (_gih) _gih.style.display = 'none';
      return;
    }
    hud.style.display = 'flex';
    // แสดงปุ่ม reload เสมอเมื่อมีปืน
    if (reloadBtn) {
      reloadBtn.style.display = 'flex';
      if (reloading) {
        reloadBtn.classList.add('reloading');
      } else {
        reloadBtn.classList.remove('reloading');
      }
    }
    if (reloading) {
      cur.textContent = '↺';
      cur.style.color = '#ffaa00';
    } else {
      cur.textContent = ammo;
      cur.style.color = ammo <= 1 ? '#ff2222' : '#ff4444';
    }
    const boxes = typeof Backpack !== 'undefined' ? Backpack.countItems('ammo_box') : 0;
    max.textContent = boxes;

    // อัปเดต ชื่อปืน + stat bars จาก config
    const gunId = _getActiveGunId();
    const GUN   = _getActiveGunConfig();
    const nameEl = document.getElementById('stat-gun-name');
    if (nameEl && GUN && gunId) {
      nameEl.textContent = gunId.replace(/_/g, ' ').toUpperCase();
    }
    if (GUN) {
      const r = _getStatRanges();
      // Damage bar
      const dmgPct = (GUN.damage / r.maxDmg) * 100;
      _setBar('bar-damage', dmgPct);
      _setNum('stat-damage', GUN.damage);
      // Fire Rate bar (fireRate ต่ำ = เร็ว = bar เต็ม)
      const firePct = ((r.maxFire - GUN.fireRate) / (r.maxFire - r.minFire)) * 100;
      _setBar('bar-firerate', firePct);
      _setNum('stat-firerate', (1000 / GUN.fireRate).toFixed(1) + '/s');
      // Range bar
      const rngPct = (GUN.range / r.maxRange) * 100;
      _setBar('bar-range', rngPct);
      _setNum('stat-range', GUN.range);
      // Reload bar (reloadTime ต่ำ = เร็ว = bar เต็ม)
      const rldPct = ((r.maxReload - GUN.reloadTime) / (r.maxReload - r.minReload)) * 100;
      _setBar('bar-reload', rldPct);
      _setNum('stat-reload', (GUN.reloadTime / 1000).toFixed(1) + 's');
    }

    // ── อัปเดต Gun Icon HUD ─────────────────────────────────
    const gunIconHud = document.getElementById('gun-icon-hud');
    const gunIconImg = document.getElementById('gun-icon-img');
    if (gunIconHud && gunIconImg) {
      if (gunId) {
        // หา item config เพื่อเอา image path
        let imgSrc = 'assets/items/' + gunId + '.png';
        if (typeof SHOP_ITEMS !== 'undefined' && SHOP_ITEMS.weapon) {
          const itemCfg = SHOP_ITEMS.weapon.find(w => w.id === gunId);
          if (itemCfg && itemCfg.equip && itemCfg.equip.img) {
            imgSrc = itemCfg.equip.img;
          }
        }
        gunIconImg.src = imgSrc;
        gunIconHud.style.display = 'flex';
        // วางตำแหน่ง gun-icon-hud ให้ชิดซ้ายของ ammo-hud
        const ammoRect = hud.getBoundingClientRect();
        const iconWidth = gunIconHud.offsetWidth || 76;
        gunIconHud.style.right = (window.innerWidth - ammoRect.left + 2) + 'px';
        gunIconHud.style.bottom = '0px';
      } else {
        gunIconHud.style.display = 'none';
      }
    }
  }

  function hasGun()     { return _getActiveGunId() !== null; }
  function hasAmmoBox() { return typeof Backpack !== 'undefined' && Backpack.countItems('ammo_box') > 0; }

  function reload() {
    const GUN = _getActiveGunConfig();
    if (reloading) return;
    if (!GUN) return;
    if (!hasAmmoBox()) {
      if (typeof window.showToast === 'function')
        window.showToast('กระสุนหมด! ซื้อ AMMO BOX ที่ SHOP', 'error');
      return;
    }
    const reloadGunId = _getActiveGunId(); // [FIX] ล็อค gunId ก่อน setTimeout กัน save ผิด key
    reloading = true;
    updateAmmoUI();
    if (GUN.sounds?.reload) Sounds.play(GUN.sounds.reload, 0.8);
    setTimeout(() => {
      Backpack.consumeFromItems('ammo_box');
      ammo = GUN.maxAmmo;
      reloading = false;
      saveAmmo(reloadGunId); // [FIX] ส่ง gunId ที่ล็อคไว้ก่อน setTimeout
      updateAmmoUI();
      if (typeof Inventory !== 'undefined') Inventory.render();
      if (typeof Backpack !== 'undefined') Backpack.renderPanel();
    }, GUN.reloadTime);
  }

  // ── helper: เช็คว่าผู้เล่นอยู่ใน safezone หรือไม่ ───────
  function _inSafeZone(player) {
    const wid = window._selectedWorldId || 'safezone';
    const wc  = (typeof getWorldConfig !== 'undefined') ? getWorldConfig(wid) : null;
    if (!wc || !wc.hasSafeZone || !wc.noShootInSafeZone || !wc.safeZone) return false;
    const sz = wc.safeZone;
    const dx = player.x - sz.x, dy = player.y - sz.y;
    return Math.sqrt(dx * dx + dy * dy) <= sz.r;
  }

  function shoot(player) {
    const GUN = _getActiveGunConfig();
    const now = Date.now();
    if (!GUN) return;
    if (now - lastShot < GUN.fireRate) return;
    if (!Input.isAiming()) return;
    if (reloading) return;
    if (ammo <= 0) { reload(); return; }

    if (_inSafeZone(player)) {
      if (typeof window.showToast === 'function')
        window.showToast('⛔ ยิงไม่ได้ในเขต SAFE ZONE', 'error');
      return;
    }

    lastShot = now;
    muzzleFlash = 4;
    ammo--;
    saveAmmo(_getActiveGunId()); // [FIX] ส่ง gunId ตรงๆ กันบัคค่ากระสุนปืน A ถูก save ทับ key ปืน B
    if (GUN.sounds?.fire) Sounds.play(GUN.sounds.fire, 0.8);
    updateAmmoUI();
    if (ammo <= 0) reload();

    const angle = player.angle;
    const bullet = {
      x:     player.x + Math.cos(angle) * player.r * 1.2,
      y:     player.y + Math.sin(angle) * player.r * 1.2,
      vx:    Math.cos(angle) * GUN.speed,
      vy:    Math.sin(angle) * GUN.speed,
      dist:  0,
      trail: [],
    };
    bullets.push(bullet);

    if (typeof Network !== 'undefined') Network.sendBullet(bullet, angle);
  }

  // ── ammo persistence — แยก key ต่อ gun id ────────────────
  function _ammoKey(gunId) {
    const id  = gunId || _getActiveGunId() || 'none';
    const uid = typeof Backpack !== 'undefined' && Backpack.getUid ? Backpack.getUid() : 'default';
    return 'theplayz_ammo_' + uid + '_' + id;
  }
  function saveAmmo(gunId) {
    try { localStorage.setItem(_ammoKey(gunId), JSON.stringify({ ammo, reloading })); } catch {}
  }
  function loadAmmo(gunId) {
    try {
      const raw = localStorage.getItem(_ammoKey(gunId));
      if (raw) {
        const d = JSON.parse(raw);
        ammo = d.ammo ?? 0;
        reloading = false;
        return true;
      }
    } catch {}
    return false;
  }

  function initAmmo(gunId) {
    // ถ้าส่ง gunId มา → ใช้โดยตรง (กัน race condition กับ Backpack slot update)
    // ถ้าไม่ส่ง → fallback ไป _getActiveGunConfig() ตามปกติ
    const GUN = gunId ? WEAPON_CONFIG[gunId] : _getActiveGunConfig();
    const resolvedGunId = gunId || _getActiveGunId();
    reloading = false;
    if (GUN && loadAmmo(resolvedGunId)) {
      // [FIX] clamp ป้องกันกระสุนเกิน maxAmmo ของปืนนี้ (เช่น save ค่า asr 30 แล้วโหลดให้ snp)
      ammo = Math.min(ammo, GUN.maxAmmo);
      saveAmmo(resolvedGunId);
    } else if (GUN && hasAmmoBox()) {
      Backpack.consumeFromItems('ammo_box');
      ammo = GUN.maxAmmo;
      saveAmmo(resolvedGunId);
    } else {
      ammo = 0;
      saveAmmo(resolvedGunId);
    }
    updateAmmoUI();
  }

  // ── reset เมื่อเปลี่ยนปืน ──────────────────────────────────
  window.addEventListener('gun_equip_changed', (e) => {
    reloading = false;
    bullets   = [];
    muzzleFlash = 0;
    // ส่ง gunId จาก event โดยตรง — ไม่พึ่ง _getActiveGunId()
    // เพราะ Backpack อาจยังไม่ได้อัปเดต slot ในขณะที่ event ถูก dispatch
    const newGunId = e?.detail?.gunId ?? null;
    initAmmo(newGunId);
  });

  function update() {
    const GUN = _getActiveGunConfig() || WEAPON_CONFIG.snp_reddevil;
    if (muzzleFlash > 0) muzzleFlash--;
    bullets = bullets.filter(b => {
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > GUN.trailLen) b.trail.shift();
      b.x += b.vx;
      b.y += b.vy;
      b.dist += GUN.speed;
      if (b.dist >= GUN.range) return false;
      if (b.x < 0 || b.x > CONFIG.WORLD || b.y < 0 || b.y > CONFIG.WORLD) return false;
      if (typeof wallCollide === 'function' && wallCollide(b.x, b.y, GUN.bulletR)) return false;
      return true;
    });
  }

  function draw(ctx, player) {
    if (hasGun()) drawMuzzleFlash(ctx, player, muzzleFlash);
    drawBullets(ctx, bullets);
  }

  updateAmmoUI();
  // ผูก reload button
  const _reloadBtn = document.getElementById('reload-btn');
  if (_reloadBtn) {
    _reloadBtn.addEventListener('click', () => reload());
    _reloadBtn.addEventListener('touchstart', (e) => { e.preventDefault(); reload(); }, { passive: false });
  }

  function getActiveGunConfig() {
    return _getActiveGunConfig();
  }

  // [FIX MULTIPLAYER] เพิ่ม bullet จาก remote player เข้า array
  // remote bullets แสดงภาพแต่ไม่ตรวจ hit กับ remote players (server เป็น source of truth)
  function addRemoteBullet(data) {
    bullets.push({
      x:      data.x,
      y:      data.y,
      vx:     data.vx,
      vy:     data.vy,
      dist:   0,
      trail:  [],
      remote: true,
    });
  }

  return { shoot, update, draw, getBullets: () => bullets, initAmmo, updateAmmoUI, getActiveGunConfig, addRemoteBullet };
})();

window.Weapon = Weapon;
