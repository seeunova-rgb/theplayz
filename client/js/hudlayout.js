// ===== HUDLAYOUT.JS =====
// ระบบตั้งค่าตำแหน่งปุ่ม HUD บนมือถือ — ลากปุ่มเพื่อย้ายตำแหน่ง, save/load จาก localStorage
// ใช้ CSS variable (--hud-x, --hud-y) บวกเข้ากับตำแหน่ง default ของแต่ละปุ่มผ่าน transform

const HUDLayout = (() => {

  const STORAGE_KEY = 'theplayz_hudlayout';

  // ปุ่ม/องค์ประกอบที่ปรับตำแหน่งได้ พร้อมชื่อแสดงผล
  const ELEMENTS = {
    'joystick-zone': { label: '🕹️ Joystick เดิน',  group: 'left'  },
    'sprint-btn':    { label: '🏃 วิ่ง',            group: 'left'  },
    'pickup-btn':    { label: '📦 เก็บไอเทม',       group: 'mid'   },
    'attack-base':   { label: '🎯 Joystick เล็ง/ยิง', group: 'right' },
    'reload-btn':    { label: '🔄 รีโหลด',          group: 'right' },
    'bandage-btn':   { label: '💊 ใช้ยา',           group: 'right' },
    'btn-ingame-bp':   { label: '🎒 กระเป๋า',        group: 'top'   },
    'btn-ingame-shop': { label: '🛒 ร้านค้า',        group: 'top'   },
    'safe-vault-btn':  { label: '🔒 ตู้เซฟ',          group: 'mid'   },
  };

  let _offsets = {};

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      _offsets = raw ? JSON.parse(raw) : {};
    } catch {
      _offsets = {};
    }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_offsets)); } catch {}
  }

  function get(id) {
    return _offsets[id] || { x: 0, y: 0 };
  }

  function set(id, x, y) {
    _offsets[id] = { x: Math.round(x), y: Math.round(y) };
    save();
    applyOne(id);
  }

  function reset(id) {
    delete _offsets[id];
    save();
    applyOne(id);
  }

  function resetAll() {
    _offsets = {};
    save();
    applyAll();
  }

  function applyOne(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const o = get(id);
    const base = (id === 'pickup-btn') ? 'translateX(-50%) ' : '';
    if (o.x === 0 && o.y === 0) {
      el.style.transform = base ? 'translateX(-50%)' : '';
    } else {
      el.style.setProperty('--hud-x', o.x + 'px');
      el.style.setProperty('--hud-y', o.y + 'px');
      el.style.transform = `${base}translate(var(--hud-x), var(--hud-y))`;
    }
  }

  function applyAll() {
    Object.keys(ELEMENTS).forEach(applyOne);
  }

  load();

  // apply ทันทีตอนโหลด (ถ้า element มีอยู่แล้ว) และตอน DOM โหลดเสร็จ
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyAll);
  } else {
    applyAll();
  }

  return { get, set, reset, resetAll, applyAll, applyOne, ELEMENTS, load };
})();

window.HUDLayout = HUDLayout;
