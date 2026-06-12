// ===== SERVICE WORKER — THEPLAYZ =====
// Cache Version: เปลี่ยนตัวเลขนี้ทุกครั้งที่ deploy โค้ดใหม่
// เพื่อให้ผู้เล่นได้รับไฟล์อัปเดตแทนไฟล์เก่าจาก cache
const CACHE_NAME = 'theplayz-v1.1.76';

// ── รายการไฟล์ static ที่ cache ตั้งแต่ติดตั้ง ──────────────────
// (ไฟล์เหล่านี้โหลดเร็วขึ้นมากเพราะมาจาก cache แทน network)
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',

  // CSS
  '/css/auth.css',
  '/css/base.css',
  '/css/bottom.css',
  '/css/character.css',
  '/css/game.css',
  '/css/hud.css',
  '/css/inventory.css',
  '/css/loading.css',
  '/css/lobby.css',
  '/css/world_select.css',

  // JS — config (ไม่ค่อยเปลี่ยน)
  '/js/config.js',
  '/js/config_armor.js',
  '/js/config_character.js',
  '/js/config_entity.js',
  '/js/config_gacha.js',
  '/js/config_money.js',
  '/js/config_reputation.js',
  '/js/config_shop.js',
  '/js/config_weapon.js',
  '/js/config_world.js',

  // JS — game logic
  '/js/armor.js',
  '/js/auth.js',
  '/js/backpack.js',
  '/js/bandage.js',
  '/js/character.js',
  '/js/entity.js',
  '/js/error-log.js',
  '/js/gacha.js',
  '/js/game.js',
  '/js/input.js',
  '/js/inventory.js',
  '/js/items.js',
  '/js/loader.js',
  '/js/loading.js',
  '/js/lobby.js',
  '/js/model_character.js',
  '/js/model_weapon.js',
  '/js/money.js',
  '/js/network.js',
  '/js/player.js',
  '/js/reputation.js',
  '/js/shop.js',
  '/js/sounds.js',
  '/js/spawn.js',
  '/js/stash.js',
  '/js/utils.js',
  '/js/weapon.js',
  '/js/world.js',
  '/js/world_airport.js',
  '/js/world_safezone.js',
  '/js/world_select.js',
  '/js/world_snow.js',

  // เสียง
  '/assets/sounds/asr_1.ogg',
  '/assets/sounds/backpack.ogg',
  '/assets/sounds/click.ogg',
  '/assets/sounds/heal.ogg',
  '/assets/sounds/hit1.ogg',
  '/assets/sounds/hit2.ogg',
  '/assets/sounds/hit3.ogg',
  '/assets/sounds/hurt1.ogg',
  '/assets/sounds/hurt2.ogg',
  '/assets/sounds/shg_1.ogg',
  '/assets/sounds/snp_1.ogg',
  '/assets/sounds/snp_2.ogg',
  '/assets/sounds/walk.ogg',

  // รูปตัวละคร
  '/assets/characters/yagi.png',

  // รูปอาวุธ / ไอเทม
  '/assets/items/asr_blueact.png',
  '/assets/items/asr_chicago.png',
  '/assets/items/asr_evil.png',
  '/assets/items/asr_lucifer.png',
  '/assets/items/asr_piggy.png',
  '/assets/items/asr_reddevil.png',
  '/assets/items/bandage.png',
  '/assets/items/body_blueact.png',
  '/assets/items/body_chicago.png',
  '/assets/items/body_evil.png',
  '/assets/items/body_lucifer.png',
  '/assets/items/body_piggy.png',
  '/assets/items/body_ppap.png',
  '/assets/items/body_reddevil.png',
  '/assets/items/head_blueact.png',
  '/assets/items/head_chicago.png',
  '/assets/items/head_evil.png',
  '/assets/items/head_lucifer.png',
  '/assets/items/head_piggy.png',
  '/assets/items/head_ppap.png',
  '/assets/items/head_reddevil.png',
  '/assets/items/snp_blueact.png',
  '/assets/items/snp_chicago.png',
  '/assets/items/snp_evil.png',
  '/assets/items/snp_lucifer.png',
  '/assets/items/snp_piggy.png',
  '/assets/items/snp_ppap.png',
  '/assets/items/snp_reddevil.png',

  // รูป reputation
  '/assets/reputations/assassin.png',
  '/assets/reputations/bandit.png',
  '/assets/reputations/constable.png',
  '/assets/reputations/deputy.png',
  '/assets/reputations/guardian.png',
  '/assets/reputations/hitman.png',
  '/assets/reputations/lawmen.png',
  '/assets/reputations/outlaw.png',
  '/assets/reputations/paragon.png',
  '/assets/reputations/thuglife.png',
  '/assets/reputations/vigilante.png',
  '/assets/reputations/villain.png',
];

// ── URL ที่ห้าม cache เด็ดขาด (network เสมอ) ─────────────────
// socket.io ต้องการ real-time connection จึง bypass cache ทั้งหมด
const NETWORK_ONLY = [
  '/socket.io/',
];

// ────────────────────────────────────────────────────────────────
// INSTALL — precache ทุกไฟล์ static ทันที
// ────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Precaching', PRECACHE_URLS.length, 'files...');
      // addAll จะ fail ทั้งหมดถ้าไฟล์ใดไฟล์หนึ่งโหลดไม่ได้
      // ใช้ Promise.allSettled ผ่าน add ทีละไฟล์แทนเพื่อ resilience
      return Promise.allSettled(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(err =>
            console.warn('[SW] Precache failed:', url, err)
          )
        )
      );
    }).then(() => {
      console.log('[SW] Install complete — skipWaiting');
      return self.skipWaiting(); // activate ทันทีโดยไม่รอ tab เก่าปิด
    })
  );
});

// ────────────────────────────────────────────────────────────────
// ACTIVATE — ลบ cache เก่าออก
// ────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => {
      console.log('[SW] Activate complete — claiming clients');
      return self.clients.claim(); // ควบคุม tab ที่เปิดอยู่ทันที
    })
  );
});

// ────────────────────────────────────────────────────────────────
// FETCH — กลยุทธ์แยกตาม URL
// ────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1) Network-only: socket.io และ request ข้าม origin
  if (
    NETWORK_ONLY.some(p => url.pathname.startsWith(p)) ||
    url.origin !== self.location.origin
  ) {
    return; // ปล่อยผ่านไปยัง network ปกติ
  }

  // 2) HTML — Network First (ได้โค้ดใหม่เสมอ, fallback ถ้า offline)
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstStrategy(event.request));
    return;
  }

  // 3) Assets (รูป, เสียง, CSS, JS) — Cache First (เร็วสุด)
  event.respondWith(cacheFirstStrategy(event.request));
});

// ── Cache First: ดึงจาก cache ก่อน, miss → network แล้วเก็บ cache ──
async function cacheFirstStrategy(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone()); // เก็บสำหรับครั้งต่อไป
    }
    return response;
  } catch {
    console.warn('[SW] Cache first — network failed for:', request.url);
    return new Response('Offline', { status: 503 });
  }
}

// ── Network First: ดึงจาก network ก่อน, fail → fallback cache ──
async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('<h1>THEPLAYZ — Offline</h1><p>ต้องการ internet เพื่อเล่นเกม</p>', {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}
