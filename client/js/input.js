// ===== INPUT =====
// รองรับ PC (WASD + Mouse) และมือถือ (Move Joystick + Look Joystick)
// ใช้ KeyBinds สำหรับ sprint (ปุ่มที่ตั้งค่าได้)

const Input = (() => {
  // --- Keyboard ---
  const keys = {};
  window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
  window.addEventListener('keyup',   e => keys[e.key.toLowerCase()] = false);

  // --- Mouse aim ---
  let mouseX = 0, mouseY = 0;
  window.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });

  // --- Move Joystick (ซ้ายล่าง) ---
  const joy = { active: false, startX: 0, startY: 0, dx: 0, dy: 0, id: null };

  const joyZone = document.getElementById('joystick-zone');
  const joyBase = document.getElementById('joystick-base');
  const joyKnob = document.getElementById('joystick-knob');
  const DEAD = 10, MAX = 50;

  function joyStart(x, y, id) {
    joy.active = true;
    joy.startX = x; joy.startY = y;
    joy.dx = 0; joy.dy = 0;
    joy.id = id;
    joyBase.style.left = (x - 30) + 'px';
    joyBase.style.top  = (y - 30) + 'px';
    joyBase.style.opacity = '1';
  }

  function joyMove(x, y) {
    if (!joy.active) return;
    let dx = x - joy.startX;
    let dy = y - joy.startY;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > MAX) { dx = dx / d * MAX; dy = dy / d * MAX; }
    joy.dx = Math.abs(dx) > DEAD ? dx / MAX : 0;
    joy.dy = Math.abs(dy) > DEAD ? dy / MAX : 0;
    joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  function joyEnd() {
    joy.active = false; joy.dx = 0; joy.dy = 0; joy.id = null;
    joyKnob.style.transform = 'translate(0,0)';
    joyBase.style.opacity = '0';
  }

  joyZone.addEventListener('touchstart', e => {
    e.preventDefault();
    const t = e.changedTouches[0];
    joyStart(t.clientX, t.clientY, t.identifier);
  }, { passive: false });

  joyZone.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches)
      if (t.identifier === joy.id) joyMove(t.clientX, t.clientY);
  }, { passive: false });

  joyZone.addEventListener('touchend',    e => { e.preventDefault(); joyEnd(); }, { passive: false });
  joyZone.addEventListener('touchcancel', e => { e.preventDefault(); joyEnd(); }, { passive: false });

  // --- Look Joystick (ขวาล่าง ล็อคตำแหน่ง) ---
  const look = { active: false, dx: 0, dy: 0, id: null, angle: 0 };

  const lookBase = document.getElementById('attack-base');
  const lookKnob = document.getElementById('attack-knob');
  const LOOK_MAX = 44;

  function getLookCenter() {
    const rect = lookBase.getBoundingClientRect();
    return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
  }

  lookBase.addEventListener('touchstart', e => {
    e.preventDefault();
    if (look.id !== null) return;
    const t = e.changedTouches[0];
    look.id = t.identifier;
    look.active = true;
    moveLookKnob(t.clientX, t.clientY);
  }, { passive: false });

  window.addEventListener('touchmove', e => {
    for (const t of e.changedTouches) {
      if (t.identifier === look.id) {
        e.preventDefault();
        moveLookKnob(t.clientX, t.clientY);
      }
    }
  }, { passive: false });

  window.addEventListener('touchend', e => {
    for (const t of e.changedTouches) {
      if (t.identifier === look.id) {
        look.id = null; look.active = false;
        look.dx = 0; look.dy = 0;
        lookKnob.style.transform = 'translate(0,0)';
      }
    }
  });

  window.addEventListener('touchcancel', e => {
    for (const t of e.changedTouches) {
      if (t.identifier === look.id) {
        look.id = null; look.active = false;
        look.dx = 0; look.dy = 0;
        lookKnob.style.transform = 'translate(0,0)';
      }
    }
  });

  function moveLookKnob(x, y) {
    const { cx, cy } = getLookCenter();
    let dx = x - cx;
    let dy = y - cy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > LOOK_MAX) { dx = dx / d * LOOK_MAX; dy = dy / d * LOOK_MAX; }
    look.dx = dx / LOOK_MAX;
    look.dy = dy / LOOK_MAX;
    look.angle = Math.atan2(dy, dx);
    lookKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  // --- Sprint Toggle (รองรับ KeyBinds) ---
  let sprinting = false;
  const sprintBtn = document.getElementById('sprint-btn');
  sprintBtn.addEventListener('click', () => {
    sprinting = !sprinting;
    sprintBtn.classList.toggle('on', sprinting);
  });

  // Sprint key — อ่านจาก KeyBinds (ถ้าโหลดแล้ว) ไม่งั้น fallback Shift
  function getSprintKey() {
    return (typeof KeyBinds !== 'undefined') ? KeyBinds.get('sprint').toLowerCase() : 'shift';
  }

  window.addEventListener('keydown', e => {
    if (e.key.toLowerCase() === getSprintKey()) { sprinting = true; sprintBtn.classList.add('on'); }
  });
  window.addEventListener('keyup', e => {
    if (e.key.toLowerCase() === getSprintKey()) { sprinting = false; sprintBtn.classList.remove('on'); }
  });

  // --- Public API ---
  return {
    getMove() {
      let dx = 0, dy = 0;
      if (keys['a'] || keys['arrowleft'])  dx -= 1;
      if (keys['d'] || keys['arrowright']) dx += 1;
      if (keys['w'] || keys['arrowup'])    dy -= 1;
      if (keys['s'] || keys['arrowdown'])  dy += 1;
      if (joy.active) { dx = joy.dx; dy = joy.dy; }
      return { dx, dy };
    },

    isSprinting() { return sprinting; },

    isAiming() { return look.active; },

    getAimAngle(player, camera) {
      if (look.active) return look.angle;
      const wx = mouseX + camera.x;
      const wy = mouseY + camera.y;
      return Math.atan2(wy - player.y, wx - player.x);
    },

    // ตรวจ key จาก KeyBinds (ใช้ใน game.js)
    isKeyBindPressed(action) {
      if (typeof KeyBinds === 'undefined') return false;
      const k = KeyBinds.get(action).toLowerCase();
      return !!keys[k];
    },
  };
})();
