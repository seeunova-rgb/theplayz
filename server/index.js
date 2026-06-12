// ===== INDEX.JS =====
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { initSocket } = require('./socket');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// serve client files — ไม่ cache JS/CSS เพื่อให้ได้ไฟล์ใหม่เสมอ
app.use(express.static(path.join(__dirname, '../client'), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
}));

initSocket(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`THEPLAYZ server running on http://localhost:${PORT}`);
});
