// ===== fps.js =====
// FPS Counter — แสดงผลครอบคลุมทั้ง lobby และในเกม
// เปิด/ปิดได้จาก SETTINGS, ค่าที่เลือกถูกบันทึกใน localStorage
(function () {
  const STORAGE_KEY = 'theplayz_fps_enabled';

  let enabled  = localStorage.getItem(STORAGE_KEY) === '1';
  let el       = null;
  let frames   = 0;
  let lastTime = performance.now();
  let rafId    = null;

  function ensureEl() {
    if (el) return el;
    el = document.createElement('div');
    el.id = 'fps-counter';
    el.textContent = 'FPS: --';
    document.body.appendChild(el);
    return el;
  }

  function tick(now) {
    rafId = requestAnimationFrame(tick);
    frames++;
    const delta = now - lastTime;
    if (delta >= 500) { // อัปเดตทุกครึ่งวินาที
      const fps = Math.round((frames * 1000) / delta);
      if (el) el.textContent = 'FPS: ' + fps;
      frames   = 0;
      lastTime = now;
    }
  }

  function start() {
    ensureEl().classList.add('active');
    if (rafId === null) {
      frames   = 0;
      lastTime = performance.now();
      rafId = requestAnimationFrame(tick);
    }
  }

  function stop() {
    if (el) el.classList.remove('active');
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function setEnabled(val) {
    enabled = !!val;
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
    if (enabled) start(); else stop();
  }

  function init() {
    ensureEl();
    if (enabled) start();

    // ผูกกับ checkbox ใน SETTINGS (ถ้ามีในหน้านี้)
    const checkbox = document.getElementById('toggle-fps');
    if (checkbox) {
      checkbox.checked = enabled;
      checkbox.addEventListener('change', () => setEnabled(checkbox.checked));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // expose API
  window.FPSCounter = { setEnabled, isEnabled: () => enabled };
})();
