// ===== INDEX.JS =====
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { initSocket } = require('./socket');

// ── Firebase Admin (ใช้ env variable แทนไฟล์ JSON) ───────
const admin = require('firebase-admin');
if (!admin.apps.length) {
  const envRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
  // fix newlines inside private_key value only
  const envFixed = envRaw.replace(/"private_key"\s*:\s*"([^"]*(?:\\"[^"]*)*)"/g,
    m => m.replace(/\n/g, '\\n'));
  const serviceAccount = JSON.parse(envFixed);
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
