// ===== INVENTORY.JS =====
// Stash (คลัง) = ของที่ซื้อมา (ขวา)
// Backpack (กระเป๋า) = นำเข้าเกม (ซ้าย)
//
// คลิก Stash card          → ใส่ items grid qty 1
// ลาก Stash → equip slot   → equip
// ลาก Stash → items grid   → popup qty (supply) | qty1 (weapon/armor)
// ลาก BP item → stash panel → ย้ายกลับคลังทั้งหมด ทันที
// คลิก BP item              → ย้ายกลับคลังทั้งหมด

const Inventory = (() => {
  let uid = null;
  let _justDragged = false;
  let currentCat = 'all';
  let _selectedItemId = null;

  const CAT_MAP = {
    all:    { label: '📋', name: 'ทั้งหมด', key: null      },
    gun:    { label: '🔫', name: 'ปืน',     key: 'weapon'  },
    body:   { label: '👕', name: 'ตัว',     key: 'armor'   },
    head:   { label: '⛑️', name: 'หัว',     key: 'helmet'  },
    supply: { label: '🧪', name: 'ซัพพลาย', key: 'supply'  },
  };

  // ── shop data (อ่านจาก Stash module) ────────────────────
  function allOwnedItems() {
    const result = [];
    if (typeof Stash === 'undefined' || typeof SHOP_ITEMS === 'undefined') return result;
    for (const cat of Object.keys(SHOP_ITEMS)) {
      for (const item of SHOP_ITEMS[cat]) {
        const q = Stash.getQty(item.id);
        if (q > 0) result.push({ ...item, cat, totalQty: q });
      }
    }
    return result;
  }

  function toast(msg, type = '') {
    if (typeof window.showToast === 'function') window.showToast(msg, type);
  }

  // ── switch category ──────────────────────────────────────
  function switchCat(catId) {
    currentCat = catId;
    document.querySelectorAll('.inv-cat-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cat === catId);
    });
    renderStash();
  }

  // ── render item detail panel ──────────────────────────────
  function renderDetail(itemId) {
    const el = document.getElementById('inv-item-detail');
    if (!el) return;

    if (!itemId) {
      _selectedItemId = null;
      el.innerHTML = `
        <div class="inv-detail-empty">
          <div class="inv-detail-empty-icon">🔍</div>
          <div class="inv-detail-empty-text">คลิกไอเทม<br>เพื่อดูรายละเอียด</div>
        </div>`;
      return;
    }

    const def = Backpack.findDef(itemId);
    if (!def) return;
    _selectedItemId = itemId;

    const available = (typeof Stash !== 'undefined') ? Stash.getQty(itemId) : 0;
    const inBP = Backpack.countInBP(itemId);

    // ── stat bar helper (เหมือน character.js) ────────────────
    function itemStatBar(label, val, max, color, valLabel) {
      const pct = Math.min(100, Math.max(0, Math.round((val / max) * 100)));
      return `
        <div class="item-stat-row">
          <span class="item-stat-label">${label}</span>
          <div class="item-stat-track">
            <div class="item-stat-fill" style="width:${pct}%;background:${color}"></div>
          </div>
          <span class="item-stat-val">${valLabel !== undefined ? valLabel : val}</span>
        </div>`;
    }

    // สร้าง stat bars ตามประเภทไอเทม
    const statBars = [];
    if (def.weaponId && typeof WEAPON_CONFIG !== 'undefined' && WEAPON_CONFIG[def.weaponId]) {
      const wc = WEAPON_CONFIG[def.weaponId];

      // ดาเมจ — หลอด 0-300 (300+ = เต็มหลอด)
      statBars.push(itemStatBar('ดาเมจ', wc.damage, 300, '#ef5350'));

      // กระสุน — หลอด 0-100 (ยิ่งเยอะยิ่งเต็ม)
      statBars.push(itemStatBar('กระสุน', wc.maxAmmo, 100, '#42a5f5'));

      // อัตราลั่น — หลอด 0-1500 (fireRate ยิ่งน้อย = บาร์ยิ่งยาว, แสดงค่า fireRate จริง)
      const ratePct = Math.round((1 - wc.fireRate / 1500) * 100);
      statBars.push(itemStatBar('อัตราลั่น', ratePct, 100, '#ffa726', wc.fireRate));

      // รีโหลด — หลอด 1000-5000 (reloadTime ยิ่งน้อย = บาร์ยิ่งยาว, แสดงเป็นวินาที เช่น 1.0, 4.5)
      const reloadMin = 1000, reloadMax = 5000;
      const reloadPct = Math.round((1 - (wc.reloadTime - reloadMin) / (reloadMax - reloadMin)) * 100);
      statBars.push(itemStatBar('รีโหลด', reloadPct, 100, '#66bb6a', (wc.reloadTime / 1000).toFixed(1)));
    }
    if (!def.weaponId) {
      if (def.damage) statBars.push(itemStatBar('ดาเมจ',   def.damage, 120, '#ef5350'));
      if (def.ammo)   statBars.push(itemStatBar('กระสุน',  def.ammo,   30,  '#42a5f5'));
      // armor: อ่านจาก ARMOR_CONFIG ถ้ามี armorId, ไม่งั้นใช้ def.armor
      const armorVal = def.armorId && typeof ARMOR_CONFIG !== 'undefined' && ARMOR_CONFIG[def.armorId]
        ? ARMOR_CONFIG[def.armorId].armorPct
        : def.armor;
      if (armorVal) statBars.push(itemStatBar('ARMOR', armorVal, 100, '#42a5f5'));
      if (def.hp)     statBars.push(itemStatBar('HP',    def.hp,     200, '#66bb6a'));
      if (def.speed)  statBars.push(itemStatBar('SPEED', def.speed,  10,  '#66bb6a'));
      if (def.regen)  statBars.push(itemStatBar('REGEN', def.regen,  10,  '#66bb6a'));
      if (def.heal)   statBars.push(itemStatBar('HEAL',  def.heal,   100, '#66bb6a'));
      if (def.qty)    statBars.push(itemStatBar('QTY',   def.qty,    20,  '#ffa726'));
    }

    const iconHtml = (def.icon && def.icon.includes('<img'))
      ? `<div class="inv-detail-icon">${def.icon}</div>`
      : `<div class="inv-detail-icon" style="font-size:42px">${def.icon || '📦'}</div>`;
    const statsHtml = statBars.length > 0
      ? `<div class="inv-detail-divider"></div>
         <div class="item-stats-wrap" style="width:100%;padding:0 2px;">
           ${statBars.join('')}
         </div>`
      : '';

    const inBPHtml = inBP > 0
      ? `<div class="inv-detail-stat-row" style="margin-top:4px">
           <span class="inv-detail-stat-key">IN BAG</span>
           <span class="inv-detail-stat-val green">${inBP}</span>
         </div>`
      : '';

    el.innerHTML = `
      ${iconHtml}
      <div class="inv-detail-name">${def.name}</div>
      ${statsHtml}
      <div class="inv-detail-divider"></div>
      <div class="inv-detail-qty-row">
        <span class="inv-detail-qty-label">ในคลัง</span>
        <span class="inv-detail-qty-num">${available}</span>
      </div>
      ${inBPHtml}
      <button class="inv-detail-add-btn" id="inv-detail-add-btn"
              ${available <= 0 ? 'disabled' : ''}>
        ➕ ใส่กระเป๋า
      </button>`;

    const addBtn = document.getElementById('inv-detail-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        clickStashAdd(itemId);
      });
    }
  }

  // ── คลิกปุ่มใส่กระเป๋า (จาก detail panel) ──────────────
  function clickStashAdd(itemId) {
    const def = Backpack.findDef(itemId);
    if (!def) return;
    if (typeof Stash === 'undefined' || Stash.getQty(itemId) <= 0) {
      toast('ของในคลังหมดแล้ว', 'error'); return;
    }
    const res = Backpack.addItemFromStash(itemId, 1);
    if      (res === 'added')    { render(); renderDetail(itemId); }
    else if (res === 'full')     { toast(`กระเป๋าเต็มแล้ว! (${Backpack.ITEMS_MAX} ช่อง)`, 'error'); }
    else if (res === 'no_stock') { toast('ของในคลังหมดแล้ว', 'error'); }
  }

  // ── คลิก stash card (select + add) ──────────────────────
  function clickStash(itemId) {
    if (_justDragged) return;

    // toggle selection
    const wasSelected = _selectedItemId === itemId;

    // update visual selection
    document.querySelectorAll('.inv-stash-card').forEach(c => c.classList.remove('selected'));
    if (!wasSelected) {
      const card = document.querySelector(`.inv-stash-card[data-item-id="${itemId}"]`);
      if (card) card.classList.add('selected');
      renderDetail(itemId);
    } else {
      renderDetail(null);
    }
  }

  // ── render stash ─────────────────────────────────────────
  function renderStash() {
    const el = document.getElementById('inv-stash-grid');
    if (!el) return;

    // category tabs
    const catBar = document.getElementById('inv-cat-bar');
    if (catBar) {
      catBar.innerHTML = Object.entries(CAT_MAP).map(([id, cfg]) => `
        <button class="inv-cat-btn ${id === currentCat ? 'active' : ''}"
                data-cat="${id}"
                onclick="Inventory.switchCat('${id}')">
          <span class="inv-cat-icon">${cfg.label}</span>
          <span class="inv-cat-name">${cfg.name}</span>
        </button>`).join('');
    }

    const allItems = allOwnedItems();
    // แสดงเฉพาะ item ที่มีในคลัง (qty > 0, Stash เป็น source of truth)
    const owned = currentCat === 'all' ? allItems
      : allItems.filter(i => i.cat === (CAT_MAP[currentCat]?.key ?? ''));

    if (owned.length === 0) {
      el.innerHTML = `
        <div class="inv-stash-empty">
          <div class="inv-stash-empty-icon">📦</div>
          <div>ยังไม่มีไอเทมในหมวดนี้</div>
          ${currentCat === 'all' ? '<span>ไปซื้อที่ SHOP ก่อน</span>' : ''}
        </div>`;
      return;
    }

    el.innerHTML = owned.map(item => {
      const available = (typeof Stash !== 'undefined') ? Stash.getQty(item.id) : 0;
      const hint = Backpack.getEquipSlot(item)
        ? 'คลิก=ใส่กระเป๋า | ลาก=Equip'
        : 'คลิก=ใส่กระเป๋า | ลาก=ระบุจำนวน';
      return `
        <div class="inv-stash-card"
             draggable="true"
             data-item-id="${item.id}"
             onclick="Inventory.clickStash('${item.id}')"
             title="${item.name} — ${hint}">
          <div class="inv-stash-icon">${item.icon}</div>
          <span class="inv-stash-qty">${available}</span>
        </div>`;
    }).join('');

    // bind drag stash → BP
    el.querySelectorAll('.inv-stash-card[draggable="true"]').forEach(card => {
      card.addEventListener('dragstart', e => {
        Backpack.startStashDrag(card.dataset.itemId);
        e.dataTransfer.effectAllowed = 'move';
        _justDragged = false;
        card.classList.add('dragging');
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        Backpack.clearDrag();
        _justDragged = true;
        setTimeout(() => { _justDragged = false; }, 100);
      });
    });

    // drop zone: BP item → stash panel
    _bindStashDropZone(el);
  }

  // ── bind stash panel เป็น drop target รับ BP items และ equip ───────
  function _bindStashDropZone(el) {
    el.addEventListener('dragover', e => {
      const src = Backpack.getDragSource();
      if (src === 'bp' || src === 'equip') {
        e.preventDefault();
        el.classList.add('stash-drop-active');
      }
    });
    el.addEventListener('dragleave', e => {
      if (!el.contains(e.relatedTarget)) el.classList.remove('stash-drop-active');
    });
    el.addEventListener('drop', e => {
      el.classList.remove('stash-drop-active');
      const src = Backpack.getDragSource();
      if (src === 'bp') {
        e.preventDefault();
        const idx = Backpack.getDragBPIdx();
        Backpack.dropBPItemOnStash(idx);
        Backpack.clearDrag();
      } else if (src === 'equip') {
        e.preventDefault();
        Backpack.dropEquipOnStash();
        Backpack.clearDrag();
      }
    });
  }

  // ── render ───────────────────────────────────────────────
  function render() {
    Backpack.render();
    renderStash();
    // refresh detail if item still selected
    if (_selectedItemId) renderDetail(_selectedItemId);
  }

  // ── init ─────────────────────────────────────────────────
  function init(userId) {
    uid = userId;
    Backpack.init(userId);
    _selectedItemId = null;
  }

  return { init, render, renderStash, clickStash, switchCat, renderDetail };
})();

window.Inventory = Inventory;
