// ===== KEYBINDS.JS =====
// ระบบตั้งค่าปุ่มคีย์บอร์ด — save/load จาก localStorage
// Actions: sprint, heal, pickup, reload, shoot

const KeyBinds = (() => {

  const STORAGE_KEY = 'theplayz_keybinds';

  // ค่า default
  const DEFAULTS = {
    sprint: 'Shift',
    heal:   'f',
    pickup: 'e',
    reload: 'r',
    shoot:  'mouse0', // mouse0 = คลิกซ้าย (ใช้ใน label เท่านั้น บน PC)
  };

  // ชื่อที่แสดงในหน้า Settings
  const LABELS = {
    sprint: '🏃 วิ่ง (Sprint)',
    heal:   '💊 ใช้ยา',
    pickup: '📦 เก็บไอเทม',
    reload: '🔄 รีโหลด',
    shoot:  '🔫 ยิง',
  };

  // actions ที่ไม่สามารถ remap ได้ (mouse-based บน PC, จอยบนมือถือ)
  const FIXED = new Set(['shoot']);

  let _binds = {};

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      _binds = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
    } catch {
      _binds = { ...DEFAULTS };
    }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_binds)); } catch {}
  }

  function get(action) {
    return (_binds[action] || DEFAULTS[action]);
  }

  // ตรวจว่า key ที่กดตรงกับ action ไหม
  function matches(action, keyOrCode) {
    const bound = get(action).toLowerCase();
    return keyOrCode.toLowerCase() === bound;
  }

  function set(action, keyStr) {
    if (FIXED.has(action)) return false;
    // ป้องกัน conflict (key เดียวกันกับ action อื่น)
    for (const [act, k] of Object.entries(_binds)) {
      if (act !== action && !FIXED.has(act) && k.toLowerCase() === keyStr.toLowerCase()) {
        return false; // conflict
      }
    }
    _binds[action] = keyStr;
    save();
    return true;
  }

  function resetAll() {
    _binds = { ...DEFAULTS };
    save();
  }

  // format key ให้อ่านง่าย
  function formatKey(keyStr) {
    const map = {
      'shift': 'SHIFT', 'control': 'CTRL', 'alt': 'ALT',
      'escape': 'ESC', ' ': 'SPACE', 'arrowup': '↑',
      'arrowdown': '↓', 'arrowleft': '←', 'arrowright': '→',
      'mouse0': 'คลิกซ้าย',
    };
    return map[keyStr.toLowerCase()] || keyStr.toUpperCase();
  }

  load();

  return { get, set, matches, resetAll, load, formatKey, LABELS, DEFAULTS, FIXED };
})();

window.KeyBinds = KeyBinds;
