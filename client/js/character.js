// ===== CHARACTER.JS =====
// ระบบเลือกตัวละคร + ซื้อ + บันทึก
// depends on: config_character.js, money.js

const Character = (() => {
  let uid        = null;
  let _fb        = null;   // { ref, get, set, db } จาก Firebase
  let selectedId = 'default';
  let ownedChars = new Set(['default']);

  const DB_KEY  = () => `theplayz_char_${uid}`;
  const charRef = () => _fb ? _fb.ref(_fb.db, `users/${uid}/character`) : null;

  // ── persistence ──────────────────────────────────────────

  async function load() {
    if (_fb) {
      try {
        const snap = await _fb.get(charRef());
        if (snap.exists()) {
          const d  = snap.val();
          selectedId = d.selected   ?? 'default';
          ownedChars = new Set(d.ownedChars ?? ['default']);
        }
      } catch (e) {
        console.warn('[Character] Firebase load failed, fallback localStorage:', e);
        _loadLocal();
      }
    } else {
      _loadLocal();
    }
    ownedChars.add('default');
    render();
  }

  function _loadLocal() {
    try {
      const raw = localStorage.getItem(DB_KEY());
      if (raw) {
        const d  = JSON.parse(raw);
        selectedId = d.selected   ?? 'default';
        ownedChars = new Set(d.ownedChars ?? ['default']);
      }
    } catch { /* use defaults */ }
  }

  async function save() {
    const data = {
      selected:   selectedId,
      ownedChars: [...ownedChars],
    };
    if (_fb) {
      try {
        await _fb.set(charRef(), data);
      } catch (e) {
        console.warn('[Character] Firebase save failed, fallback localStorage:', e);
        localStorage.setItem(DB_KEY(), JSON.stringify(data));
      }
    } else {
      localStorage.setItem(DB_KEY(), JSON.stringify(data));
    }
  }

  // ── getters ───────────────────────────────────────────────

  function getSelected() {
    return CHARACTERS.find(c => c.id === selectedId) ?? CHARACTERS[0];
  }

  function getActiveColor() {
    return getSelected().color;
  }

  // stats bonus ของตัวละครที่เลือก (export ไปให้ game.js)
  // ค่า base (HP, SPEED) อยู่ใน CONFIG — ที่นี่คืนแค่ % bonus
  function getActivePassive() {
    const s = getSelected().stats;
    return {
      speedPct:  s.speedPct  ?? 0,
      reducePct: s.reducePct ?? 0,
      regenPct:  s.regenPct  ?? 0,
    };
  }

  // ── buy / select ──────────────────────────────────────────

  function buyChar(id) {
    const char = CHARACTERS.find(c => c.id === id);
    if (!char || char.free || ownedChars.has(id)) return;

    const ok = Money.spend(char.currency, char.price);
    if (!ok) return window.showToast(
      char.currency === 'money' ? 'เงินไม่พอ!' : 'Point ไม่พอ!', 'error'
    );

    ownedChars.add(id);
    save();
    window.showToast(`ปลดล็อก ${char.name} สำเร็จ! ✓`, 'success');
    render();
  }

  function selectChar(id) {
    if (!ownedChars.has(id)) return window.showToast('ยังไม่ได้ปลดล็อก!', 'error');
    selectedId = id;
    save();
    render();
    window.showToast(`เลือก ${CHARACTERS.find(c=>c.id===id)?.name} แล้ว`, 'success');
  }

  // ── render helpers ────────────────────────────────────────

  function abilityBar(icon, label, pct, valLabel, color) {
    return `
      <div class="char-abil-row">
        <div class="char-abil-header">
          <span class="char-abil-icon">${icon}</span>
          <span class="char-abil-label">${label}</span>
          <span class="char-abil-val">${valLabel}</span>
        </div>
        <div class="char-abil-track">
          <div class="char-abil-fill" style="width:${Math.min(100,pct)}%;background:${color}">
            <div class="char-abil-shine"></div>
          </div>
        </div>
      </div>`;
  }

  function getAbilityBars(char) {
    const s = char.stats || {};
    return [
      {
        icon:     '⚡',
        label:    'วิ่งเร็ว',
        pct:      s.speedPct  ? Math.min(100, s.speedPct)  : 0,
        valLabel: s.speedPct  ? `+${s.speedPct}%`  : '—',
        color:    '#F59E0B',
      },
      {
        icon:     '🛡️',
        label:    'ถึกขึ้น',
        pct:      s.reducePct ? Math.min(100, (s.reducePct / 75) * 100) : 0,
        valLabel: s.reducePct ? `+${s.reducePct}%` : '—',
        color:    '#60A5FA',
      },
      {
        icon:     '💊',
        label:    'รีเลือด',
        pct:      s.regenPct  ? Math.min(100, (s.regenPct / 200) * 100) : 0,
        valLabel: s.regenPct  ? `+${s.regenPct}%`  : '—',
        color:    '#34D399',
      },
    ];
  }

  // ── render main ───────────────────────────────────────────

  function render() {
    const panel = document.getElementById('panel-character');
    if (!panel) return;

    const sel        = getSelected();
    const activeColor = getActiveColor();

    // ─ selected preview ─
    const preview = document.getElementById('char-preview');
    if (preview) {
      preview.innerHTML = `
        <canvas id="char-canvas" width="80" height="100"></canvas>
        <div class="char-preview-name">${sel.name}</div>
      `;
      drawCharPreview(activeColor, sel);
    }

    // ─ ability bars ─
    const statsEl = document.getElementById('char-stats');
    if (statsEl) {
      const bars = getAbilityBars(sel);
      statsEl.innerHTML = bars.map(b =>
        abilityBar(b.icon, b.label, b.pct, b.valLabel, b.color)
      ).join('');
    }

    // ─ character grid ─
    const charGrid = document.getElementById('char-grid');
    if (charGrid) {
      charGrid.innerHTML = CHARACTERS.map(char => {
        const isOwned    = ownedChars.has(char.id);
        const isSelected = char.id === selectedId;
        const { money, point } = Money.get();
        const canAfford  = char.currency === 'money' ? money >= char.price : point >= char.price;
        const priceIcon  = char.currency === 'money' ? '💵' : '💎';

        return `
          <div class="char-card ${isSelected ? 'selected' : ''}"
               onclick="Character.showDetail('${char.id}')">
            ${isSelected ? '<div class="char-card-badge">✓ ACTIVE</div>' : ''}
            <div class="char-card-main">
              <div class="char-card-icon">${char.iconType === 'image' ? `<img src="${char.icon}" alt="${char.name}">` : char.icon}</div>
              <div class="char-card-name">${char.name}</div>
            </div>
            <div class="char-card-footer">
              ${isOwned
                ? (isSelected
                    ? `<span class="badge-owned">EQUIPPED</span>`
                    : `<button class="btn-char-select" onclick="event.stopPropagation();Character.selectChar('${char.id}')">SELECT</button>`)
                : `<button class="btn-char-buy ${char.currency} ${canAfford?'':'disabled-look'}"
                     onclick="event.stopPropagation();Character.buyChar('${char.id}')">
                     ${priceIcon} ${char.price.toLocaleString()}
                   </button>`
              }
            </div>
          </div>`;
      }).join('');
    }
  }

  // ── mini canvas preview ───────────────────────────────────

  function drawCharPreview(color, char) {
    const canvas = document.getElementById('char-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cx = 40, cy = 54, r = 22;

    ctx.clearRect(0, 0, 80, 110);

    const grd = ctx.createRadialGradient(cx, cy, 4, cx, cy, 38);
    grd.addColorStop(0, color + '55');
    grd.addColorStop(1, 'transparent');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 80, 110);

    if (typeof _charDrawers !== 'undefined' && _charDrawers[char.id]) {
      _charDrawers[char.id](ctx, { x: cx, y: cy, r, color, charId: char.id, walkTimer: 0, trail: [] });
    } else if (typeof _drawBodyDefault !== 'undefined') {
      _drawBodyDefault(ctx, { x: cx, y: cy, r, color, charId: 'default', walkTimer: 0, trail: [] });
    }
  }

  // ── show character detail (modal) ────────────────────────

  function showDetail(id) {
    const char = CHARACTERS.find(c => c.id === id);
    if (!char) return;

    // ลบ modal เก่าถ้ามี
    const old = document.getElementById('char-detail-modal');
    if (old) old.remove();

    const isOwned    = ownedChars.has(char.id);
    const isSelected = char.id === selectedId;
    const bars       = getAbilityBars(char);
    const { money, point } = Money.get();
    const canAfford  = char.currency === 'money' ? money >= char.price : point >= char.price;
    const priceIcon  = char.currency === 'money' ? '💵' : '💎';

    const barsHtml = bars.map(b => abilityBar(b.icon, b.label, b.pct, b.valLabel, b.color)).join('');

    let actionBtn = '';
    if (isOwned) {
      if (isSelected) {
        actionBtn = `<button class="btn-char-action equipped" disabled>✓ EQUIPPED</button>`;
      } else {
        actionBtn = `<button class="btn-char-action select" onclick="Character.selectChar('${char.id}');document.getElementById('char-detail-modal').remove()">SELECT</button>`;
      }
    } else {
      actionBtn = `<button class="btn-char-buy ${char.currency} ${canAfford?'':'disabled-look'}"
        onclick="Character.buyChar('${char.id}');document.getElementById('char-detail-modal').remove()">
        ${priceIcon} ${char.price.toLocaleString()}
      </button>`;
    }

    const iconHtml = char.iconType === 'image'
      ? `<img src="${char.icon}" alt="${char.name}" style="width:64px;height:64px;object-fit:contain;">`
      : `<span style="font-size:48px;">${char.icon}</span>`;

    const modal = document.createElement('div');
    modal.id = 'char-detail-modal';
    modal.innerHTML = `
      <div class="char-detail-backdrop" onclick="document.getElementById('char-detail-modal').remove()"></div>
      <div class="char-detail-panel">
        <button class="char-detail-close" onclick="document.getElementById('char-detail-modal').remove()">✕</button>
        <div class="char-detail-icon">${iconHtml}</div>
        <div class="char-detail-name">${char.name}</div>
        <div class="char-detail-stats">${barsHtml}</div>
        <div class="char-detail-action">${actionBtn}</div>
      </div>`;
    document.body.appendChild(modal);
  }

  // ── init ──────────────────────────────────────────────────

  function init(userId, fb) {
    uid = userId;
    _fb = fb ?? null;
    load();

    document.querySelectorAll('.char-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.char-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.char-section').forEach(s => s.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.ctab === 'chars' ? 'char-section-chars' : 'char-section-skills';
        document.getElementById(target).classList.add('active');
      });
    });
  }

  // ── public API ────────────────────────────────────────────
  return {
    init,
    render,
    buyChar,
    selectChar,
    showDetail,
    getSelected,
    getActiveColor,
    getActivePassive,
  };
})();

window.Character = Character;
