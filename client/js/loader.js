// ===== LOADER.JS =====
// โหลด CSS ทั้งหมด พร้อม cache-bust บน localhost

(function () {

  // ── ล็อกขนาดหน้าจอ ──────────────────────────────────────────
  // ใช้ screen.width/height แทน innerWidth/innerHeight
  // เพราะ screen.* ไม่เปลี่ยนตาม address bar หรือ keyboard เลย
  function getSize() {
    // ใช้ขนาด viewport จริงที่มองเห็นได้ (ไม่รวม address bar/system bar ที่บัง)
    // screen.* ใช้เป็น fallback เท่านั้น เพราะอาจรายงานขนาดเกินพื้นที่ที่ render ได้จริง
    var iw = window.innerWidth  || 0;
    var ih = window.innerHeight || 0;
    var sw = iw || screen.width  || 0;
    var sh = ih || screen.height || 0;
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

  // ป้องกัน pinch-zoom และ scroll นอก scrollable container
  function isInsideScrollable(el) {
    while (el && el !== document.body) {
      var style = window.getComputedStyle(el);
      var overflowY = style.overflowY;
      if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
        return true;
      }
      el = el.parentElement;
    }
    return false;
  }

  document.addEventListener('touchstart', function (e) { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  document.addEventListener('touchmove',  function (e) {
    if (e.touches.length > 1) { e.preventDefault(); return; }
    if (!isInsideScrollable(e.target)) e.preventDefault();
  }, { passive: false });
  document.addEventListener('wheel', function (e) {
    if (!isInsideScrollable(e.target)) e.preventDefault();
  }, { passive: false });
  window.addEventListener('scroll', function () { window.scrollTo(0, 0); }, { passive: true });

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
