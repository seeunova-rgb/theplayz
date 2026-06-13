// ===== CLAN.JS =====
// ระบบแคลน — สร้าง/เข้าร่วม/ออก/เตะสมาชิก, ดึง/บันทึกข้อมูลจาก Firebase Realtime DB
// path: /clans/{clanId} = { name, tag, owner, members: { uid: true }, createdAt }
//       /users/{uid}/profile/clanId = "clanId" (หรือไม่มี = ไม่มีแคลน)

const Clan = (() => {
  let _fb  = null;
  let _uid = null;

  let _myClanId  = null;   // clanId ของเรา (null ถ้าไม่มี)
  let _myClanData = null;  // ข้อมูลแคลนของเรา (cache)
  let _allClans  = [];     // cache รายชื่อแคลนทั้งหมด (สำหรับหน้าค้นหา)
  let _loading   = false;

  const MAX_MEMBERS  = 20;
  const NAME_MIN     = 2;
  const NAME_MAX     = 16;
  const TAG_MIN      = 2;
  const TAG_MAX      = 4;

  // ── init (เรียกจาก auth.js) ──────────────────────────────
  function init(uid, fb) {
    _uid = uid;
    _fb  = fb;
  }

  function getMyClanId() { return _myClanId; }
  function getMyClanData() { return _myClanData; }

  // ── โหลด clanId ของผู้ใช้ปัจจุบัน ─────────────────────────
  async function _loadMyClanId() {
    if (!_fb || !_uid) return null;
    try {
      const snap = await _fb.get(_fb.ref(_fb.db, `users/${_uid}/profile/clanId`));
      _myClanId = snap.exists() ? snap.val() : null;
      return _myClanId;
    } catch (e) {
      console.warn('Clan._loadMyClanId:', e);
      return null;
    }
  }

  async function _loadClan(clanId) {
    if (!_fb || !clanId) return null;
    try {
      const snap = await _fb.get(_fb.ref(_fb.db, `clans/${clanId}`));
      if (!snap.exists()) return null;
      return { id: clanId, ...snap.val() };
    } catch (e) {
      console.warn('Clan._loadClan:', e);
      return null;
    }
  }

  // ── ดึงชื่อผู้เล่นจากกลุ่ม users (สำหรับแสดงสมาชิก) ───────
  async function _resolveNames(uids) {
    const names = {};
    if (!_fb || uids.length === 0) return names;
    try {
      const snap = await _fb.get(_fb.ref(_fb.db, 'users'));
      if (!snap.exists()) return names;
      snap.forEach(child => {
        if (!uids.includes(child.key)) return;
        const p = child.val()?.profile || {};
        names[child.key] = p.nickName || p.displayName || 'Unknown';
      });
    } catch (e) { console.warn('Clan._resolveNames:', e); }
    return names;
  }

  // ── validation ────────────────────────────────────────────
  function _validateName(name) {
    if (!name || name.length < NAME_MIN || name.length > NAME_MAX) {
      return `ชื่อแคลนต้องมี ${NAME_MIN}-${NAME_MAX} ตัวอักษร`;
    }
    return null;
  }
  function _validateTag(tag) {
    if (!tag || tag.length < TAG_MIN || tag.length > TAG_MAX) {
      return `แท็กแคลนต้องมี ${TAG_MIN}-${TAG_MAX} ตัวอักษร`;
    }
    if (!/^[A-Za-z0-9]+$/.test(tag)) {
      return 'แท็กแคลนต้องเป็นตัวอักษร/เลขภาษาอังกฤษเท่านั้น';
    }
    return null;
  }

  // ── สร้างแคลน ─────────────────────────────────────────────
  async function createClan(name, tag) {
    if (!_fb || !_uid) return { ok: false, error: 'ไม่พร้อมเชื่อมต่อ' };
    if (_myClanId) return { ok: false, error: 'คุณมีแคลนอยู่แล้ว' };

    const nameErr = _validateName(name);
    if (nameErr) return { ok: false, error: nameErr };
    const tagErr = _validateTag(tag);
    if (tagErr) return { ok: false, error: tagErr };

    try {
      // เช็คชื่อ/แท็กซ้ำ
      const snap = await _fb.get(_fb.ref(_fb.db, 'clans'));
      if (snap.exists()) {
        let dup = false;
        snap.forEach(child => {
          const d = child.val() || {};
          if ((d.name || '').toLowerCase() === name.toLowerCase()) dup = 'name';
          if ((d.tag  || '').toUpperCase() === tag.toUpperCase())  dup = dup || 'tag';
        });
        if (dup === 'name') return { ok: false, error: 'ชื่อแคลนนี้มีอยู่แล้ว' };
        if (dup === 'tag')  return { ok: false, error: 'แท็กแคลนนี้มีอยู่แล้ว' };
      }

      const clanId = 'clan_' + _uid.slice(0, 8) + '_' + Date.now().toString(36);
      const data = {
        name,
        tag: tag.toUpperCase(),
        owner: _uid,
        members: { [_uid]: true },
        createdAt: Date.now(),
      };
      await _fb.set(_fb.ref(_fb.db, `clans/${clanId}`), data);
      await _fb.set(_fb.ref(_fb.db, `users/${_uid}/profile/clanId`), clanId);

      _myClanId = clanId;
      _myClanData = { id: clanId, ...data };
      return { ok: true };
    } catch (e) {
      console.warn('Clan.createClan:', e);
      return { ok: false, error: 'เกิดข้อผิดพลาด' };
    }
  }

  // ── เข้าร่วมแคลน ──────────────────────────────────────────
  async function joinClan(clanId) {
    if (!_fb || !_uid) return { ok: false, error: 'ไม่พร้อมเชื่อมต่อ' };
    if (_myClanId) return { ok: false, error: 'คุณมีแคลนอยู่แล้ว' };

    try {
      const clan = await _loadClan(clanId);
      if (!clan) return { ok: false, error: 'ไม่พบแคลนนี้' };

      const memberCount = Object.keys(clan.members || {}).length;
      if (memberCount >= MAX_MEMBERS) return { ok: false, error: 'แคลนนี้สมาชิกครบแล้ว' };

      await _fb.update(_fb.ref(_fb.db, `clans/${clanId}/members`), { [_uid]: true });
      await _fb.set(_fb.ref(_fb.db, `users/${_uid}/profile/clanId`), clanId);

      _myClanId = clanId;
      return { ok: true };
    } catch (e) {
      console.warn('Clan.joinClan:', e);
      return { ok: false, error: 'เกิดข้อผิดพลาด' };
    }
  }

  // ── ออกจากแคลน ────────────────────────────────────────────
  async function leaveClan() {
    if (!_fb || !_uid || !_myClanId) return { ok: false, error: 'ไม่มีแคลน' };

    try {
      const clan = await _loadClan(_myClanId);
      if (!clan) {
        // แคลนถูกลบไปแล้ว — เคลียร์ profile ทิ้ง
        await _fb.set(_fb.ref(_fb.db, `users/${_uid}/profile/clanId`), null);
        _myClanId = null; _myClanData = null;
        return { ok: true };
      }

      const members = clan.members || {};
      const memberIds = Object.keys(members);

      if (clan.owner === _uid) {
        if (memberIds.length <= 1) {
          // หัวหน้าคนสุดท้าย → ลบแคลนทั้งกลุ่ม
          await _fb.set(_fb.ref(_fb.db, `clans/${_myClanId}`), null);
        } else {
          // โอนหัวหน้าให้สมาชิกคนแรกที่เจอ (ไม่ใช่ตัวเอง)
          const newOwner = memberIds.find(id => id !== _uid);
          await _fb.update(_fb.ref(_fb.db, `clans/${_myClanId}`), { owner: newOwner });
          await _fb.set(_fb.ref(_fb.db, `clans/${_myClanId}/members/${_uid}`), null);
        }
      } else {
        await _fb.set(_fb.ref(_fb.db, `clans/${_myClanId}/members/${_uid}`), null);
      }

      await _fb.set(_fb.ref(_fb.db, `users/${_uid}/profile/clanId`), null);
      _myClanId = null; _myClanData = null;
      return { ok: true };
    } catch (e) {
      console.warn('Clan.leaveClan:', e);
      return { ok: false, error: 'เกิดข้อผิดพลาด' };
    }
  }

  // ── เตะสมาชิก (หัวหน้าเท่านั้น) ──────────────────────────
  async function kickMember(targetUid) {
    if (!_fb || !_uid || !_myClanId) return { ok: false, error: 'ไม่มีแคลน' };
    if (!_myClanData || _myClanData.owner !== _uid) return { ok: false, error: 'เฉพาะหัวหน้าแคลน' };
    if (targetUid === _uid) return { ok: false, error: 'ไม่สามารถเตะตัวเองได้' };

    try {
      await _fb.set(_fb.ref(_fb.db, `clans/${_myClanId}/members/${targetUid}`), null);
      await _fb.set(_fb.ref(_fb.db, `users/${targetUid}/profile/clanId`), null);
      return { ok: true };
    } catch (e) {
      console.warn('Clan.kickMember:', e);
      return { ok: false, error: 'เกิดข้อผิดพลาด' };
    }
  }

  // ── ดึงรายชื่อแคลนทั้งหมด (สำหรับค้นหา/เข้าร่วม) ─────────
  async function _fetchAllClans() {
    if (!_fb) return [];
    try {
      const snap = await _fb.get(_fb.ref(_fb.db, 'clans'));
      if (!snap.exists()) return [];
      const rows = [];
      snap.forEach(child => {
        const d = child.val() || {};
        rows.push({
          id: child.key,
          name: d.name,
          tag: d.tag,
          owner: d.owner,
          memberCount: Object.keys(d.members || {}).length,
          createdAt: d.createdAt || 0,
        });
      });
      rows.sort((a, b) => b.memberCount - a.memberCount || b.createdAt - a.createdAt);
      return rows;
    } catch (e) {
      console.warn('Clan._fetchAllClans:', e);
      return [];
    }
  }

  // ── render panel ──────────────────────────────────────────
  async function render() {
    const panel = document.getElementById('panel-clan');
    if (!panel) return;

    if (!_fb || !_uid) {
      panel.innerHTML = `<div class="clan-wrap"><div class="ranking-loading">⏳ กำลังเชื่อมต่อ...</div></div>`;
      let waited = 0;
      const check = setInterval(() => {
        waited += 200;
        if (_fb && _uid) { clearInterval(check); render(); }
        else if (waited > 8000) { clearInterval(check); panel.innerHTML = `<div class="clan-wrap"><div class="ranking-empty">เชื่อมต่อไม่ได้ ลอง refresh</div></div>`; }
      }, 200);
      return;
    }

    if (_loading) return;
    _loading = true;
    panel.innerHTML = `<div class="clan-wrap"><div class="ranking-loading">⏳ กำลังโหลด...</div></div>`;

    try {
      await _loadMyClanId();
      _myClanData = _myClanId ? await _loadClan(_myClanId) : null;

      if (_myClanData) {
        await _renderMyClan(panel);
      } else {
        await _renderBrowse(panel);
      }
    } catch (e) {
      console.warn('Clan.render:', e);
      panel.innerHTML = `<div class="clan-wrap"><div class="ranking-empty">โหลดไม่ได้ ลองใหม่</div></div>`;
    }
    _loading = false;
  }

  // ── หน้า: ฉันมีแคลนอยู่แล้ว → แสดงสมาชิก ────────────────
  async function _renderMyClan(panel) {
    const clan = _myClanData;
    const memberIds = Object.keys(clan.members || {});
    const names = await _resolveNames(memberIds);
    const isOwner = clan.owner === _uid;

    // เรียงให้หัวหน้าอยู่บนสุด
    memberIds.sort((a, b) => (a === clan.owner ? -1 : b === clan.owner ? 1 : 0));

    panel.innerHTML = `
      <div class="clan-wrap">
        <div class="clan-header">
          <div class="clan-header-info">
            <div class="clan-name">[${clan.tag}] ${clan.name}</div>
            <div class="clan-meta">${memberIds.length} / ${MAX_MEMBERS} สมาชิก</div>
          </div>
          <button class="clan-leave-btn" id="clan-leave-btn">${isOwner && memberIds.length > 1 ? '🚪 ออก (โอนหัวหน้า)' : '🚪 ออกจากแคลน'}</button>
        </div>
        <div class="clan-members-title">สมาชิก</div>
        <div class="clan-members-list">
          ${memberIds.map(uid => {
            const isMe    = uid === _uid;
            const isOwn   = uid === clan.owner;
            const name    = names[uid] || 'Unknown';
            return `
              <div class="clan-member-row${isMe ? ' clan-member-me' : ''}">
                <span class="clan-member-role">${isOwn ? '👑' : '•'}</span>
                <span class="clan-member-name">${name}${isMe ? ' (คุณ)' : ''}</span>
                ${isOwner && !isMe ? `<button class="clan-kick-btn" data-uid="${uid}">เตะ</button>` : ''}
              </div>`;
          }).join('')}
        </div>
      </div>
    `;

    document.getElementById('clan-leave-btn').addEventListener('click', async () => {
      const ok = confirm(isOwner && memberIds.length > 1
        ? 'ออกจากแคลน? หัวหน้าจะถูกโอนให้สมาชิกคนอื่น'
        : (isOwner ? 'ออกจากแคลน? แคลนนี้จะถูกลบ (คุณเป็นสมาชิกคนเดียว)' : 'ออกจากแคลนนี้?'));
      if (!ok) return;
      const res = await leaveClan();
      if (res.ok) {
        showToast('ออกจากแคลนแล้ว', 'success');
        render();
      } else {
        showToast(res.error, 'error');
      }
    });

    panel.querySelectorAll('.clan-kick-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const targetUid = btn.dataset.uid;
        const ok = confirm(`เตะ "${names[targetUid] || 'สมาชิก'}" ออกจากแคลน?`);
        if (!ok) return;
        const res = await kickMember(targetUid);
        if (res.ok) {
          showToast('เตะสมาชิกแล้ว', 'success');
          _myClanData = await _loadClan(_myClanId);
          _renderMyClan(panel);
        } else {
          showToast(res.error, 'error');
        }
      });
    });
  }

  // ── หน้า: ยังไม่มีแคลน → สร้าง/ค้นหาเข้าร่วม ─────────────
  async function _renderBrowse(panel) {
    _allClans = await _fetchAllClans();

    panel.innerHTML = `
      <div class="clan-wrap">
        <div class="clan-title">⚔ แคลน</div>

        <div class="clan-create-card">
          <div class="clan-create-title">สร้างแคลนใหม่</div>
          <div class="clan-create-row">
            <input type="text" id="clan-create-name" class="clan-input" placeholder="ชื่อแคลน" maxlength="${NAME_MAX}">
            <input type="text" id="clan-create-tag"  class="clan-input clan-input-tag" placeholder="TAG" maxlength="${TAG_MAX}">
          </div>
          <div class="clan-create-error" id="clan-create-error"></div>
          <button class="clan-create-btn" id="clan-create-btn">+ สร้างแคลน</button>
        </div>

        <div class="clan-browse-title">รายชื่อแคลน (${_allClans.length})</div>
        <div class="clan-browse-list" id="clan-browse-list">
          ${_allClans.length === 0
            ? '<div class="ranking-empty">ยังไม่มีแคลน — สร้างแคลนแรกเลย!</div>'
            : _allClans.map(c => `
              <div class="clan-browse-row">
                <div class="clan-browse-info">
                  <span class="clan-browse-name">[${c.tag}] ${c.name}</span>
                  <span class="clan-browse-count">${c.memberCount} / ${MAX_MEMBERS}</span>
                </div>
                <button class="clan-join-btn" data-id="${c.id}" ${c.memberCount >= MAX_MEMBERS ? 'disabled' : ''}>
                  ${c.memberCount >= MAX_MEMBERS ? 'เต็ม' : 'เข้าร่วม'}
                </button>
              </div>
            `).join('')
          }
        </div>
        <button class="ranking-refresh-btn" id="clan-refresh-btn">🔄 รีเฟรช</button>
      </div>
    `;

    document.getElementById('clan-create-btn').addEventListener('click', async () => {
      const name = document.getElementById('clan-create-name').value.trim();
      const tag  = document.getElementById('clan-create-tag').value.trim();
      const errEl = document.getElementById('clan-create-error');
      errEl.textContent = '';

      const btn = document.getElementById('clan-create-btn');
      btn.disabled = true;
      const res = await createClan(name, tag);
      btn.disabled = false;

      if (res.ok) {
        showToast('สร้างแคลนสำเร็จ!', 'success');
        render();
      } else {
        errEl.textContent = res.error;
      }
    });

    panel.querySelectorAll('.clan-join-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        const res = await joinClan(btn.dataset.id);
        if (res.ok) {
          showToast('เข้าร่วมแคลนสำเร็จ!', 'success');
          render();
        } else {
          showToast(res.error, 'error');
          btn.disabled = false;
        }
      });
    });

    document.getElementById('clan-refresh-btn').addEventListener('click', () => render());
  }

  return { init, render, createClan, joinClan, leaveClan, kickMember, getMyClanId, getMyClanData };
})();

window.Clan = Clan;
