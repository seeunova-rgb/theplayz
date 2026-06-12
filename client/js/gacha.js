// ===== GACHA.JS =====
// ระบบกาชาสุ่มกล่องสไตล์ CSGO
// depends on: config_gacha.js, money.js, stash.js

const Gacha = (() => {

  let _currentSpinCount = 1;

  // ── สุ่มจำนวน qty จาก range (ถ้ามี minQty/maxQty) ──────────
  function _resolveQty(entry) {
    if (entry.minQty != null && entry.maxQty != null) {
      return Math.floor(Math.random() * (entry.maxQty - entry.minQty + 1)) + entry.minQty;
    }
    return entry.qty ?? 1;
  }

  // ── สุ่มของจาก pool ───────────────────────────────────────
  function _roll(pool) {
    const total = pool.reduce((s, r) => s + r.chance, 0);
    let rand = Math.random() * total;
    for (const r of pool) {
      rand -= r.chance;
      if (rand <= 0) {
        // คืน copy พร้อม qty ที่สุ่มแล้ว
        return { ...r, qty: _resolveQty(r) };
      }
    }
    const last = pool[pool.length - 1];
    return { ...last, qty: _resolveQty(last) };
  }

  // ── สร้าง spin strip ──────────────────────────────────────
  const STRIP_COUNT = 40;
  const RESULT_IDX  = 34;

  function _buildStrip(pool, result) {
    const fakePool = pool.filter(r => r.rarity === 'grey' || r.rarity === 'blue');
    const fp = fakePool.length > 0 ? fakePool : pool;
    return Array.from({ length: STRIP_COUNT }, (_, i) =>
      i === RESULT_IDX ? result : _roll(fp)
    );
  }

  // ── icon ──────────────────────────────────────────────────
  const ITEM_ICONS = {
    asr_reddevil:  '<img src="assets/items/asr_reddevil.png"  style="width:36px;height:36px;object-fit:contain;">',
    snp_reddevil:  '<img src="assets/items/snp_reddevil.png"  style="width:36px;height:36px;object-fit:contain;">',
    body_reddevil: '<img src="assets/items/body_reddevil.png" style="width:36px;height:36px;object-fit:contain;">',
    head_reddevil: '<img src="assets/items/head_reddevil.png" style="width:36px;height:36px;object-fit:contain;">',
    asr_evil:      '<img src="assets/items/asr_evil.png"      style="width:36px;height:36px;object-fit:contain;">',
    snp_evil:      '<img src="assets/items/snp_evil.png"      style="width:36px;height:36px;object-fit:contain;">',
    body_evil:     '<img src="assets/items/body_evil.png"     style="width:36px;height:36px;object-fit:contain;">',
    head_evil:     '<img src="assets/items/head_evil.png"     style="width:36px;height:36px;object-fit:contain;">',
    asr_piggy:     '<img src="assets/items/asr_piggy.png"     style="width:36px;height:36px;object-fit:contain;">',
    snp_piggy:     '<img src="assets/items/snp_piggy.png"     style="width:36px;height:36px;object-fit:contain;">',
    body_piggy:    '<img src="assets/items/body_piggy.png"    style="width:36px;height:36px;object-fit:contain;">',
    head_piggy:    '<img src="assets/items/head_piggy.png"    style="width:36px;height:36px;object-fit:contain;">',
    snp_ppap:      '<img src="assets/items/snp_ppap.png"      style="width:36px;height:36px;object-fit:contain;">',
    body_ppap:     '<img src="assets/items/body_ppap.png"     style="width:36px;height:36px;object-fit:contain;">',
    head_ppap:     '<img src="assets/items/head_ppap.png"     style="width:36px;height:36px;object-fit:contain;">',
    bandage:       '<img src="assets/items/bandage.png"       style="width:30px;height:30px;object-fit:contain;">',
    ammo_box:      '<span style="font-size:26px;line-height:1;">📦</span>',
  };
  function _icon(itemId, size = 'sm') {
    if (size === 'lg') {
      return (ITEM_ICONS[itemId] || '❓').replace(/\d+px/g, m => (parseInt(m) * 1.4 | 0) + 'px');
    }
    return ITEM_ICONS[itemId] || '❓';
  }

  function _itemName(itemId) {
    return {
      asr_reddevil:'ASR RED DEVIL', snp_reddevil:'SNP RED DEVIL',
      body_reddevil:'BODY RED DEVIL', head_reddevil:'HEAD RED DEVIL',
      asr_evil:'ASR EVIL', snp_evil:'SNP EVIL',
      body_evil:'BODY EVIL', head_evil:'HEAD EVIL',
      asr_piggy:'ASR PIGGY', snp_piggy:'SNP PIGGY',
      body_piggy:'BODY PIGGY', head_piggy:'HEAD PIGGY',
      snp_ppap:'SNP PPAP', body_ppap:'BODY PPAP', head_ppap:'HEAD PPAP',
      bandage:'BANDAGE', ammo_box:'AMMO BOX',
    }[itemId] || itemId;
  }

  // ── render panel ──────────────────────────────────────────
  function render() {
    const panel = document.getElementById('panel-gacha');
    if (!panel) return;

    panel.innerHTML = `
      <div class="gacha-layout">
        <div class="gacha-topbar">
          <span class="gacha-title">🎰 GACHA</span>
          <div class="gacha-currency">
            <span class="gc-label">💎</span>
            <span class="gc-val" id="gacha-point-val">-</span>
          </div>
        </div>
        <div class="gacha-cards" id="gacha-cards"></div>

        <!-- Single spin overlay (strip animation) -->
        <div class="gacha-spin-overlay" id="gacha-spin-overlay" style="display:none;">
          <div class="gacha-spin-box">
            <div class="gacha-spin-marker"></div>
            <div class="gacha-spin-window">
              <div class="gacha-strip" id="gacha-strip"></div>
            </div>
            <div class="gacha-spin-result" id="gacha-spin-result" style="display:none;"></div>
          </div>
          <button class="gacha-close-btn" id="gacha-close-btn" style="display:none;">✕ ปิด</button>
        </div>

        <!-- Multi spin overlay (circle loader + popup) -->
        <div class="gacha-multi-overlay" id="gacha-multi-overlay" style="display:none;">
          <!-- Loading circle -->
          <div class="gacha-loader-wrap" id="gacha-loader-wrap">
            <svg class="gacha-ring" viewBox="0 0 120 120">
              <circle class="gacha-ring-bg" cx="60" cy="60" r="52"/>
              <circle class="gacha-ring-fill" id="gacha-ring-fill" cx="60" cy="60" r="52"
                stroke-dasharray="327" stroke-dashoffset="327"/>
            </svg>
            <div class="gacha-ring-pct" id="gacha-ring-pct">0%</div>
          </div>
          <!-- Result popup -->
          <div class="gacha-multi-popup" id="gacha-multi-popup" style="display:none;">
            <div class="gacha-popup-title">🎁 ไอเทมที่ได้รับ</div>
            <div class="gacha-popup-grid" id="gacha-popup-grid"></div>
            <button class="gacha-close-btn" id="gacha-multi-close-btn">✕ ปิด</button>
          </div>
        </div>
      </div>
    `;

    _renderCards();
    _syncCurrency();
    document.getElementById('gacha-close-btn').addEventListener('click', _closeOverlay);
    document.getElementById('gacha-multi-close-btn').addEventListener('click', _closeMultiOverlay);
  }

  // ── render การ์ด ──────────────────────────────────────────
  // spin counts: ×1 ใช้ strip animation, อื่นๆ ใช้ circle loader
  const SPIN_COUNTS = [1, 5, 10, 50, 100, 500, 1000];

  function _renderCards() {
    const container = document.getElementById('gacha-cards');
    if (!container) return;

    container.innerHTML = GACHA_CONFIG.map(g => `
      <div class="gacha-card" id="gacha-card-${g.id}">

        <div class="gacha-card-header" style="border-color:${g.color};">
          <img src="${g.icon}" class="gacha-card-icon">
          <div class="gacha-card-name">${g.name}</div>
        </div>

        <div class="gacha-pool-preview">
          ${g.pool.map(r => {
            const rar = GACHA_RARITY[r.rarity];
            const qtyLabel = (r.minQty != null && r.maxQty != null)
              ? r.minQty + '–' + r.maxQty
              : (r.qty > 1 ? '×' + r.qty : '');
            return `<div class="gacha-pool-item" style="border-color:${rar.color};box-shadow:0 0 5px ${rar.glow};">
              <div class="gacha-pool-icon">${_icon(r.itemId)}</div>
              ${qtyLabel ? `<div class="gacha-pool-qty">${qtyLabel}</div>` : ''}
            </div>`;
          }).join('')}
        </div>

        <div class="gacha-card-footer">
          <div class="gacha-spin-count-row">
            ${SPIN_COUNTS.map(n => `
              <button class="gacha-count-btn${n===1?' active':''}" data-count="${n}" data-gid="${g.id}">×${n}</button>
            `).join('')}
          </div>
          <div class="gacha-footer-right">
            <div class="gacha-price" id="gacha-price-${g.id}">${g.currency==='money'?'💵':'💎'} ${g.price} / ครั้ง</div>
            <button class="gacha-spin-btn" data-id="${g.id}" data-count="1">🎰 SPIN</button>
          </div>
        </div>

      </div>
    `).join('');

    // bind count buttons
    container.querySelectorAll('.gacha-count-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const gid = btn.dataset.gid;
        const count = parseInt(btn.dataset.count);
        const cfg = GACHA_CONFIG.find(g => g.id === gid);
        if (!cfg) return;

        container.querySelectorAll(`.gacha-count-btn[data-gid="${gid}"]`).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const priceEl = document.getElementById(`gacha-price-${gid}`);
        if (priceEl) priceEl.textContent = `${cfg.currency==='money'?'💵':'💎'} ${cfg.price * count} (×${count})`;
        const spinBtn = container.querySelector(`.gacha-spin-btn[data-id="${gid}"]`);
        if (spinBtn) spinBtn.dataset.count = count;
      });
    });

    // bind spin buttons
    container.querySelectorAll('.gacha-spin-btn').forEach(btn => {
      btn.addEventListener('click', () => _startSpin(btn.dataset.id, parseInt(btn.dataset.count) || 1));
    });
  }

  // ── sync currency ─────────────────────────────────────────
  function _syncCurrency() {
    const el = document.getElementById('gacha-point-val');
    if (!el) return;
    const w = (typeof Money !== 'undefined') ? Money.get() : { point: 0 };
    el.textContent = w.point ?? 0;
  }

  // ── START SPIN ────────────────────────────────────────────
  function _startSpin(gachaId, count = 1) {
    const cfg = GACHA_CONFIG.find(g => g.id === gachaId);
    if (!cfg) return;

    const totalCost = cfg.price * count;

    if (typeof Money !== 'undefined') {
      const ok = Money.spend(cfg.currency, totalCost);
      if (!ok) { _showToast(cfg.currency === 'money' ? '💵 Money ไม่พอ!' : '💎 Point ไม่พอ!'); return; }
      _syncCurrency();
    }

    // สุ่มผลทั้งหมด
    const results = Array.from({ length: count }, () => _roll(cfg.pool));

    if (count === 1) {
      // ── Single: strip animation ────────────────────────────
      const lastResult = results[0];
      const strip = _buildStrip(cfg.pool, lastResult);

      const overlay  = document.getElementById('gacha-spin-overlay');
      const stripEl  = document.getElementById('gacha-strip');
      const resultEl = document.getElementById('gacha-spin-result');
      const closeBtn = document.getElementById('gacha-close-btn');

      overlay.style.display = 'flex';
      resultEl.style.display = 'none';
      closeBtn.style.display = 'none';

      const ITEM_W = 68;
      stripEl.innerHTML = strip.map(r => {
        const rar = GACHA_RARITY[r.rarity];
        return `<div class="gacha-strip-item" style="border-color:${rar.color};box-shadow:0 0 7px ${rar.glow};">
          <div class="gacha-strip-icon">${_icon(r.itemId)}</div>
          ${r.qty > 1 ? `<div class="gacha-strip-qty">×${r.qty}</div>` : ''}
        </div>`;
      }).join('');

      const windowW   = document.querySelector('.gacha-spin-window')?.offsetWidth || 360;
      const centerOff = Math.floor(windowW / 2) - Math.floor(ITEM_W / 2);
      const targetX   = RESULT_IDX * ITEM_W - centerOff;

      stripEl.style.transition = 'none';
      stripEl.style.transform  = 'translateX(0px)';

      requestAnimationFrame(() => requestAnimationFrame(() => {
        const jitter = Math.floor(Math.random() * 24) - 12;
        stripEl.style.transition = 'transform 3.8s cubic-bezier(0.12, 0.8, 0.2, 1)';
        stripEl.style.transform  = `translateX(-${targetX + jitter}px)`;
      }));

      setTimeout(() => {
        if (typeof Stash !== 'undefined') {
          results.forEach(r => Stash.add(r.itemId, r.qty));
        }
        _showResult(results, resultEl, closeBtn);
      }, 4000);

    } else {
      // ── Multi: circle loader ───────────────────────────────
      const overlay   = document.getElementById('gacha-multi-overlay');
      const loaderWrap = document.getElementById('gacha-loader-wrap');
      const popup     = document.getElementById('gacha-multi-popup');
      const ringFill  = document.getElementById('gacha-ring-fill');
      const ringPct   = document.getElementById('gacha-ring-pct');

      overlay.style.display = 'flex';
      loaderWrap.style.display = 'flex';
      popup.style.display = 'none';

      // Animate circle: 0% → 100% over ~1.5s (fast but visible)
      const CIRCUMFERENCE = 327; // 2π×52
      const DURATION_MS = Math.min(1500, 800 + count * 0.5); // ไม่เกิน 1.5วิ
      const startTime = performance.now();

      function animateFill(now) {
        const elapsed = now - startTime;
        const pct = Math.min(elapsed / DURATION_MS, 1);
        const offset = CIRCUMFERENCE * (1 - pct);
        ringFill.style.strokeDashoffset = offset;
        ringPct.textContent = Math.round(pct * 100) + '%';

        if (pct < 1) {
          requestAnimationFrame(animateFill);
        } else {
          // Done loading — add to stash then show popup
          if (typeof Stash !== 'undefined') {
            results.forEach(r => Stash.add(r.itemId, r.qty));
          }
          _showMultiPopup(results, loaderWrap, popup);
        }
      }
      requestAnimationFrame(animateFill);
    }
  }

  // ── แสดง popup หลาย-spin ─────────────────────────────────
  function _showMultiPopup(results, loaderWrap, popup) {
    // นับรวม: group by itemId+rarity, สะสม totalQty และ count (รอบที่ออก)
    const summary = {};
    results.forEach(r => {
      const key = r.itemId + '|' + r.rarity;
      if (!summary[key]) summary[key] = { ...r, totalQty: 0, count: 0 };
      summary[key].totalQty += r.qty;
      summary[key].count++;
    });

    const gridEl = document.getElementById('gacha-popup-grid');
    gridEl.innerHTML = Object.values(summary).sort((a,b) => {
      const order = {gold:0,purple:1,blue:2,grey:3};
      return (order[a.rarity]||9) - (order[b.rarity]||9);
    }).map(item => {
      const rar = GACHA_RARITY[item.rarity];
      return `<div class="gacha-popup-item" style="border-color:${rar.color};box-shadow:0 0 8px ${rar.glow};">
        <div class="gacha-popup-icon">${_icon(item.itemId)}</div>
        <div class="gacha-popup-name">${_itemName(item.itemId)}</div>
        <div class="gacha-popup-count" style="color:${rar.color};">×${item.totalQty}</div>
      </div>`;
    }).join('');

    loaderWrap.style.display = 'none';
    popup.style.display = 'flex';
  }

  // ── แสดงผล single spin ────────────────────────────────────
  function _showResult(results, resultEl, closeBtn) {
    const r   = results[0];
    const rar = GACHA_RARITY[r.rarity];
    resultEl.innerHTML = `
      <div class="gacha-result-box" style="border-color:${rar.color};box-shadow:0 0 28px ${rar.glow};">
        <div class="gacha-result-icon">${_icon(r.itemId, 'lg')}</div>
        <div class="gacha-result-name">${_itemName(r.itemId)}${r.qty > 1 ? ' ×'+r.qty : ''}</div>
      </div>`;
    resultEl.style.display = 'flex';
    closeBtn.style.display = 'block';
  }

  // ── close overlays ────────────────────────────────────────
  function _closeOverlay() {
    const overlay = document.getElementById('gacha-spin-overlay');
    if (overlay) overlay.style.display = 'none';
    _syncCurrency();
  }

  function _closeMultiOverlay() {
    const overlay = document.getElementById('gacha-multi-overlay');
    if (overlay) overlay.style.display = 'none';
    _syncCurrency();
  }

  // ── toast ─────────────────────────────────────────────────
  function _showToast(msg) {
    const t = document.createElement('div');
    t.className = 'gacha-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2000);
  }

  return { render, syncCurrency: _syncCurrency };
})();

window.Gacha = Gacha;
