// ===== RANKING.JS =====
// Leaderboard 5 หัวข้อ — ดึงข้อมูลจาก Firebase Realtime DB
// path: /users/{uid}/ → { displayName, reputation, money, kills, deaths, zombieKills }

const Ranking = (() => {
  let _fb  = null;
  let _uid = null;

  const TABS = [
    { key: 'reputation',  label: '🏅 ชื่อเสียง',      field: 'reputation',  fmt: null   },
    { key: 'money',       label: '💵 เงิน',            field: 'money',       fmt: v => v.toLocaleString() },
    { key: 'kills',       label: '🔫 สังหาร',          field: 'kills',       fmt: v => v.toLocaleString() },
    { key: 'deaths',      label: '💀 ตาย',             field: 'deaths',      fmt: v => v.toLocaleString() },
    { key: 'zombieKills', label: '🧟 ซอมบี้/บอส',     field: 'zombieKills', fmt: v => v.toLocaleString() },
  ];

  let _activeTab = 'reputation';
  let _cache = {};       // { tabKey: [ {rank, name, value} ] }
  let _loading = false;

  // ── init (เรียกจาก auth.js) ──────────────────────────────
  function init(uid, fb) {
    _uid = uid;
    _fb  = fb;
  }

  // ── บันทึก stat ลง Firebase ──────────────────────────────
  async function _incrementStat(field, delta = 1) {
    if (!_fb || !_uid) return;
    const r = _fb.ref(_fb.db, `users/${_uid}/stats/${field}`);
    try {
      const snap = await _fb.get(r);
      const cur  = (snap.exists() ? (snap.val() || 0) : 0);
      await _fb.set(r, cur + delta);
    } catch(e) { console.warn('Ranking._incrementStat:', e); }
  }

  function addKill()        { _incrementStat('kills'); }
  function addDeath()       { _incrementStat('deaths'); }
  function addZombieKill()  { _incrementStat('zombieKills'); }

  // sync ชื่อ + rep + money จากระบบอื่น (เรียกจาก lobby หรือหลัง earn)
  async function syncProfile() {
    if (!_fb || !_uid) return;
    try {
      const nameEl = document.getElementById('display-name');
      const name   = nameEl ? nameEl.textContent : 'Unknown';
      const repObj = (typeof Reputation !== 'undefined') ? Reputation.get() : { rep: 0 };
      const rep    = (repObj && typeof repObj.rep === 'number') ? repObj.rep : 0;
      const money  = (typeof Money !== 'undefined') ? (Money.get().money || 0) : 0;
      const r      = _fb.ref(_fb.db, `users/${_uid}/profile`);
      await _fb.set(r, { displayName: name, reputation: rep, money });
    } catch(e) { console.warn('Ranking.syncProfile:', e); }
  }

  // ── ดึง leaderboard top 20 ────────────────────────────────
  async function _fetchTab(tabKey) {
    if (_cache[tabKey]) return _cache[tabKey];
    const tab = TABS.find(t => t.key === tabKey);
    if (!tab || !_fb) return [];

    // ดึง users ทั้งหมด แล้วเรียงฝั่ง client (Realtime DB ไม่มี collectionGroup)
    const snap = await _fb.get(_fb.ref(_fb.db, 'users'));
    if (!snap.exists()) return [];

    const rows = [];
    snap.forEach(child => {
      const d = child.val() || {};
      const profile = d.profile || {};
      const stats   = d.stats   || {};
      let value = 0;
      if (tabKey === 'reputation') {
        const raw = profile.reputation;
        // รองรับทั้งแบบ number และ object เก่า { rep: N }
        value = (raw && typeof raw === 'object') ? (raw.rep || 0) : (raw || 0);
      } else if (tabKey === 'money') value = profile.money || 0;
      else                           value = stats[tabKey] || 0;
      rows.push({ uid: child.key, name: profile.displayName || 'Unknown', value });
    });

    let result;
    if (tabKey === 'reputation') {
      // แบ่งเป็น 2 ฝั่ง: + มากสุด (top 10) และ - น้อยสุด (top 10)
      const pos = rows.filter(r => r.value >= 0).sort((a, b) => b.value - a.value).slice(0, 10);
      const neg = rows.filter(r => r.value < 0).sort((a, b) => a.value - b.value).slice(0, 10);
      const posRanked = pos.map((r, i) => ({ rank: i + 1, side: 'pos', ...r }));
      const negRanked = neg.map((r, i) => ({ rank: i + 1, side: 'neg', ...r }));
      result = { pos: posRanked, neg: negRanked };
    } else {
      rows.sort((a, b) => b.value - a.value);
      result = rows.slice(0, 20).map((r, i) => ({ rank: i + 1, ...r }));
    }
    _cache[tabKey] = result;
    return result;
  }

  // ── render panel ──────────────────────────────────────────
  async function render() {
    const panel = document.getElementById('panel-ranking');
    if (!panel) return;

    // ถ้า Firebase ยังไม่พร้อม (auth module โหลดช้า) → แสดง loading แล้วรอ
    if (!_fb || !_uid) {
      panel.innerHTML = `<div class="ranking-wrap"><div class="ranking-loading">⏳ กำลังเชื่อมต่อ...</div></div>`;
      let waited = 0;
      const check = setInterval(() => {
        waited += 200;
        if (_fb && _uid) { clearInterval(check); render(); }
        else if (waited > 8000) { clearInterval(check); panel.innerHTML = `<div class="ranking-wrap"><div class="ranking-empty">เชื่อมต่อไม่ได้ ลอง refresh</div></div>`; }
      }, 200);
      return;
    }

    // header
    panel.innerHTML = `
      <div class="ranking-wrap">
        <div class="ranking-title">🏆 จัดอันดับ</div>
        <div class="ranking-tabs">
          ${TABS.map(t => `
            <button class="rank-tab-btn${t.key === _activeTab ? ' active' : ''}" data-tab="${t.key}">
              ${t.label}
            </button>
          `).join('')}
        </div>
        <div class="ranking-list" id="ranking-list">
          <div class="ranking-loading">⏳ กำลังโหลด...</div>
        </div>
        <button class="ranking-refresh-btn" id="btn-ranking-refresh">🔄 รีเฟรช</button>
      </div>
    `;

    panel.querySelectorAll('.rank-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _activeTab = btn.dataset.tab;
        _renderList();
        panel.querySelectorAll('.rank-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
      });
    });

    document.getElementById('btn-ranking-refresh').addEventListener('click', () => {
      _cache = {};
      _renderList();
    });

    _renderList();
  }

  // ── build row HTML สำหรับ reputation ────────────────────
  function _repRowHtml(r) {
    const isMe  = r.uid === _uid;
    const medal = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : `#${r.rank}`;
    const rep   = r.value;
    const sign  = rep >= 0 ? '+' : '';
    let valFmt  = `${sign}${rep}`;
    if (typeof REPUTATION_CONFIG !== 'undefined') {
      const tier      = REPUTATION_CONFIG.TIERS.find(t => rep >= t.min && rep <= t.max);
      const tierHtml  = (tier && tier.img)   ? `<img src="assets/reputations/${tier.img}" class="rank-tier-img">` : '';
      const tierLabel = (tier && tier.label) ? `<span class="rank-tier-label">${tier.label}</span>` : '';
      valFmt = `${tierHtml}${tierLabel}<span>${sign}${rep.toLocaleString()}</span>`;
    }
    return `
      <div class="rank-row${isMe ? ' rank-row-me' : ''}">
        <span class="rank-medal">${medal}</span>
        <span class="rank-name">${r.name}${isMe ? ' 👤' : ''}</span>
        <span class="rank-value">${valFmt}</span>
      </div>`;
  }

  async function _renderList() {
    const listEl = document.getElementById('ranking-list');
    if (!listEl) return;
    if (_loading) return;
    _loading = true;
    listEl.innerHTML = '<div class="ranking-loading">⏳ กำลังโหลด...</div>';

    try {
      const tab  = TABS.find(t => t.key === _activeTab);
      const data = await _fetchTab(_activeTab);

      if (_activeTab === 'reputation') {
        // ── layout 2 คอลัมน์ ซ้าย(+) / ขวา(-) ──────────────
        const { pos, neg } = data;
        if (pos.length === 0 && neg.length === 0) {
          listEl.innerHTML = '<div class="ranking-empty">ยังไม่มีข้อมูล</div>';
          _loading = false; return;
        }

        listEl.innerHTML = `
          <div class="rep-split">
            <div class="rep-col rep-col-pos">
              <div class="rep-col-header">
                <span class="rep-col-icon">▲</span> ชื่อเสียง +
              </div>
              <div class="rep-col-list">
                ${pos.length > 0
                  ? pos.map(_repRowHtml).join('')
                  : '<div class="ranking-empty">ยังไม่มีข้อมูล</div>'
                }
              </div>
            </div>
            <div class="rep-divider"></div>
            <div class="rep-col rep-col-neg">
              <div class="rep-col-header">
                <span class="rep-col-icon">▼</span> ชื่อเสียง −
              </div>
              <div class="rep-col-list">
                ${neg.length > 0
                  ? neg.map(_repRowHtml).join('')
                  : '<div class="ranking-empty">ยังไม่มีข้อมูล</div>'
                }
              </div>
            </div>
          </div>
        `;

      } else {
        // tabs อื่นๆ — array ปกติ
        if (data.length === 0) {
          listEl.innerHTML = '<div class="ranking-empty">ยังไม่มีข้อมูล</div>';
          _loading = false; return;
        }

        listEl.innerHTML = data.map(r => {
          const isMe   = r.uid === _uid;
          const medal  = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : `#${r.rank}`;
          const valFmt = tab.fmt(r.value);
          return `
            <div class="rank-row${isMe ? ' rank-row-me' : ''}">
              <span class="rank-medal">${medal}</span>
              <span class="rank-name">${r.name}${isMe ? ' 👤' : ''}</span>
              <span class="rank-value">${valFmt}</span>
            </div>`;
        }).join('');
      }
    } catch(e) {
      listEl.innerHTML = '<div class="ranking-empty">โหลดไม่ได้ ลองใหม่</div>';
      console.warn('Ranking render error:', e);
    }
    _loading = false;
  }

  return { init, render, addKill, addDeath, addZombieKill, syncProfile };
})();

window.Ranking = Ranking;
