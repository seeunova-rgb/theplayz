// ===== BACKPACK.JS =====
// กระเป๋าผู้เล่น — ใช้ร่วมกันทั้ง Lobby และ In-Game
// บันทึกลง localStorage ทันทีที่เปลี่ยนแปลง
//
// Stash (คลัง) แยกกันสมบูรณ์ ไม่เชื่อมกันเลย
// ซื้อของ → เข้า Stash  |  ใส่กระเป๋า → เพิ่มใน Backpack
// ตายในเกม → Backpack ล้างทันที, Stash ไม่ยุ่ง

const Backpack = (() => {

  const EQUIP_SLOTS = ['gun', 'body', 'head', 'med'];
  const EQUIP_META  = {
    gun:   { label: '🔫', name: 'ปืน'   },
    body:  { label: '👕', name: 'เกราะ' },
    head:  { label: '⛑️', name: 'หมวก'  },
    med:   { label: '🩹', name: 'ยา'    },
  };
  const ITEMS_MAX = 20;

  let uid      = null;
  let equip    = {};
  let equipQty = {};   // qty สำหรับ slot ที่ stack ได้ (med)
  let items    = [];   // [{ id, qty }]

  // in-game panel state
  let _panelOpen = false;
  let _infoItemId = null;     // currently selected item for info column

  // drag state
  let dragSource    = null;  // 'stash' | 'bp' | 'equip'
  let dragItemId    = null;
  let dragBPSlotIdx = -1;
  let _dragEquipSlot = null;

  const DB_KEY = () => `theplayz_bp2_${uid}`;

  // ── persistence ──────────────────────────────────────────
  function load() {
    equip    = Object.fromEntries(EQUIP_SLOTS.map(s => [s, null]));
    equipQty = Object.fromEntries(EQUIP_SLOTS.map(s => [s, 1]));
    items    = [];
    try {
      const raw = localStorage.getItem(DB_KEY());
      if (raw) {
        const d = JSON.parse(raw);
        for (const s of EQUIP_SLOTS) equip[s] = d.equip?.[s] ?? null;
        for (const s of EQUIP_SLOTS) equipQty[s] = d.equipQty?.[s] ?? 1;
        items = Array.isArray(d.items) ? d.items : [];
      }
    } catch {}
  }
  function save() {
    if (!uid) return;
    localStorage.setItem(DB_KEY(), JSON.stringify({ equip, equipQty, items }));
  }

  // ── item helpers ─────────────────────────────────────────
  function findDef(id) {
    for (const cat of Object.keys(SHOP_ITEMS)) {
      const found = SHOP_ITEMS[cat].find(i => i.id === id);
      if (found) return { ...found, cat };
    }
    return null;
  }
  function isWeapon(def) { return def?.cat === 'weapon'; }
  function canStack(def) {
    if (!def) return true;
    return !['weapon','armor','helmet'].includes(def.cat);
  }
  function _equipCanStack(slotId) { return slotId === 'med'; }

  function getEquipSlot(def) {
    if (!def) return null;
    return { weapon:'gun', armor:'body', helmet:'head', med:'med', supply:null }[def.cat] ?? null;
  }

  // ── counts ───────────────────────────────────────────────
  function countInBP(itemId) {
    let n = 0;
    for (const s of EQUIP_SLOTS) if (equip[s] === itemId) n++;
    for (const sl of items) if (sl.id === itemId) n += sl.qty;
    return n;
  }

  // ── addItem (เพิ่มเข้า items grid โดยตรง ไม่เช็ค Stash) ──
  // ใช้สำหรับ: lobby drag จาก stash, pickup กลางแผนที่
  // returns: 'added' | 'full'
  function addItem(itemId, qty = 1) {
    const def = findDef(itemId);

    if (!canStack(def)) {
      if (items.length >= ITEMS_MAX) return 'full';
      items.push({ id: itemId, qty: 1 });
    } else {
      const existIdx = items.findIndex(s => s.id === itemId);
      if (existIdx !== -1) {
        items[existIdx].qty += qty;
      } else {
        if (items.length >= ITEMS_MAX) return 'full';
        items.push({ id: itemId, qty });
      }
    }
    save();
    return 'added';
  }

  // ── addItemBuy (เพิ่มของที่ซื้อ → equip ก่อน ถ้า stack ได้และตรงกับที่สวมอยู่ ──
  //    ไม่งั้นเข้า items grid ตามปกติ)
  // returns: 'added' | 'full'
  function addItemBuy(itemId, qty = 1) {
    const def       = findDef(itemId);
    const slot      = getEquipSlot(def);
    if (slot && _equipCanStack(slot) && equip[slot] === itemId) {
      equipQty[slot] = (equipQty[slot] || 0) + qty;
      save();
      return 'added';
    }
    return addItem(itemId, qty);
  }

  // ── addItemFromStash (lobby: ดึงจาก Stash → BP) ──────────
  // ต่างจาก addItem คือตรวจสอบ Stash ด้วย
  // returns: 'added' | 'full' | 'no_stock'
  function addItemFromStash(itemId, qty = 1) {
    if (typeof Stash === 'undefined') return 'no_stock';
    const avail = Stash.getQty(itemId);
    if (avail <= 0) return 'no_stock';
    const realQty = Math.min(qty, avail);
    const result  = addItem(itemId, realQty);
    if (result === 'added') Stash.spend(itemId, realQty);
    return result;
  }

  // ── removeItem (items grid → ออก) ────────────────────────
  function removeItem(itemId, qty = 1, slotIdx = -1) {
    let idx = slotIdx >= 0 ? slotIdx : items.findIndex(s => s.id === itemId);
    if (idx === -1) return false;
    items[idx].qty -= qty;
    if (items[idx].qty <= 0) items.splice(idx, 1);
    save();
    return true;
  }

  // ── equip ────────────────────────────────────────────────
  function equipItem(itemId, slotId, qty = 1) {
    const def = findDef(itemId);
    const targetSlot = slotId || getEquipSlot(def);
    if (!targetSlot) return 'wrong_slot';
    if (_equipCanStack(targetSlot) && equip[targetSlot] === itemId) {
      equipQty[targetSlot] = (equipQty[targetSlot] || 0) + qty;
    } else {
      equip[targetSlot]    = itemId;
      equipQty[targetSlot] = qty;
    }
    save();
    if (targetSlot === 'gun') window.dispatchEvent(new CustomEvent('gun_equip_changed', { detail: { gunId: itemId } }));
    return 'equipped';
  }
  function unequipSlot(slotId) {
    if (!equip[slotId]) return false;
    equip[slotId]    = null;
    equipQty[slotId] = 1;
    save();
    if (slotId === 'gun') window.dispatchEvent(new CustomEvent('gun_equip_changed', { detail: { gunId: null } }));
    return true;
  }
  function toggleEquip(itemId, slotId) {
    if (equip[slotId] === itemId) { unequipSlot(slotId); return 'unequipped'; }
    return equipItem(itemId, slotId);
  }

  // ── clear all (เรียกตอนตายในเกม) ─────────────────────────
  function clearAll() {
    for (const s of EQUIP_SLOTS) { equip[s] = null; equipQty[s] = 1; }
    items = [];
    save();
  }

  // ── getters ──────────────────────────────────────────────
  function getEquip()           { return { ...equip }; }
  function getItems()           { return [...items]; }
  function getEquippedInSlot(s)    { return equip[s] ?? null; }
  function getEquippedQtyInSlot(s)  { return equip[s] ? (equipQty[s] || 1) : 0; }
  function setEquipQty(slotId, qty)  { if (!equip[slotId]) return; equipQty[slotId] = Math.max(1, qty); save(); }
  function hasInItems(id)       { return items.some(s => s.id === id); }
  function countItems(id)       { return items.filter(s => s.id === id).reduce((a,b) => a + b.qty, 0); }
  function getSupplyQty(id)     { return countItems(id); }
  function consumeFromItems(id) {
    const idx = items.findIndex(s => s.id === id);
    if (idx === -1) return false;
    items[idx].qty--;
    if (items[idx].qty <= 0) items.splice(idx, 1);
    save();
    return true;
  }

  // ── qty popup (lobby) ─────────────────────────────────────
  function showQtyPopup(maxQty, label, onConfirm) {
    const old = document.getElementById('bp-qty-popup');
    if (old) old.remove();
    const pop = document.createElement('div');
    pop.id = 'bp-qty-popup';
    pop.innerHTML = `
      <div class="bp-qty-backdrop"></div>
      <div class="bp-qty-box">
        <div class="bp-qty-title">ระบุจำนวน</div>
        <div class="bp-qty-avail">มี <b>${maxQty}</b> ชิ้นใน${label}</div>
        <div class="bp-qty-row">
          <button class="bp-qty-btn" id="bp-qty-minus">−</button>
          <input class="bp-qty-input" id="bp-qty-val" type="number" min="1" max="${maxQty}" value="1">
          <button class="bp-qty-btn" id="bp-qty-plus">+</button>
        </div>
        <div class="bp-qty-actions">
          <button class="bp-qty-cancel" id="bp-qty-cancel">ยกเลิก</button>
          <button class="bp-qty-confirm" id="bp-qty-ok">ยืนยัน</button>
        </div>
      </div>`;
    document.body.appendChild(pop);
    const inp = document.getElementById('bp-qty-val');
    const clamp = () => { let v = Math.max(1, Math.min(maxQty, parseInt(inp.value)||1)); inp.value = v; };
    document.getElementById('bp-qty-minus').addEventListener('click', () => { inp.value = Math.max(1, (parseInt(inp.value)||1)-1); });
    document.getElementById('bp-qty-plus').addEventListener('click',  () => { inp.value = Math.min(maxQty, (parseInt(inp.value)||1)+1); });
    inp.addEventListener('blur', clamp);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { clamp(); doConfirm(); } });
    function doConfirm() { clamp(); const qty = parseInt(inp.value)||1; pop.remove(); onConfirm(qty); }
    function doCancel()  { pop.remove(); }
    document.getElementById('bp-qty-ok').addEventListener('click', doConfirm);
    document.getElementById('bp-qty-cancel').addEventListener('click', doCancel);
    pop.querySelector('.bp-qty-backdrop').addEventListener('click', doCancel);
  }

  // ═══════════════════════════════════════════════════════
  // ── LOBBY RENDER ────────────────────────────────────────
  // ═══════════════════════════════════════════════════════

  function renderEquipSlots() {
    const el = document.getElementById('bp-equip-slots');
    if (!el) return;
    el.innerHTML = EQUIP_SLOTS.map(slotId => {
      const meta   = EQUIP_META[slotId];
      const itemId = equip[slotId];
      const def    = itemId ? findDef(itemId) : null;
      if (def) {
        return `
          <div class="bp-equip-slot filled"
               draggable="true"
               data-equip-slot="${slotId}"
               data-item-id="${itemId}"
               onclick="Backpack.clickEquipSlot('${slotId}')"
               title="คลิก=ถอด | ลาก=ย้าย">
            <div class="bp-equip-remove" style="pointer-events:none">✕</div>
            <div class="bp-equip-icon" style="pointer-events:none">${def.icon}</div>
            <div class="bp-equip-label" style="pointer-events:none">${def.name}</div>
            ${_equipCanStack(slotId) && equipQty[slotId] > 1 ? `<div class="bp-equip-qty" style="pointer-events:none">x${equipQty[slotId]}</div>` : ''}
          </div>`;
      }
      return `
        <div class="bp-equip-slot empty" data-equip-slot="${slotId}" title="${meta.name}">
          <div class="bp-equip-placeholder" style="pointer-events:none">${meta.label}</div>
          <div class="bp-equip-label" style="pointer-events:none">${meta.name}</div>
        </div>`;
    }).join('');

    el.querySelectorAll('.bp-equip-slot').forEach(slot => {
      slot.addEventListener('dragover', e => { e.preventDefault(); slot.classList.add('drag-over'); });
      slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
      slot.addEventListener('drop', e => {
        e.preventDefault();
        slot.classList.remove('drag-over');
        const targetSlotId = slot.dataset.equipSlot;
        if (dragSource === 'stash' && dragItemId) {
          _dropStashOnEquip(dragItemId, targetSlotId);
          _clearDrag();
        } else if (dragSource === 'bp' && dragItemId) {
          _dropBPItemOnEquip(dragItemId, dragBPSlotIdx, targetSlotId);
          _clearDrag();
        }
      });

      if (slot.classList.contains('filled')) {
        slot.addEventListener('dragstart', e => {
          dragSource    = 'equip';
          dragItemId    = slot.dataset.itemId;
          dragBPSlotIdx = -1;
          _dragEquipSlot = slot.dataset.equipSlot;
          e.dataTransfer.effectAllowed = 'move';
          slot.classList.add('dragging');
        });
        slot.addEventListener('dragend', () => {
          slot.classList.remove('dragging');
          _clearDrag();
        });
      }
    });
  }

  function renderItemsGrid() {
    const el = document.getElementById('bp-items-grid');
    if (!el) return;
    const countEl = document.getElementById('bp-items-count');
    if (countEl) countEl.textContent = `${items.length} / ${ITEMS_MAX}`;

    let html = '';
    items.forEach((slot, idx) => {
      const def = findDef(slot.id);
      if (!def) return;
      html += `
        <div class="bp-item-slot filled"
             draggable="true"
             data-bp-idx="${idx}"
             data-item-id="${slot.id}"
             onclick="Backpack.clickItemSlot(${idx})"
             title="${def.name} — คลิก=คืนคลัง 1 ชิ้น | ลาก=คืนคลังทั้งหมด">
          <div class="bp-item-remove" style="pointer-events:none">✕</div>
          <div class="bp-item-icon" style="pointer-events:none">${def.icon}</div>
          <div class="bp-item-name" style="pointer-events:none">${def.name}</div>
          ${slot.qty > 1 ? `<div class="bp-item-qty" style="pointer-events:none">x${slot.qty}</div>` : ''}
        </div>`;
    });
    const empty = ITEMS_MAX - items.length;
    for (let i = 0; i < empty; i++) html += `<div class="bp-item-slot empty"></div>`;
    el.innerHTML = html;

    el.querySelectorAll('.bp-item-slot.filled').forEach(slot => {
      slot.addEventListener('dragstart', e => {
        dragSource    = 'bp';
        dragItemId    = slot.dataset.itemId;
        dragBPSlotIdx = parseInt(slot.getAttribute('data-bp-idx'));
        e.dataTransfer.effectAllowed = 'move';
        slot.classList.add('dragging');
      });
      slot.addEventListener('dragend', () => {
        slot.classList.remove('dragging');
      });
    });

    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drag-over-grid'); });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over-grid'));
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.classList.remove('drag-over-grid');
      if (dragSource === 'stash' && dragItemId) {
        _dropStashOnGrid(dragItemId);
      } else if (dragSource === 'equip' && _dragEquipSlot) {
        const itemId = equip[_dragEquipSlot];
        if (itemId) {
          const def = findDef(itemId);
          const qty = equipQty[_dragEquipSlot] || 1;
          // stackable items ไม่ต้องเช็ค ITEMS_MAX เพราะจะรวมกับ slot เดิม
          const wouldAddNew = !canStack(def) || !items.some(s => s.id === itemId);
          if (wouldAddNew && items.length >= ITEMS_MAX) {
            _toast('กระเป๋าเต็มแล้ว!', 'error');
          } else {
            unequipSlot(_dragEquipSlot);
            _pushToItemsDirect(itemId, qty);
            save();
            render(); _lobbyStashRender();
            _toast(`ย้าย ${def?.name ?? itemId} ไป Items ✓`, 'success');
          }
        }
      }
      _clearDrag();
    });
  }

  function render() { renderEquipSlots(); renderItemsGrid(); }

  // ── drop handlers (lobby) ────────────────────────────────
  function _dropBPItemOnEquip(itemId, slotIdx, targetSlotId) {
    const def = findDef(itemId);
    if (!def) return;
    const correctSlot = getEquipSlot(def);
    if (!correctSlot) { _toast(`${def.name} ใส่ equip slot ไม่ได้`, 'error'); return; }
    if (correctSlot !== targetSlotId) {
      _toast(`${def.name} ใส่ช่อง${EQUIP_META[targetSlotId]?.name}ไม่ได้`, 'error');
      return;
    }
    const qty = items[slotIdx]?.qty ?? 1;
    const existing = equip[targetSlotId];

    if (_equipCanStack(targetSlotId) && existing === itemId) {
      // stack: ชนิดเดียวกัน → รวม qty เลย
      equipQty[targetSlotId] = (equipQty[targetSlotId] || 0) + qty;
      removeItem(itemId, qty, slotIdx);
      save();
    } else {
      // swap: ของต่างชนิด หรือ slot ที่ stack ไม่ได้
      if (existing) {
        const oldQty = equipQty[targetSlotId] || 1;
        unequipSlot(targetSlotId);
        _pushToItemsDirect(existing, oldQty);
      }
      removeItem(itemId, qty, slotIdx);
      equipItem(itemId, targetSlotId, qty);
    }
    render(); _lobbyStashRender();
  }

  function _dropStashOnEquip(itemId, slotId) {
    const def = findDef(itemId);
    if (!def) return;
    const correctSlot = getEquipSlot(def);
    if (!correctSlot) { _toast(`${def.name} ใส่ equip slot ไม่ได้`, 'error'); return; }
    if (correctSlot !== slotId) { _toast(`ใส่ ${def.name} ที่ช่อง${EQUIP_META[slotId]?.name}ไม่ได้`, 'error'); return; }
    if (typeof Stash === 'undefined' || Stash.getQty(itemId) <= 0) {
      _toast('ของในคลังหมดแล้ว', 'error'); return;
    }

    const existing = equip[slotId];

    if (_equipCanStack(slotId)) {
      const avail = Stash.getQty(itemId);
      if (existing && existing !== itemId) {
        // ของต่างชนิด → คืนของเดิมกลับ Stash แล้วใส่ใหม่
        const oldQty = equipQty[slotId] || 1;
        unequipSlot(slotId);
        Stash.add(existing, oldQty);
      }
      // ถ้า existing === itemId → stack ต่อเลย (equipItem จะ +qty ให้อยู่แล้ว)
      showQtyPopup(avail, 'คลัง', qty => {
        equipItem(itemId, slotId, qty);
        Stash.spend(itemId, qty);
        render(); _lobbyStashRender();
      });
    } else {
      // slot ที่ stack ไม่ได้ → swap ปกติ
      if (existing) {
        const oldQty = equipQty[slotId] || 1;
        unequipSlot(slotId);
        if (typeof Stash !== 'undefined') Stash.add(existing, oldQty);
      }
      equipItem(itemId, slotId);
      Stash.spend(itemId, 1);
      render(); _lobbyStashRender();
    }
  }

  function _dropStashOnGrid(itemId) {
    const def   = findDef(itemId);
    if (!def) return;
    if (typeof Stash === 'undefined' || Stash.getQty(itemId) <= 0) {
      _toast('ของในคลังหมดแล้ว', 'error'); return;
    }
    if (!canStack(def)) {
      const res = addItemFromStash(itemId, 1);
      if (res === 'added') { render(); _lobbyStashRender(); }
      else if (res === 'full') _toast('กระเป๋าเต็มแล้ว!', 'error');
    } else {
      const avail = Stash.getQty(itemId);
      showQtyPopup(avail, 'คลัง', qty => {
        const res = addItemFromStash(itemId, qty);
        if (res === 'added') { render(); _lobbyStashRender(); }
        else if (res === 'full') _toast('กระเป๋าเต็มแล้ว!', 'error');
      });
    }
  }

  function dropEquipOnStash() {
    if (!_dragEquipSlot) return;
    const itemId = equip[_dragEquipSlot];
    if (!itemId) return;
    const qty = equipQty[_dragEquipSlot] || 1;
    unequipSlot(_dragEquipSlot);
    if (typeof Stash !== 'undefined') Stash.add(itemId, qty);
    render(); _lobbyStashRender();
  }

  function dropBPItemOnStash(slotIdx) {
    if (slotIdx < 0 || slotIdx >= items.length) return;
    const slot = items[slotIdx];
    if (!slot) return;
    items.splice(slotIdx, 1);
    save();
    if (typeof Stash !== 'undefined') Stash.add(slot.id, slot.qty);
    render(); _lobbyStashRender();
  }

  // ── click handlers (lobby) ────────────────────────────────
  function clickEquipSlot(slotId) {
    const itemId = equip[slotId];
    if (!itemId) return;
    const qty = equipQty[slotId] || 1;
    unequipSlot(slotId);
    if (typeof Stash !== 'undefined') Stash.add(itemId, qty);
    render(); _lobbyStashRender();
  }

  function clickItemSlot(slotIdx) {
    if (slotIdx < 0 || slotIdx >= items.length) return;
    const slot = items[slotIdx];
    if (!slot) return;
    removeItem(slot.id, 1, slotIdx);
    if (typeof Stash !== 'undefined') Stash.add(slot.id, 1);
    render(); _lobbyStashRender();
  }

  // ═══════════════════════════════════════════════════════
  // ── IN-GAME PANEL (ใช้ Backpack state โดยตรง) ──────────
  // ═══════════════════════════════════════════════════════

  function togglePanel() { _panelOpen ? closePanel() : openPanel(); }

  function openPanel() {
    _panelOpen = true;
    renderPanel();
    if (typeof Sounds !== 'undefined') Sounds.play('backpack', 0.7);
    const overlay = document.getElementById('ingame-bp-overlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    requestAnimationFrame(() => overlay.classList.add('visible'));
    const btn = document.getElementById('btn-ingame-bp');
    if (btn) btn.classList.add('active');
  }

  function closePanel() {
    _panelOpen = false;
    if (typeof Sounds !== 'undefined') Sounds.play('backpack', 0.7);
    const overlay = document.getElementById('ingame-bp-overlay');
    if (!overlay) return;
    overlay.classList.remove('visible');
    setTimeout(() => { overlay.style.display = 'none'; }, 220);
    const btn = document.getElementById('btn-ingame-bp');
    if (btn) btn.classList.remove('active');
  }

  // keyboard shortcut ใน game
  window.addEventListener('keydown', e => {
    if (document.getElementById('ingame-bp-overlay')) {
      if (e.key && e.key.toLowerCase() === 'b') togglePanel();
      if (e.key === 'Escape' && _panelOpen) closePanel();
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('ingame-bp-overlay');
    if (overlay) overlay.addEventListener('click', e => { if (e.target === overlay) closePanel(); });
  });

  // ── render in-game panel ──────────────────────────────────
  // Auto-shrink text ให้พอดี slot โดยไม่ตัด
  function _fitTextInSlots(containerEl) {
    if (!containerEl) return;
    containerEl.querySelectorAll('.igbp-equip-name, .igbp-item-name').forEach(el => {
      el.style.fontSize = '';
      const parent = el.parentElement;
      if (!parent) return;
      const maxW = parent.clientWidth - 6;
      let size = parseFloat(getComputedStyle(el).fontSize);
      while (el.scrollWidth > maxW && size > 5) {
        size -= 0.5;
        el.style.fontSize = size + 'px';
      }
    });
  }

  function renderPanel() {
    _renderPanelEquip();
    _renderPanelItems();
    _renderInfoTab();
    // อัปเดต badge จำนวน items
    const badge = document.getElementById('igbp-count-badge');
    if (badge) badge.textContent = `${items.length} / ${ITEMS_MAX}`;
    // fit text หลัง DOM อัปเดต
    requestAnimationFrame(() => {
      _fitTextInSlots(document.getElementById('igbp-equip-slots'));
      _fitTextInSlots(document.getElementById('igbp-items-grid'));
      if (typeof Bandage !== 'undefined') Bandage.updateUI();
    });
  }

  // เลือกไอเทมเพื่อแสดงในคอลัมน์ INFO ฝั่งขวา
  function showItemInfo(itemId) {
    _infoItemId = itemId;
    _renderInfoTab();
  }

  function _renderInfoTab() {
    const el = document.getElementById('igbp-info-content');
    if (!el) return;
    if (!_infoItemId) {
      el.innerHTML = `<div class="igbp-info-empty">เลือกไอเทมเพื่อดูรายละเอียด</div>`;
      return;
    }
    const def = findDef(_infoItemId);
    if (!def) {
      el.innerHTML = `<div class="igbp-info-empty">ไม่พบข้อมูลไอเทม</div>`;
      return;
    }

    const inBP = countInBP(_infoItemId);

    function statBar(label, val, max, color) {
      const pct = Math.min(100, Math.round((val / max) * 100));
      return `
        <div class="igbp-stat-row">
          <span class="igbp-stat-label">${label}</span>
          <div class="igbp-stat-track">
            <div class="igbp-stat-fill" style="width:${pct}%;background:${color}"></div>
          </div>
          <span class="igbp-stat-val">${val}</span>
        </div>`;
    }

    const statBars = [];
    if (def.weaponId && typeof WEAPON_CONFIG !== 'undefined' && WEAPON_CONFIG[def.weaponId]) {
      const wc = WEAPON_CONFIG[def.weaponId];
      statBars.push(statBar('DMG',    wc.damage,  120, '#ef5350'));
      statBars.push(statBar('AMMO',   wc.maxAmmo, 30,  '#42a5f5'));
      const fireVal = Math.round((1200 / Math.max(wc.fireRate, 50)) * 10);
      statBars.push(statBar('RATE',   Math.min(fireVal, 30), 30, '#ffa726'));
      const reloadVal = Math.round((1 - wc.reloadTime / 4000) * 10);
      statBars.push(statBar('RELOAD', Math.max(reloadVal, 1), 10, '#66bb6a'));
    } else {
      if (def.damage) statBars.push(statBar('DMG',  def.damage, 120, '#ef5350'));
      if (def.ammo)   statBars.push(statBar('AMMO', def.ammo,   30,  '#42a5f5'));
      const armorVal = def.armorId && typeof ARMOR_CONFIG !== 'undefined' && ARMOR_CONFIG[def.armorId]
        ? ARMOR_CONFIG[def.armorId].armorPct
        : def.armor;
      if (armorVal)  statBars.push(statBar('ARMOR', armorVal, 100, '#42a5f5'));
      if (def.hp)     statBars.push(statBar('HP',    def.hp,     200, '#66bb6a'));
      if (def.speed)  statBars.push(statBar('SPEED', def.speed,  10,  '#66bb6a'));
      if (def.regen)  statBars.push(statBar('REGEN', def.regen,  10,  '#66bb6a'));
      if (def.heal)   statBars.push(statBar('HEAL',  def.heal,   100, '#66bb6a'));
      if (def.qty)    statBars.push(statBar('QTY',   def.qty,    20,  '#ffa726'));
    }

    const iconHtml = (def.icon && def.icon.includes('<img'))
      ? `<div class="igbp-info-icon">${def.icon}</div>`
      : `<div class="igbp-info-icon" style="font-size:36px">${def.icon || '📦'}</div>`;

    const statsHtml = statBars.length > 0
      ? `<div class="igbp-info-divider"></div>
         <div class="igbp-stats-wrap">${statBars.join('')}</div>`
      : '';

    el.innerHTML = `
      ${iconHtml}
      <div class="igbp-info-name">${def.name}</div>
      ${statsHtml}
      <div class="igbp-info-divider"></div>
      <div class="igbp-info-qty-row">
        <span class="igbp-info-qty-label">IN BAG</span>
        <span class="igbp-info-qty-num">${inBP}</span>
      </div>`;
  }

  // drag state ของ in-game panel (แยก var เพื่อไม่ชนกับ lobby drag)
  let _pgDragSrc  = null;  // 'pg_equip' | 'pg_item'
  let _pgDragSlot = null;
  let _pgDragIdx  = -1;
  let _pgDragItem = null;

  function _pgClearDrag() { _pgDragSrc = null; _pgDragSlot = null; _pgDragIdx = -1; _pgDragItem = null; }

  // ── ลากไอเทมออกนอกกระเป๋า → ทิ้งลงพื้นใน world ────────────
  // src: 'pg_item' | 'pg_equip'
  // ref: slotIdx (สำหรับ pg_item) หรือ slotId (สำหรับ pg_equip)
  function _maybeDropOutside(e, src, ref, itemId) {
    if (!itemId) return;
    const panel = document.getElementById('ingame-bp-panel');
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const x = e.clientX, y = e.clientY;
    // ถ้าจุดปล่อย (0,0 = ไม่มี coordinate, บางเบราว์เซอร์ส่งมาแบบนี้ตอน drop ไม่สำเร็จ) ให้ข้าม
    if (x === 0 && y === 0) return;
    const inside = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    if (inside) return; // ปล่อยในกระเป๋า → ไม่ทิ้ง

    if (typeof Network === 'undefined' || typeof player === 'undefined' || !Network.getMyId()) {
      _toast('ทิ้งของได้เฉพาะตอนอยู่ในเกม', 'error');
      return;
    }

    // หาจำนวนสูงสุดที่ทิ้งได้
    let maxQty = 1;
    let stackable = false;
    if (src === 'pg_item') {
      const slot = items[ref];
      if (!slot) return;
      maxQty = slot.qty;
      stackable = canStack(findDef(itemId)) && maxQty > 1;
    } else if (src === 'pg_equip') {
      maxQty = equipQty[ref] || 1;
      stackable = _equipCanStack(ref) && maxQty > 1;
    } else {
      return;
    }

    // stackable + มีมากกว่า 1 ชิ้น → ถาม qty ก่อนทิ้ง
    if (stackable) {
      showQtyPopup(maxQty, 'กระเป๋า', qty => _doDropOutside(src, ref, itemId, qty));
    } else {
      _doDropOutside(src, ref, itemId, maxQty);
    }
  }

  function _doDropOutside(src, ref, itemId, qty) {
    if (src === 'pg_item') {
      const slotIdx = ref;
      if (slotIdx < 0 || slotIdx >= items.length) return;
      const slot = items[slotIdx];
      const actualQty = Math.min(qty, slot.qty);
      slot.qty -= actualQty;
      if (slot.qty <= 0) items.splice(slotIdx, 1);
      qty = actualQty;
    } else if (src === 'pg_equip') {
      const slotId = ref;
      const totalQty = equipQty[slotId] || 1;
      const actualQty = Math.min(qty, totalQty);
      if (actualQty >= totalQty) {
        unequipSlot(slotId);
      } else {
        equipQty[slotId] = totalQty - actualQty;
      }
      qty = actualQty;
    } else {
      return;
    }

    save();
    Network.sendDropItems(player.x, player.y, [{ id: itemId, qty }]);
    const def = findDef(itemId);
    _toast(`ทิ้ง ${def?.name ?? itemId} x${qty} ลงพื้น`, 'success');

    if (_infoItemId === itemId && countInBP(itemId) === 0) _infoItemId = null;
    renderPanel();
    _updateWeaponUI();
  }

  function _renderPanelEquip() {
    const el = document.getElementById('igbp-equip-slots');
    if (!el) return;

    el.innerHTML = EQUIP_SLOTS.map(slotId => {
      const meta   = EQUIP_META[slotId];
      const itemId = equip[slotId];
      const def    = itemId ? findDef(itemId) : null;
      if (def) {
        return `
          <div class="igbp-equip-slot filled"
               draggable="true"
               data-equip-slot="${slotId}"
               data-item-id="${itemId}"
               title="คลิก=ดูข้อมูล | ลาก=ถอด/ย้าย">
            <div class="igbp-equip-remove" style="pointer-events:none">✕</div>
            <div class="igbp-equip-icon"  style="pointer-events:none">${def.icon}</div>
            <div class="igbp-equip-name"  style="pointer-events:none">${def.name}</div>
            ${_equipCanStack(slotId) && equipQty[slotId] > 1 ? `<div class="igbp-item-qty" style="pointer-events:none">x${equipQty[slotId]}</div>` : ''}
          </div>`;
      }
      return `
        <div class="igbp-equip-slot empty" data-equip-slot="${slotId}" title="${meta.name}">
          <div class="igbp-equip-ph"   style="pointer-events:none">${meta.label}</div>
          <div class="igbp-equip-name" style="pointer-events:none">${meta.name}</div>
        </div>`;
    }).join('');

    el.querySelectorAll('.igbp-equip-slot').forEach(slot => {
      const slotId = slot.dataset.equipSlot;

      if (slot.classList.contains('filled')) {
        slot.addEventListener('click', () => {
          // คลิก = แสดงข้อมูลไอเทม (ลาก = ถอด/ย้าย)
          const itemId = equip[slotId];
          if (!itemId) return;
          showItemInfo(itemId);
        });
        slot.addEventListener('dragstart', e => {
          _pgDragSrc  = 'pg_equip';
          _pgDragSlot = slotId;
          _pgDragItem = slot.dataset.itemId;
          e.dataTransfer.effectAllowed = 'move';
          slot.classList.add('igbp-dragging');
        });
        slot.addEventListener('dragend', e => {
          slot.classList.remove('igbp-dragging');
          _maybeDropOutside(e, 'pg_equip', slotId, slot.dataset.itemId);
          _pgClearDrag();
        });
      }

      slot.addEventListener('dragover', e => {
        if (_pgDragSrc === 'pg_item') { e.preventDefault(); slot.classList.add('igbp-drag-over'); }
      });
      slot.addEventListener('dragleave', () => slot.classList.remove('igbp-drag-over'));
      slot.addEventListener('drop', e => {
        e.preventDefault();
        slot.classList.remove('igbp-drag-over');
        if (_pgDragSrc !== 'pg_item') return;
        _panelEquipFromItems(_pgDragItem, _pgDragIdx, slotId);
        _pgClearDrag();
      });
    });
  }

  function _renderPanelItems() {
    const el = document.getElementById('igbp-items-grid');
    if (!el) return;

    let html = '';
    items.forEach((slot, idx) => {
      const def = findDef(slot.id);
      if (!def) return;
      html += `
        <div class="igbp-item-slot filled"
             draggable="true"
             data-item-idx="${idx}"
             data-item-id="${slot.id}"
             title="${def.name}">
          <div class="igbp-item-remove" style="pointer-events:none">✕</div>
          <div class="igbp-item-icon"  style="pointer-events:none">${def.icon}</div>
          <div class="igbp-item-name"  style="pointer-events:none">${def.name}</div>
          ${slot.qty > 1 ? `<div class="igbp-item-qty" style="pointer-events:none">x${slot.qty}</div>` : ''}
        </div>`;
    });
    const empty = ITEMS_MAX - items.length;
    for (let i = 0; i < empty; i++) html += `<div class="igbp-item-slot empty"></div>`;
    el.innerHTML = html;

    el.querySelectorAll('.igbp-item-slot.filled').forEach(slot => {
      slot.addEventListener('dragstart', e => {
        _pgDragSrc  = 'pg_item';
        _pgDragItem = slot.dataset.itemId;
        _pgDragIdx  = parseInt(slot.dataset.itemIdx);
        e.dataTransfer.effectAllowed = 'move';
        slot.classList.add('igbp-dragging');
      });
      slot.addEventListener('dragend', e => {
        slot.classList.remove('igbp-dragging');
        _maybeDropOutside(e, 'pg_item', _pgDragIdx, _pgDragItem);
        _pgClearDrag();
      });
      // คลิก = ดูข้อมูลไอเทม (ไม่รบกวน drag)
      slot.addEventListener('click', () => {
        showItemInfo(slot.dataset.itemId);
      });
    });

    el.addEventListener('dragover', e => {
      if (_pgDragSrc === 'pg_equip') { e.preventDefault(); el.classList.add('igbp-grid-over'); }
    });
    el.addEventListener('dragleave', () => el.classList.remove('igbp-grid-over'));
    el.addEventListener('drop', e => {
      e.preventDefault();
      el.classList.remove('igbp-grid-over');
      if (_pgDragSrc !== 'pg_equip' || !_pgDragSlot) return;
      // ถอด equip → items
      const itemId = equip[_pgDragSlot];
      if (itemId) {
        const qty = equipQty[_pgDragSlot] || 1;
        const def = findDef(itemId);
        const wouldAddNew = !canStack(def) || !items.some(s => s.id === itemId);
        if (wouldAddNew && items.length >= ITEMS_MAX) {
          _toast('กระเป๋าเต็มแล้ว!', 'error');
        } else {
          unequipSlot(_pgDragSlot);
          _pushToItemsDirect(itemId, qty);
          save();
          renderPanel();
          _updateWeaponUI();
        }
      }
      _pgClearDrag();
    });
  }

  // ── panel helpers ────────────────────────────────────────

  // push ลง items grid โดยตรง (stack-aware, ใช้ในเกม)
  function _pushToItemsDirect(itemId, qty) {
    const def = findDef(itemId);
    if (!def) return;
    if (canStack(def)) {
      const idx = items.findIndex(s => s.id === itemId);
      if (idx !== -1) { items[idx].qty += qty; return; }
    }
    items.push({ id: itemId, qty });
  }

  // ลาก item → equip slot (swap อัตโนมัติ) — in-game panel
  function _panelEquipFromItems(itemId, slotIdx, targetSlotId) {
    const def = findDef(itemId);
    if (!def) return;
    const correctSlot = getEquipSlot(def);
    if (!correctSlot || correctSlot !== targetSlotId) return;

    const existing = equip[targetSlotId];
    const addQty = items[slotIdx]?.qty ?? 1;

    if (_equipCanStack(targetSlotId) && existing === itemId) {
      // stack: ชนิดเดียวกัน → รวม qty เลย ไม่ต้อง swap
      _rawRemoveFromItems(itemId, slotIdx, true);
      equipQty[targetSlotId] = (equipQty[targetSlotId] || 0) + addQty;
    } else if (_equipCanStack(targetSlotId) && existing && existing !== itemId) {
      // ของต่างชนิดใน stackable slot → swap: คืนของเดิมกลับ items
      const oldQty = equipQty[targetSlotId] || 1;
      _rawRemoveFromItems(itemId, slotIdx, true);
      equip[targetSlotId]    = itemId;
      equipQty[targetSlotId] = addQty;
      _pushToItemsDirect(existing, oldQty);
    } else if (existing && !_equipCanStack(targetSlotId)) {
      // slot ที่ stack ไม่ได้ มีของอยู่แล้ว → swap
      const oldQty = equipQty[targetSlotId] || 1;
      _rawRemoveFromItems(itemId, slotIdx);
      equip[targetSlotId]    = itemId;
      equipQty[targetSlotId] = 1;
      _pushToItemsDirect(existing, oldQty);
    } else {
      // slot ว่าง
      _rawRemoveFromItems(itemId, slotIdx, _equipCanStack(targetSlotId));
      equip[targetSlotId]    = itemId;
      equipQty[targetSlotId] = _equipCanStack(targetSlotId) ? addQty : 1;
    }
    save();
    // [FIX] dispatch gun_equip_changed เมื่อ swap ปืนผ่าน drag
    // เดิมไม่มี dispatch ทำให้ Weapon.js ไม่รู้ว่าปืนเปลี่ยน → ammo ค้างค่าปืนเก่า
    if (targetSlotId === 'gun') {
      window.dispatchEvent(new CustomEvent('gun_equip_changed', { detail: { gunId: equip[targetSlotId] } }));
    }
    renderPanel();
    _updateWeaponUI();
  }

  function _rawRemoveFromItems(itemId, slotIdx, removeAll = false) {
    if (slotIdx >= 0 && slotIdx < items.length && items[slotIdx].id === itemId) {
      if (removeAll) { items.splice(slotIdx, 1); return; }
      items[slotIdx].qty -= 1;
      if (items[slotIdx].qty <= 0) items.splice(slotIdx, 1);
    } else {
      const idx = items.findIndex(s => s.id === itemId);
      if (idx === -1) return;
      if (removeAll) { items.splice(idx, 1); return; }
      items[idx].qty -= 1;
      if (items[idx].qty <= 0) items.splice(idx, 1);
    }
  }

  function _updateWeaponUI() {
    if (!window._isInGame) return;  // อยู่ใน lobby → ไม่แสดง HUD
    if (typeof Weapon !== 'undefined' && Weapon.updateAmmoUI) Weapon.updateAmmoUI();
  }

  // ── helpers ──────────────────────────────────────────────
  function _toast(msg, type = '') {
    if (typeof window.showToast === 'function') window.showToast(msg, type);
  }
  function _lobbyStashRender() {
    if (typeof Inventory !== 'undefined') Inventory.renderStash();
  }
  function _clearDrag() { dragSource = null; dragItemId = null; dragBPSlotIdx = -1; _dragEquipSlot = null; }

  // ── drag API สำหรับ inventory.js ────────────────────────
  function startStashDrag(itemId) { dragSource = 'stash'; dragItemId = itemId; }
  function getDragSource()        { return dragSource; }
  function getDragItem()          { return dragItemId; }
  function getDragBPIdx()         { return dragBPSlotIdx; }
  function clearDrag()            { _clearDrag(); }
  function startDrag(itemId)      { startStashDrag(itemId); } // compat

  // ── init ─────────────────────────────────────────────────
  function init(userId) { uid = userId; load(); }

  return {
    init, load, save, render, renderPanel,
    togglePanel, openPanel, closePanel,
    showItemInfo,
    addItem, addItemBuy, addItemFromStash, removeItem,
    toggleEquip, equipItem, unequipSlot,
    clickEquipSlot, clickItemSlot,
    dropBPItemOnStash, dropEquipOnStash,
    startDrag, startStashDrag, getDragSource, getDragItem, getDragBPIdx, clearDrag,
    showQtyPopup,
    getEquip, getItems,
    clearAll,
    getUid: () => uid,
    getEquippedInSlot, getEquippedQtyInSlot, setEquipQty, hasInItems, countItems,
    getEquipSlot, findDef, canStack, isWeapon,
    getSupplyQty, consumeFromItems,
    countInBP,
    EQUIP_SLOTS, EQUIP_META, ITEMS_MAX,
  };
})();

window.Backpack = Backpack;
