// ===== SHOP.JS (WarZ Style) =====
// depends on: config_money.js, money.js, config_shop.js, items.js, stash.js
//
// หมายเหตุ: money/point ใช้ Money module (Firebase)
// supplyQty (ของที่ซื้อ) ใช้ Stash module (Firebase) — ไม่มี localStorage แล้ว

const Shop = (() => {
  let uid       = null;

  let currentCat    = 'gun';
  let selectedItem  = null;
  let buyQty        = 1;
  const MAX_BUY_QTY = 9999; // [FIX] upper bound ป้องกัน overflow และ UI พัง

  // ── category map ──────────────────────────────────────────
  const CAT_MAP = {
    gun:    { label: '🔫', name: 'ปืน',     key: 'weapon'  },
    body:   { label: '👕', name: 'ตัว',     key: 'armor'   },
    head:   { label: '⛑️', name: 'หัว',     key: 'helmet'  },
    med:    { label: '🩹', name: 'ยา',      key: 'med'     },
    supply: { label: '🧪', name: 'ซัพพลาย', key: 'supply'  },
  };

  // ── helpers ───────────────────────────────────────────────
  function getItems(catId) {
    const key = CAT_MAP[catId]?.key;
    return (SHOP_ITEMS[key] || []).filter(i => getPrice(i) > 0);
  }

  function getPrice(item) {
    return typeof item.price === 'function' ? item.price() : item.price;
  }

  // ── select item ───────────────────────────────────────────
  function selectItem(itemId) {
    const items = getItems(currentCat);
    const item  = items.find(i => i.id === itemId);
    if (!item) return;
    selectedItem = item;
    buyQty = 1;
    renderDetail();
    document.querySelectorAll('.wz-item-slot').forEach(el => {
      el.classList.toggle('selected', el.dataset.id === itemId);
    });
  }

  // ── qty controls ──────────────────────────────────────────
  function setQty(delta) {
    buyQty = Math.min(MAX_BUY_QTY, Math.max(1, buyQty + delta));
    renderDetail();
  }

  function setQtyDirect(val) {
    const n = parseInt(val, 10);
    buyQty = isNaN(n) || n < 1 ? 1 : Math.min(MAX_BUY_QTY, n);
    renderDetail();
  }

  function openQtyPopup() {
    const old = document.getElementById('bp-qty-popup');
    if (old) old.remove();
    const pop = document.createElement('div');
    pop.id = 'bp-qty-popup';
    pop.innerHTML = `
      <div class="bp-qty-backdrop"></div>
      <div class="bp-qty-box">
        <div class="bp-qty-title">ระบุจำนวน</div>
        <div class="bp-qty-avail">ซื้อ <b>${selectedItem?.name || ''}</b></div>
        <div class="bp-qty-row">
          <button class="bp-qty-btn" id="bp-qty-minus">−</button>
          <input class="bp-qty-input" id="bp-qty-val" type="number" min="1" value="${buyQty}">
          <button class="bp-qty-btn" id="bp-qty-plus">+</button>
        </div>
        <div class="bp-qty-actions">
          <button class="bp-qty-cancel" id="bp-qty-cancel">ยกเลิก</button>
          <button class="bp-qty-confirm" id="bp-qty-ok">ยืนยัน</button>
        </div>
      </div>`;
    document.body.appendChild(pop);
    const inp = document.getElementById('bp-qty-val');
    const clamp = () => { inp.value = Math.min(MAX_BUY_QTY, Math.max(1, parseInt(inp.value) || 1)); };
    document.getElementById('bp-qty-minus').addEventListener('click', () => { inp.value = Math.max(1, (parseInt(inp.value)||1) - 1); });
    document.getElementById('bp-qty-plus').addEventListener('click',  () => { inp.value = Math.min(MAX_BUY_QTY, (parseInt(inp.value)||1) + 1); });
    inp.addEventListener('blur', clamp);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { clamp(); doConfirm(); } });
    function doConfirm() { clamp(); buyQty = parseInt(inp.value) || 1; pop.remove(); renderDetail(); }
    function doCancel()  { pop.remove(); }
    document.getElementById('bp-qty-ok').addEventListener('click', doConfirm);
    document.getElementById('bp-qty-cancel').addEventListener('click', doCancel);
    pop.querySelector('.bp-qty-backdrop').addEventListener('click', doCancel);
  }

  // ── buy ───────────────────────────────────────────────────
  function buy() {
    if (!selectedItem) return;
    const item  = selectedItem;
    const price = getPrice(item) * buyQty;

    const ok = Money.spend(item.currency, price);
    if (!ok) {
      return window.showToast(
        item.currency === 'money' ? 'เงินไม่พอ!' : 'Point ไม่พอ!',
        'error'
      );
    }

    // ── เขียนลง Firebase Stash (แทน localStorage) ─────────
    Stash.add(item.id, buyQty);

    const boughtQty = buyQty;
    buyQty = 1;
    render();
    window.showToast(`ซื้อ ${item.name} x${boughtQty} สำเร็จ! ✓`, 'success');
  }

  // ── render grid ───────────────────────────────────────────
  function renderGrid() {
    const grid  = document.getElementById('shop-grid');
    const items = getItems(currentCat);

    if (items.length === 0) {
      grid.innerHTML = `<div class="wz-empty">ยังไม่มีไอเทมในหมวดนี้</div>`;
      return;
    }

    grid.innerHTML = items.map(item => {
      const isSelected = selectedItem?.id === item.id;
      return `
        <div class="wz-item-slot ${isSelected ? 'selected' : ''}"
             data-id="${item.id}"
             onclick="Shop.selectItem('${item.id}')">
          <div class="wz-item-icon">${item.icon}</div>
          <div class="wz-item-name">${item.name}</div>
        </div>`;
    }).join('');
  }

  // ── stat bar helper (ใช้ style เดียวกับ character.js) ───────
  function itemStatBar(label, val, max, color) {
    const pct = Math.min(100, Math.round((val / max) * 100));
    return `
      <div class="char-stat-row">
        <span class="char-stat-label">${label}</span>
        <div class="char-stat-track">
          <div class="char-stat-fill" style="width:${pct}%;background:${color}"></div>
        </div>
        <span class="char-stat-val">${val}</span>
      </div>`;
  }

  // ── weapon stat bars ─────────────────────────────────────
  function weaponStatBars(weaponId) {
    const cfg = (typeof WEAPON_CONFIG !== 'undefined') && WEAPON_CONFIG[weaponId];
    if (!cfg) return '';
    const fireVal   = Math.round((1200 / Math.max(cfg.fireRate, 50)) * 10);
    const reloadVal = Math.round((1 - cfg.reloadTime / 4000) * 10);
    const bars = [
      itemStatBar('ดาเมจ',    cfg.damage,              120, '#ef5350'),
      itemStatBar('กระสุน',   cfg.maxAmmo,             30,  '#42a5f5'),
      itemStatBar('อัตราลั่น',   Math.min(fireVal, 30),   30,  '#ffa726'),
      itemStatBar('รีโหลด', Math.max(reloadVal, 1),  10,  '#66bb6a'),
    ];
    return `<div class="char-stats-wrap inv-stats-wrap" style="width:100%;margin:10px 0 4px;">${bars.join('')}</div>`;
  }

  // ── general item stat bars (armor, supply etc.) ───────────
  function generalStatBars(item) {
    const bars = [];
    if (item.damage) bars.push(itemStatBar('ดาเมจ',   item.damage, 120, '#ef5350'));
    if (item.ammo)   bars.push(itemStatBar('กระสุน',  item.ammo,   30,  '#42a5f5'));
    const armorVal = item.armorId && typeof ARMOR_CONFIG !== 'undefined' && ARMOR_CONFIG[item.armorId]
      ? ARMOR_CONFIG[item.armorId].armorPct
      : item.armor;
    if (armorVal)    bars.push(itemStatBar('ARMOR', armorVal,    100, '#42a5f5'));
    if (item.hp)     bars.push(itemStatBar('HP',    item.hp,     200, '#66bb6a'));
    if (item.speed)  bars.push(itemStatBar('SPEED', item.speed,  10,  '#66bb6a'));
    if (item.regen)  bars.push(itemStatBar('REGEN', item.regen,  10,  '#66bb6a'));
    if (item.heal)   bars.push(itemStatBar('HEAL',  item.heal,   100, '#66bb6a'));
    if (item.qty)    bars.push(itemStatBar('QTY',   item.qty,    20,  '#ffa726'));
    if (bars.length === 0) return '';
    return `<div class="char-stats-wrap inv-stats-wrap" style="width:100%;margin:10px 0 4px;">${bars.join('')}</div>`;
  }

  // ── render detail panel ───────────────────────────────────
  function renderDetail() {
    const panel = document.getElementById('shop-detail');

    if (!selectedItem) {
      panel.innerHTML = `<div class="wz-detail-empty">เลือกไอเทมเพื่อดูรายละเอียด</div>`;
      return;
    }

    const item       = selectedItem;
    const unitPrice  = getPrice(item);
    const totalPrice = unitPrice * buyQty;
    const wallet     = Money.get();
    const canAfford  = item.currency === 'money'
      ? wallet.money >= totalPrice
      : wallet.point >= totalPrice;
    const priceIcon  = item.currency === 'money' ? '💵' : '💎';
    const statsHtml  = item.weaponId
      ? weaponStatBars(item.weaponId)
      : generalStatBars(item);

    panel.innerHTML = `
      <div class="wz-detail-scroll">
        <div class="wz-detail-icon">${item.icon}</div>
        <div class="wz-detail-name">${item.name}</div>
        ${statsHtml}
        <div class="wz-qty-row">
          <button class="wz-qty-btn" onclick="Shop.setQty(-1)">−</button>
          <button class="wz-qty-display" onclick="Shop.openQtyPopup()">
            ${buyQty}
          </button>
          <button class="wz-qty-btn" onclick="Shop.setQty(1)">+</button>
        </div>

        <div class="wz-buy-row">
          <span class="wz-total-price ${item.currency}">
            ${priceIcon} ${totalPrice.toLocaleString()}
          </span>
          <button class="wz-btn-buy ${canAfford ? item.currency : 'disabled'}"
                  ${canAfford ? 'onclick="Shop.buy()"' : 'disabled'}>
            BUY${buyQty > 1 ? ` ×${buyQty}` : ''}
          </button>
        </div>
      </div>`;
  }

  // ── switch category ───────────────────────────────────────
  function switchCat(catId) {
    currentCat   = catId;
    selectedItem = null;
    buyQty       = 1;

    document.querySelectorAll('.wz-cat-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cat === catId);
    });

    render();
  }

  // ── full render ───────────────────────────────────────────
  function render() {
    renderGrid();
    renderDetail();
  }

  // ── init ──────────────────────────────────────────────────
  function init(userId) {
    uid = userId;

    // รอทั้ง Money และ Stash พร้อมแล้วค่อย render
    let moneyReady = false;
    let stashReady = false;
    function tryRender() { if (moneyReady && stashReady) render(); }
    Money.onReady(() => { moneyReady = true; tryRender(); });
    Stash.onReady(() => { stashReady = true; tryRender(); });

    // build category tabs
    const tabBar = document.getElementById('shop-cat-bar');
    if (tabBar) {
      tabBar.innerHTML = Object.entries(CAT_MAP).map(([id, cfg]) => `
        <button class="wz-cat-btn ${id === currentCat ? 'active' : ''}"
                data-cat="${id}"
                onclick="Shop.switchCat('${id}')">
          <span class="wz-cat-icon">${cfg.label}</span>
          <span class="wz-cat-name">${cfg.name}</span>
        </button>`).join('');
    }
  }

  return {
    init, render, buy, selectItem, setQty, setQtyDirect, openQtyPopup, switchCat,
    getSupplyQty: (id) => Stash.getQty(id),
    consumeSupply(id) {
      return Stash.spend(id, 1);
    },
    getUid: () => uid,
  };
})();

window.Shop = Shop;
