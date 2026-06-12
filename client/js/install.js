// ===== INSTALL.JS =====
// บังคับให้ผู้เล่นติดตั้ง PWA ก่อนเข้าเกม

(() => {
  // ถ้าเปิดมาในรูปแบบ standalone (ติดตั้งแล้ว) ไม่ต้องโชว์ overlay
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    window.navigator.standalone === true;

  if (isStandalone) return;

  let deferredPrompt = null;

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  // สร้าง overlay
  const overlay = document.createElement('div');
  overlay.id = 'install-overlay';
  overlay.innerHTML = `
    <div class="install-logo"><span>THE</span><span>PLAY</span><span>Z</span></div>
    <div class="install-text">
      ติดตั้งแอพเพื่อเล่นเกม THEPLAYZ<br>
      ได้ประสบการณ์เต็มจอ ลื่นไหลกว่าเดิม
    </div>
    <button class="install-btn" id="install-btn">ติดตั้งแอพ</button>
    <button class="install-skip" id="install-skip">เล่นในเบราว์เซอร์ (ไม่แนะนำ)</button>
    <div class="install-ios-steps">
      วิธีติดตั้งบน iPhone/iPad:<br>
      1. แตะปุ่ม Share (ไอคอนสี่เหลี่ยมมีลูกศรขึ้น)<br>
      2. เลือก "Add to Home Screen"<br>
      3. แตะ "Add" แล้วเปิดแอพจากหน้าจอหลัก
    </div>
  `;
  document.body.appendChild(overlay);

  if (isIOS) {
    overlay.classList.add('ios');
  }

  // ดัก event ติดตั้ง (Android/Desktop Chrome)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });

  const installBtn = document.getElementById('install-btn');
  installBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        overlay.classList.add('hidden');
      }
      deferredPrompt = null;
    } else {
      // Chrome ไม่ fire beforeinstallprompt (อาจติดตั้งแล้ว หรือเคย dismiss)
      // แสดงคำแนะนำติดตั้งแบบ manual ผ่านเมนู Chrome
      const manual = document.createElement('div');
      manual.className = 'install-manual-steps';
      manual.innerHTML = `
        ไม่สามารถเปิดหน้าต่างติดตั้งอัตโนมัติได้<br>
        วิธีติดตั้งด้วยตนเอง:<br>
        1. แตะปุ่มเมนู ⋮ มุมขวาบนของ Chrome<br>
        2. เลือก "ติดตั้งแอป" หรือ "Add to Home screen"<br>
        3. แตะ "ติดตั้ง" / "Add"<br>
        <br>
        (หากเคยติดตั้งแอปนี้ไว้แล้ว ให้เปิดจากหน้าจอหลักได้เลย)
      `;
      const existing = overlay.querySelector('.install-manual-steps');
      if (existing) existing.remove();
      overlay.appendChild(manual);
    }
  });

  // ปุ่ม "เล่นในเบราว์เซอร์" — ให้ผู้เล่นข้ามได้ถ้าจำเป็น
  document.getElementById('install-skip').addEventListener('click', () => {
    overlay.classList.add('hidden');
  });

  // ถ้าติดตั้งสำเร็จ ปิด overlay ทันที
  window.addEventListener('appinstalled', () => {
    overlay.classList.add('hidden');
  });
})();
