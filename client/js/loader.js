// ===== LOADER.JS =====
// โหลด CSS ทั้งหมด พร้อม cache-bust บน localhost

(function () {

  // ── ล็อกขนาดหน้าจอ ──────────────────────────────────────────
  // ใช้ screen.width/height แทน innerWidth/innerHeight
  // เพราะ screen.* ไม่เปลี่ยนตาม address bar หรือ keyboard เลย
  function getSize() {
    // landscape → W > H เสมอ
    var sw = screen.width  || window.innerWidth;
    var sh = screen.height || window.innerHeight;
    // ถ้า portrait ให้สลับเพราะเกมบังคับ landscape
    return (sw > sh) ? { W: sw, H: sh } : { W: sh, H: sw };
  }

  var size = getSize();

  function lock() {
    var root = document.documentElement;
    root.style.setProperty('--app-width',  size.W + 'px');
    root.style.setProperty('--app-height', size.H + 'px');
  }

  lock();

  // อัปเดตเมื่อหมุนจอเท่านั้น
  window.addEventListener('resize', function () {
    var newSize = getSize();
    if (newSize.W !== size.W || newSize.H !== size.H) {
      size = newSize;
      lock();
    }
  });

  // ป้องกัน pinch-zoom และ scroll
  document.addEventListener('touchstart', function (e) { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  document.addEventListener('touchmove',  function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener('wheel',      function (e) { e.preventDefault(); }, { passive: false });
  window.addEventListener(  'scroll',     function ()  { window.scrollTo(0, 0); }, { passive: true });

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
