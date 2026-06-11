// ===== LOADING.JS =====
// Loading Screen — หลอดโหลด 0→100% พร้อม label transition
// ใช้: Loading.show('LOGIN', 'LOBBY', durationMs).then(done => done())

window.Loading = (() => {

  // ── inject HTML ครั้งเดียวตอนโหลด ──────────────────────
  const el = document.createElement('div');
  el.id = 'loading-screen';
  el.innerHTML = `
    <div class="ls-glow"></div>
    <div class="ls-corner tl"></div>
    <div class="ls-corner tr"></div>
    <div class="ls-corner bl"></div>
    <div class="ls-corner br"></div>
    <div class="ls-logo"><span class="white">THE</span><span class="green">PLAY</span><span class="red">Z</span></div>
    <div class="ls-label" id="ls-label">
      <span id="ls-from">LOADING</span>
      <span class="ls-arrow">▶</span>
      <span id="ls-to">GAME</span>
    </div>
    <div class="ls-bar-wrap">
      <div class="ls-pct">
        <div class="ls-pct-num" id="ls-num">0</div>
        <div class="ls-pct-unit">%</div>
      </div>
      <div class="ls-track">
        <div class="ls-fill" id="ls-fill"></div>
      </div>
      <div class="ls-status" id="ls-status">INITIALIZING...</div>
    </div>
  `;
  // ซ่อนไว้ก่อน (ยังไม่แสดง)
  el.style.display = 'none';
  document.body.appendChild(el);

  // ── status messages ตามช่วง % ───────────────────────────
  const STATUS_MSGS = [
    { at: 0,   text: 'INITIALIZING...'    },
    { at: 15,  text: 'LOADING ASSETS...'  },
    { at: 35,  text: 'CONNECTING...'      },
    { at: 55,  text: 'LOADING WORLD...'   },
    { at: 75,  text: 'SYNCING DATA...'    },
    { at: 90,  text: 'ALMOST READY...'    },
    { at: 99,  text: 'DONE!'              },
  ];

  function getStatus(pct) {
    let msg = STATUS_MSGS[0].text;
    for (const s of STATUS_MSGS) {
      if (pct >= s.at) msg = s.text;
    }
    return msg;
  }

  // ── core ─────────────────────────────────────────────────
  //
  // show(from, to, duration)
  //   - แสดง loading screen พร้อม label
  //   - หลอดวิ่ง 0→100 ใน ~duration ms
  //   - คืน Promise ที่ resolve เป็น function done()
  //     เรียก done() เพื่อ fade-out และซ่อน
  //
  // ตัวอย่าง:
  //   const done = await Loading.show('LOGIN', 'LOBBY', 1800);
  //   // ทำงานอื่นที่ต้องการ (หรือรอ auto)
  //   done();   // fade out แล้วซ่อน
  //
  function show(from = 'LOADING', to = 'GAME', duration = 1600) {
    return new Promise(resolve => {
      // ตั้งค่า label
      document.getElementById('ls-from').textContent = from;
      document.getElementById('ls-to').textContent   = to;

      // reset
      const fill   = document.getElementById('ls-fill');
      const numEl  = document.getElementById('ls-num');
      const status = document.getElementById('ls-status');
      fill.style.transition = 'none';
      fill.style.width      = '0%';
      numEl.textContent     = '0';
      status.textContent    = getStatus(0);

      // แสดง
      el.style.display = 'flex';
      el.style.opacity = '1';
      el.classList.remove('hidden');

      // force reflow
      void el.getBoundingClientRect();
      fill.style.transition = '';

      // animate 0→100
      const startTime = performance.now();
      let   pct       = 0;

      function tick(now) {
        const elapsed = now - startTime;
        // ease-out curve: เร็วแรก ช้าตอนท้าย
        const t  = Math.min(elapsed / duration, 1);
        const e  = 1 - Math.pow(1 - t, 2.2);
        pct      = Math.min(100, Math.round(e * 100));

        fill.style.width  = pct + '%';
        numEl.textContent = pct;
        status.textContent = getStatus(pct);

        if (pct < 100) {
          requestAnimationFrame(tick);
        } else {
          // ถึง 100% แล้ว → resolve done()
          resolve(done);
        }
      }

      requestAnimationFrame(tick);
    });
  }

  // ── done(): fade out แล้วซ่อน ───────────────────────────
  function done() {
    return new Promise(resolve => {
      el.classList.add('hidden');
      setTimeout(() => {
        el.style.display = 'none';
        el.classList.remove('hidden');
        el.style.opacity = '1';
        resolve();
      }, 380);
    });
  }

  return { show };
})();
