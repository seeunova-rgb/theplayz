// ===== INDEX.JS =====
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { initSocket } = require('./socket');

// ── Firebase Admin (ใช้ env variable แทนไฟล์ JSON) ───────
const admin = require('firebase-admin');
if (!admin.apps.length) {
  // Railway อาจเก็บ newline จริงใน private_key — escape ก่อน parse
  const envVal = process.env.FIREBASE_SERVICE_ACCOUNT;
  const serviceAccount = JSON.parse(envVal.replace(/\r?\n/g, "\\n").replace(/\\\\n/g, "\\n"));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://theplayz-game-default-rtdb.asia-southeast1.firebasedatabase.app',
  });
}
const adminDb = admin.database();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// serve client files
app.use(express.static(path.join(__dirname, '../client'), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
}));

initSocket(io);

// ── Migrate endpoint (ลบออกหลังใช้เสร็จ) ─────────────────
app.get('/admin/migrate-profiles', async (req, res) => {
  try {
    const authUsers = await admin.auth().listUsers();
    const results = { ok: 0, skip: 0, err: 0, log: [] };

    for (const user of authUsers.users) {
      const uid = user.uid;
      const displayName = user.displayName || '';
      const profileRef = adminDb.ref(`users/${uid}/profile`);
      const snap = await profileRef.once('value');
      const data = snap.val() || {};

      const hasAccount   = data.account   != null;
      const hasNameColor = data.nameColor  != null;

      if (hasAccount && hasNameColor) {
        results.skip++;
        results.log.push(`skip ${uid.slice(0,10)}`);
        continue;
      }

      try {
        if (!hasAccount)   await adminDb.ref(`users/${uid}/profile/account`).set('general');
        if (!hasNameColor) await adminDb.ref(`users/${uid}/profile/nameColor`).set({ color: '#ffffff' });
        if (!data.displayName && displayName) {
          await adminDb.ref(`users/${uid}/profile/displayName`).set(displayName);
        }
        results.ok++;
        results.log.push(`ok ${uid.slice(0,10)} (${displayName})`);
      } catch(e) {
        results.err++;
        results.log.push(`err ${uid.slice(0,10)}: ${e.message}`);
      }
    }

    res.json({ total: authUsers.users.length, ...results });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── กัน crash ─────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
});
process.on('unhandledRejection', (err) => {
  console.error('[UNHANDLED REJECTION]', err);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`THEPLAYZ server running on http://localhost:${PORT}`);
});
