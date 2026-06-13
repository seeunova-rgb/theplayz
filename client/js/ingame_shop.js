// ===== INGAME_SHOP.JS =====
// ร้านค้าในเกม (เฉพาะ Premium) — ซื้อแล้วเข้า Backpack ทันที
// depends on: config_shop.js, items.js, money.js, backpack.js, premium.js

const InGameShop = (() => {

  let _open        = false;
  let _currentCat  = 'gun';
  let _selectedItem = null;
  let _buyQty      = 1;
  const MAX_QTY    = 9999;

  const CAT_MAP = {
    gun:    { label: '🔫', name: 'ปืน'     },
    body:   { label: '👕', name: 'ตัว'     },
    head:   { label: '⛑️', name: 'หัว'     },
    med:    { label: '🩹', name: 'ยา'      },
    supply: { label: '🧪', name: 'ซัพพลาย' },
  };

  const CAT_KEY_MAP = {
    gun: 'weapon', body: 'armor', head: 'helmet', med: 'med', supply: 'supply',
  };

  // ── helpers ───────────────────────────────────────────────
  function _getItems(catId) {
    return (SHOP_ITEMS[CAT_KEY_MAP[catId]] || []).filter(i => _getPrice(i) > 0);
  }

  function _getPrice(item) {
    return typeof item.price === 'function' ? item.price() : item.price;
  }

  // ── buy → Backpack ────────────────────────────────────────
  function buy() {
    if (!_selectedItem) return;
    const item  = _selectedItem;
    const price = _getPrice(item) * _buyQty;

    // ตัดเงิน
    const ok = Money.spend(item.currency, price);
    if (!ok) {
      window.showToast(item.currency === 'money' ? 'เงินไม่พอ!' : 'Point ไม่พอ!', 'error');
      return;
    }

    // เพิ่มเข้า Backpack — ถ้าของ stack เข้า EQUIP ได้ (เช่น ยา) และตรงกับที่สวมอยู่ → รวมเข้า EQUIP เลย
    const result = Backpack.addItemBuy(item.id, _buyQty);
    if (result === 'full') {
      // คืนเงิน
      Money.earn(item.currency, price);
      window.showToast('กระเป๋าเต็ม!', 'error');
      return;
    }
    if (typeof Backpack.render === 'function') Backpack.render();

    const qty = _buyQty;
    _buyQty = 1;
    window.showToast(`ซื้อ ${item.name} ×${qty} เข้ากระเป๋า ✓`, 'success');
    renderWallet();
    renderDetail();
  }

  // ── qty ───────────────────────────────────────────────────
  function setQty(delta) {
    _buyQty = Math.min(MAX_QTY, Math.max(1, _buyQty + delta));
    renderDetail();
  }

  function setQtyDirect(val) {
    const n = parseInt(val, 10);
    _buyQty = isNaN(n) || n < 1 ? 1 : Math.min(MAX_QTY, n);
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
        <div class="bp-qty-avail">ซื้อ <b>${_selectedItem?.name || ''}</b></div>
        <div class="bp-qty-row">
          <button class="bp-qty-btn" id="bp-qty-minus">−</button>
          <input class="bp-qty-input" id="bp-qty-val" type="number" min="1" value="${_buyQty}">
          <button class="bp-qty-btn" id="bp-qty-plus">+</button>
        </div>
        <div class="bp-qty-actions">
          <button class="bp-qty-cancel" id="bp-qty-cancel">ยกเลิก</button>
          <button class="bp-qty-confirm" id="bp-qty-ok">ยืนยัน</button>
        </div>
      </div>`;
    document.body.appendChild(pop);
    const inp = document.getElementById('bp-qty-val');
    const clamp = () => { inp.value = Math.min(MAX_QTY, Math.max(1, parseInt(inp.value) || 1)); };
    document.getElementById('bp-qty-minus').addEventListener('click', () => { inp.value = Math.max(1, (parseInt(inp.value)||1) - 1); });
    document.getElementById('bp-qty-plus').addEventListener('click',  () => { inp.value = Math.min(MAX_QTY, (parseInt(inp.value)||1) + 1); });
    inp.addEventListener('blur', clamp);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { clamp(); doConfirm(); } });
    function doConfirm() { clamp(); _buyQty = parseInt(inp.value) || 1; pop.remove(); renderDetail(); }
    function doCancel()  { pop.remove(); }
    document.getElementById('bp-qty-ok').addEventListener('click', doConfirm);
    document.getElementById('bp-qty-cancel').addEventListener('click', doCancel);
    pop.querySelector('.bp-qty-backdrop').addEventListener('click', doCancel);
  }

  // ── select ────────────────────────────────────────────────
  function selectItem(itemId) {
    const item = _getItems(_currentCat).find(i => i.id === itemId);
    if (!item) return;
    _selectedItem = item;
    _buyQty = 1;
    renderDetail();
    document.querySelectorAll('#igs-grid .igs-slot').forEach(el => {
      el.classList.toggle('selected', el.dataset.id === itemId);
    });
  }

  // ── switch cat ────────────────────────────────────────────
  function switchCat(catId) {
    _currentCat   = catId;
    _selectedItem = null;
    _buyQty       = 1;
    document.querySelectorAll('#igs-cat-bar .igs-cat-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cat === catId);
    });
    renderGrid();
    renderDetail();
  }

  // ── render grid ───────────────────────────────────────────
  function renderGrid() {
    const grid  = document.getElementById('igs-grid');
    if (!grid) return;
    const items = _getItems(_currentCat);
    if (items.length === 0) {
      grid.innerHTML = `<div class="igs-empty">ยังไม่มีไอเทม</div>`;
      return;
    }
    grid.innerHTML = items.map(item => `
      <div class="igs-slot ${_selectedItem?.id === item.id ? 'selected' : ''}"
           data-id="${item.id}"
           onclick="InGameShop.selectItem('${item.id}')">
        <div class="igs-icon">${item.icon}</div>
        <div class="igs-name">${item.name}</div>
      </div>`).join('');
  }

  // ── render detail ─────────────────────────────────────────
  function renderDetail() {
    const panel = document.getElementById('igs-detail');
    if (!panel) return;

    if (!_selectedItem) {
      panel.innerHTML = `<div class="igs-detail-empty">เลือกไอเทม</div>`;
      return;
    }

    const item       = _selectedItem;
    const unitPrice  = _getPrice(item);
    const totalPrice = unitPrice * _buyQty;
    const wallet     = Money.get();
    const canAfford  = item.currency === 'money'
      ? wallet.money >= totalPrice
      : wallet.point >= totalPrice;
    const priceIcon  = item.currency === 'money' ? '💵' : '💎';

    panel.innerHTML = `
      <div class="igs-detail-icon">${item.icon}</div>
      <div class="igs-detail-name">${item.name}</div>
      <div class="igs-qty-row">
        <button class="igs-qty-btn" onclick="InGameShop.setQty(-1)">−</button>
        <button class="igs-qty-num" onclick="InGameShop.openQtyPopup()">${_buyQty}</button>
        <button class="igs-qty-btn" onclick="InGameShop.setQty(1)">+</button>
      </div>
      <div class="igs-price ${item.currency}">${priceIcon} ${totalPrice.toLocaleString()}</div>
      <button class="igs-buy-btn ${canAfford ? item.currency : 'disabled'}"
              ${canAfford ? 'onclick="InGameShop.buy()"' : 'disabled'}>
        BUY${_buyQty > 1 ? ` ×${_buyQty}` : ''}
      </button>
      <div class="igs-hint">ของจะเข้ากระเป๋าทันที</div>`;
  }

  // ── render wallet ─────────────────────────────────────────
  function renderWallet() {
    const w = Money.get();
    const el = document.getElementById('igs-wallet');
    if (el) el.innerHTML =
      `<span class="igs-money">💵 ${(w.money||0).toLocaleString()}</span>
       <span class="igs-point">💎 ${(w.point||0).toLocaleString()}</span>`;
  }

  // ── full render ───────────────────────────────────────────
  function render() {
    renderWallet();
    renderGrid();
    renderDetail();
  }

  // ── open / close / toggle ─────────────────────────────────
  function open() {
    if (!Premium.isActive() && !Dev.isActive()) {
      window.showToast('เฉพาะสมาชิก Premium เท่านั้น 💎', 'error');
      return;
    }
    _open = true;
    const overlay = document.getElementById('ingame-shop-overlay');
    if (!overlay) return;
    render();
    overlay.style.display = 'flex';
    requestAnimationFrame(() => overlay.classList.add('visible'));
    const btn = document.getElementById('btn-ingame-shop');
    if (btn) btn.classList.add('active');
  }

  function close() {
    _open = false;
    const overlay = document.getElementById('ingame-shop-overlay');
    if (!overlay) return;
    overlay.classList.remove('visible');
    setTimeout(() => { overlay.style.display = 'none'; }, 220);
    const btn = document.getElementById('btn-ingame-shop');
    if (btn) btn.classList.remove('active');
  }

  function toggle() {
    if (_open) close(); else open();
  }

  // ── init ──────────────────────────────────────────────────
  function init() {
    // build cat bar
    const catBar = document.getElementById('igs-cat-bar');
    if (catBar) {
      catBar.innerHTML = Object.entries(CAT_MAP).map(([id, cfg]) => `
        <button class="igs-cat-btn ${id === _currentCat ? 'active' : ''}"
                data-cat="${id}"
                onclick="InGameShop.switchCat('${id}')">
          <span>${cfg.label}</span>
          <span>${cfg.name}</span>
        </button>`).join('');
    }

    // close on backdrop click
    const overlay = document.getElementById('ingame-shop-overlay');
    if (overlay) {
      overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    }

    // keyboard
    window.addEventListener('keydown', e => {
      if (e.key && e.key.toLowerCase() === 'p') toggle();
      if (e.key === 'Escape' && _open) close();
    });
  }

  return { init, open, close, toggle, buy, setQty, setQtyDirect, openQtyPopup, selectItem, switchCat, render };
})();

window.InGameShop = InGameShop;
