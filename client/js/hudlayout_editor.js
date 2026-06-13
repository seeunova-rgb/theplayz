// ===== HUDLAYOUT_EDITOR.JS =====
// UI สำหรับลากปุ่ม HUD เพื่อจัดตำแหน่งเอง (โหมดแก้ไข)
// เปิดจากปุ่มใน Settings → เข้าสู่เกม (หรือแสดง HUD แบบ preview) แล้วลากปุ่มได้

const HUDLayoutEditor = (() => {

  let _active = false;
  let _drag   = null; // { id, startX, startY, baseX, baseY }

  function isActive() { return _active; }

  function open() {
    if (_active) return;
    _active = true;

    // สร้าง overlay แถบควบคุมด้านบน
    let bar = document.getElementById('hud-edit-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'hud-edit-bar';
      bar.innerHTML = `
        <span class="hud-edit-title">🧩 ลากปุ่มเพื่อจัดตำแหน่ง</span>
        <button id="hud-edit-reset" class="hud-edit-btn">รีเซ็ตทั้งหมด</button>
        <button id="hud-edit-done"  class="hud-edit-btn hud-edit-done">เสร็จสิ้น</button>
      `;
      document.body.appendChild(bar);

      document.getElementById('hud-edit-reset').addEventListener('click', () => {
        HUDLayout.resetAll();
        if (typeof showToast === 'function') showToast('รีเซ็ตตำแหน่งปุ่มทั้งหมดแล้ว', 'success');
      });
      document.getElementById('hud-edit-done').addEventListener('click', close);
    }
    bar.style.display = 'flex';

    document.body.classList.add('hud-edit-mode');

    Object.keys(HUDLayout.ELEMENTS).forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.add('hud-edit-target');
      el.addEventListener('pointerdown', onPointerDown);
    });

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup',   onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }

  function close() {
    if (!_active) return;
    _active = false;

    const bar = document.getElementById('hud-edit-bar');
    if (bar) bar.style.display = 'none';

    document.body.classList.remove('hud-edit-mode');

    Object.keys(HUDLayout.ELEMENTS).forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('hud-edit-target', 'hud-edit-dragging');
      el.removeEventListener('pointerdown', onPointerDown);
    });

    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup',   onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);

    _drag = null;

    if (typeof window._onHudEditClose === 'function') window._onHudEditClose();
  }

  function onPointerDown(e) {
    if (!_active) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget;
    const id = el.id;
    const off = HUDLayout.get(id);
    _drag = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      baseX: off.x,
      baseY: off.y,
    };
    el.classList.add('hud-edit-dragging');
    el.setPointerCapture && el.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!_drag) return;
    e.preventDefault();
    const dx = e.clientX - _drag.startX;
    const dy = e.clientY - _drag.startY;
    HUDLayout.set(_drag.id, _drag.baseX + dx, _drag.baseY + dy);
  }

  function onPointerUp() {
    if (!_drag) return;
    const el = document.getElementById(_drag.id);
    if (el) el.classList.remove('hud-edit-dragging');
    _drag = null;
  }

  return { open, close, isActive };
})();

window.HUDLayoutEditor = HUDLayoutEditor;
