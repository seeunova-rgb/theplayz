// ===== AUTH.JS =====
// Firebase Authentication — login, register, logout, auth state
// โหลดเป็น <script type="module">

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
         signOut, onAuthStateChanged, updateProfile }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getDatabase, ref, get, set, onValue, off }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ── Firebase config ───────────────────────────────────────

const firebaseConfig = {
  apiKey:            "AIzaSyAyw3Tq72PnP3rR49_OKTkyxwjx-anq8W4",
  authDomain:        "theplayz-game.firebaseapp.com",
  databaseURL:       "https://theplayz-game-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "theplayz-game",
  storageBucket:     "theplayz-game.firebasestorage.app",
  messagingSenderId: "618323953801",
  appId:             "1:618323953801:web:52d52283ab5cbc03a3de58",
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getDatabase(app);

// ── helpers ───────────────────────────────────────────────

function showError(id, msg) { document.getElementById(id).textContent = msg; }
function setLoading(btn, on) { btn.disabled = on; btn.textContent = on ? '...' : btn.dataset.label; }

function errMsg(code) {
  const map = {
    'auth/invalid-email':          'อีเมลไม่ถูกต้อง',
    'auth/user-not-found':         'ไม่พบบัญชีนี้',
    'auth/wrong-password':         'รหัสผ่านไม่ถูกต้อง',
    'auth/email-already-in-use':   'อีเมลนี้ถูกใช้แล้ว',
    'auth/weak-password':          'รหัสผ่านอ่อนเกินไป',
    'auth/too-many-requests':      'ลองใหม่ภายหลัง',
    'auth/invalid-credential':     'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
    'auth/network-request-failed': 'ไม่มีอินเทอร์เน็ต',
  };
  return map[code] || 'เกิดข้อผิดพลาด (' + code + ')';
}

// ── auth tabs ─────────────────────────────────────────────

document.getElementById('tab-login').addEventListener('click', () => {
  document.getElementById('form-login').style.display    = '';
  document.getElementById('form-register').style.display = 'none';
  document.getElementById('tab-login').classList.add('active');
  document.getElementById('tab-register').classList.remove('active');
});
document.getElementById('tab-register').addEventListener('click', () => {
  document.getElementById('form-register').style.display = '';
  document.getElementById('form-login').style.display    = 'none';
  document.getElementById('tab-register').classList.add('active');
  document.getElementById('tab-login').classList.remove('active');
});

// ── login ─────────────────────────────────────────────────

const btnLogin = document.getElementById('btn-login');
btnLogin.dataset.label = 'LOGIN';
btnLogin.addEventListener('click', async () => {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  showError('login-error', '');
  if (!email || !pass) return showError('login-error', 'กรอกข้อมูลให้ครบ');
  setLoading(btnLogin, true);
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    showError('login-error', errMsg(e.code));
    setLoading(btnLogin, false);
  }
});

// ── register ──────────────────────────────────────────────

const btnReg = document.getElementById('btn-register');
btnReg.dataset.label = 'CREATE ACCOUNT';
btnReg.addEventListener('click', async () => {
  const name  = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass  = document.getElementById('reg-pass').value;
  showError('reg-error', '');
  if (!name || !email || !pass) return showError('reg-error', 'กรอกข้อมูลให้ครบ');
  if (pass.length < 6) return showError('reg-error', 'รหัสผ่านอย่างน้อย 6 ตัว');
  setLoading(btnReg, true);
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });
  } catch (e) {
    showError('reg-error', errMsg(e.code));
    setLoading(btnReg, false);
  }
});

// ── logout ────────────────────────────────────────────────

document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

// ── auth state ────────────────────────────────────────────

onAuthStateChanged(auth, async user => {
  if (user) {
    document.getElementById('display-name').textContent = user.displayName || user.email;
    const fb = { ref, get, set, onValue, off, db };

    // ── Loading: LOGIN → LOBBY ───────────────────────────
    const done = await Loading.show('LOGIN', 'LOBBY', 1800);

    Money.init(user.uid, fb);       // โหลดเงินจาก Firebase ก่อนระบบอื่น
    Stash.init(user.uid, fb);       // โหลดคลังไอเทมจาก Firebase
    Reputation.init(user.uid, fb);  // โหลด Reputation จาก Firebase
    Ranking.init(user.uid, fb);     // init Ranking leaderboard
    // sync profile (ชื่อ, rep, money) ตอนเข้าล็อบบี้
    setTimeout(() => Ranking.syncProfile(), 2000);
    Shop.init(user.uid);
    Inventory.init(user.uid);
    Character.init(user.uid, fb);
    window.showScreen('lobby');

    await done();
  } else {
    Money.reset();              // detach listener + เคลียร์ค่าเมื่อ logout
    Stash.reset();
    Reputation.reset();         // detach listener + เคลียร์ค่าเมื่อ logout
    // ถ้า showScreenWithLoading พร้อมใช้แล้ว (logout จาก lobby) ใช้ loading
    if (typeof window.showScreenWithLoading === 'function') {
      window.showScreenWithLoading('auth', 'LOBBY', 'AUTH', 1200);
    } else {
      window.showScreen('auth');
    }
  }
});
