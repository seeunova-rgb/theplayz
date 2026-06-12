// ===== LOADER.JS =====
// โหลด CSS ทั้งหมด พร้อม cache-bust บน localhost

// ── ป้องกัน scroll/zoom บนมือถือ (กัน address bar ขยับ layout) ──
document.addEventListener('touchmove', function(e) {
  if (e.target.closest('.allow-scroll')) return;
  e.preventDefault();
}, { passive: false });

document.addEventListener('touchstart', function(e) {
  if (e.touches.length > 1) e.preventDefault(); // ป้องกัน pinch-zoom
}, { passive: false });

// ล็อก scroll position ที่ window level
window.addEventListener('scroll', function() {
  window.scrollTo(0, 0);
}, { passive: true });

(function () {
  const _v = (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.port === '1106')
    ? Date.now() : '1';
  ['base', 'auth', 'lobby', 'inventory', 'game', 'hud', 'character', 'bottom'].forEach(n => {
    const link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = `css/${n}.css?v=${_v}`;
    document.head.appendChild(link);
  });
})();
