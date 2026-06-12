// ===== LOADER.JS =====
// โหลด CSS ทั้งหมด พร้อม cache-bust บน localhost

(function () {
  // ── ล็อกขนาดหน้าจอ ──────────────────────────────────────────
  // วัดครั้งเดียวตอน script โหลด แล้วไม่เปลี่ยนอีกเลย
  // ไม่ว่า address bar จะซ่อน/แสดง, keyboard popup, หรืออะไรก็ตาม
  var W = window.innerWidth;
  var H = window.innerHeight;

  function lock() {
    var root = document.documentElement;
    root.style.setProperty('--app-width',  W + 'px');
    root.style.setProperty('--app-height', H + 'px');
  }

  lock();

  // อัปเดตเฉพาะตอนหมุนจอ (ทั้ง W และ H เปลี่ยนสลับกัน)
  window.addEventListener('resize', function () {
    var newW = window.innerWidth;
    var newH = window.innerHeight;
    var rotated = (newW > newH) !== (W > newH) || (newH > newW) !== (H > newW);
    if (rotated) {
      W = newW;
      H = newH;
      lock();
    }
    // address bar, keyboard, หรืออื่นๆ → เพิกเฉย
  });

  // ป้องกัน pinch-zoom และ scroll ทั้งหมด
  document.addEventListener('touchstart',  function (e) { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  document.addEventListener('touchmove',   function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener('wheel',       function (e) { e.preventDefault(); }, { passive: false });
  window.addEventListener(  'scroll',      function ()  { window.scrollTo(0, 0); }, { passive: true });

  // ── โหลด CSS ─────────────────────────────────────────────────
  var _v = (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.port === '1106')
    ? Date.now() : '1';
  ['base', 'auth', 'lobby', 'inventory', 'game', 'hud', 'character', 'bottom'].forEach(function (n) {
    var link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = 'css/' + n + '.css?v=' + _v;
    document.head.appendChild(link);
  });
})();
