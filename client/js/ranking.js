// ===== RANKING.JS =====
// Leaderboard 5 หัวข้อ — ดึงข้อมูลจาก Firebase Realtime DB
// path: /users/{uid}/ → { displayName, reputation, money, kills, deaths, zombieKills }

const Ranking = (() => {
  let _fb  = null;
  let _uid = null;

  const TABS = [
    { key: 'reputation',  label: '🏅 ชื่อเสียง',      field: 'reputation',  fmt: null   },
    { key: 'money',       label: '💵 เงิน',            field: 'money',       fmt: v => v.toLocaleString() },
    { key: 'kills',       label: '🔫 สังหาร',          field: 'kills',       fmt: v => v         },
    { key: 'deaths',      label: '💀 ตาย',             field: 'deaths',      fmt: v => v         },
    { key: 'zombieKills', label: '🧟 ซอมบี้/บอส',     field: 'zombieKills', fmt: v => v         },
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

    rows.sort((a, b) => b.value - a.value);
    const result = rows.slice(0, 20).map((r, i) => ({ rank: i + 1, ...r }));
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

  async function _renderList() {
    const listEl = document.getElementById('ranking-list');
    if (!listEl) return;
    if (_loading) return;
    _loading = true;
    listEl.innerHTML = '<div class="ranking-loading">⏳ กำลังโหลด...</div>';

    try {
      const tab  = TABS.find(t => t.key === _activeTab);
      const rows = await _fetchTab(_activeTab);

      if (rows.length === 0) {
        listEl.innerHTML = '<div class="ranking-empty">ยังไม่มีข้อมูล</div>';
        _loading = false; return;
      }

      listEl.innerHTML = rows.map(r => {
        const isMe    = r.uid === _uid;
        const medal   = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : `#${r.rank}`;

        let valFmt;
        if (_activeTab === 'reputation') {
          const rep  = r.value;
          const sign = rep >= 0 ? '+' : '';
          // หา tier จาก REPUTATION_CONFIG
          let tierHtml = '';
          if (typeof REPUTATION_CONFIG !== 'undefined') {
            const tier = REPUTATION_CONFIG.TIERS.find(t => rep >= t.min && rep <= t.max);
            if (tier && tier.img) {
              tierHtml = `<img src="assets/reputations/${tier.img}" style="width:18px;height:18px;object-fit:contain;vertical-align:middle;margin-right:4px;">`;
            }
            const tierLabel = (tier && tier.label) ? `<span style="font-size:10px;opacity:0.7;margin-right:4px;">${tier.label}</span>` : '';
            valFmt = `${tierHtml}${tierLabel}<span>${sign}${rep}</span>`;
          } else {
            valFmt = `${sign}${rep}`;
          }
        } else {
          valFmt = tab.fmt(r.value);
        }

        return `
          <div class="rank-row${isMe ? ' rank-row-me' : ''}">
            <span class="rank-medal">${medal}</span>
            <span class="rank-name">${r.name}${isMe ? ' 👤' : ''}</span>
            <span class="rank-value" style="display:flex;align-items:center;">${valFmt}</span>
          </div>
        `;
      }).join('');
    } catch(e) {
      listEl.innerHTML = '<div class="ranking-empty">โหลดไม่ได้ ลองใหม่</div>';
      console.warn('Ranking render error:', e);
    }
    _loading = false;
  }

  return { init, render, addKill, addDeath, addZombieKill, syncProfile };
})();

window.Ranking = Ranking;
