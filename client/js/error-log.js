// ===== ERROR-LOG.JS =====
// แสดง error บนหน้าจอ — ลบไฟล์นี้ออกเมื่อ production พร้อม

const MAX_ERR_ENTRIES = 50; // [FIX] จำกัด entry สูงสุดป้องกัน DOM บวม

function _appendError(html) {
  const el = document.getElementById('err-log');
  if (!el) return;
  el.style.display = 'block';

  // [FIX] ใช้ createElement แทน innerHTML += เพื่อป้องกัน XSS และ re-parse ทั้ง DOM
  const div = document.createElement('div');
  div.innerHTML = html; // html มาจาก code เราเอง ไม่ใช่ user input
  el.appendChild(div);

  // ลบ entry เก่าสุดเมื่อเกิน limit
  while (el.children.length > MAX_ERR_ENTRIES) {
    el.removeChild(el.firstChild);
  }
}

window.onerror = function (msg, src, line) {
  _appendError(`❌ ${msg}<br><small>${src}:${line}</small>`);
};

window.addEventListener('unhandledrejection', function (e) {
  _appendError(`❌ Promise: ${e.reason}`);
});
