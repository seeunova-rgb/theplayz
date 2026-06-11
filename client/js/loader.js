// ===== LOADER.JS =====
// โหลด CSS ทั้งหมด พร้อม cache-bust บน localhost

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
