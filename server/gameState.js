// ===== GAME STATE =====
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');

const WORLD_IDS = ['safezone', 'airport', 'snow'];
const SAVE_FILE = path.join(__dirname, 'drops_save.json');

const players = {};
WORLD_IDS.forEach(id => { players[id] = {}; });

const WORLD = 6000;
const socketWorld = {};

// ── World Drops ──────────────────────────────────────────────
const world_drops = {};
WORLD_IDS.forEach(id => { world_drops[id] = []; });

function loadDrops() {
  try {
    if (fs.existsSync(SAVE_FILE)) {
      const data = JSON.parse(fs.readFileSync(SAVE_FILE, 'utf8'));
      WORLD_IDS.forEach(id => {
        if (data[id]) world_drops[id] = data[id];
      });
      console.log(`Loaded ${WORLD_IDS.map(id => world_drops[id].length).reduce((a,b)=>a+b,0)} drops from save.`);
    }
  } catch(e) {
    console.log('Could not load drops save:', e.message);
  }
}

function saveDrops() {
  try {
    fs.writeFileSync(SAVE_FILE, JSON.stringify(world_drops));
  } catch(e) {
    console.log('Could not save drops:', e.message);
  }
}

loadDrops();

function newDropId() { return 'drop_' + randomUUID(); }

// ── Safe Vault Positions ──────────────────────────────────────
// { uid_safeId: { uid, safeId, worldId, x, y, placedAt } }
const SAFE_FILE = path.join(__dirname, 'safes_save.json');
const placed_safes = {};

function loadSafes() {
  try {
    if (fs.existsSync(SAFE_FILE)) {
      const data = JSON.parse(fs.readFileSync(SAFE_FILE, 'utf8'));
      Object.assign(placed_safes, data);
      console.log(`Loaded ${Object.keys(placed_safes).length} placed safes from save.`);
    }
  } catch(e) {
    console.log('Could not load safes save:', e.message);
  }
}

function saveSafes() {
  try {
    fs.writeFileSync(SAFE_FILE, JSON.stringify(placed_safes, null, 2));
  } catch(e) {
    console.log('Could not save safes:', e.message);
  }
}

loadSafes();

module.exports = { players, WORLD, WORLD_IDS, socketWorld, world_drops, newDropId, saveDrops, placed_safes, saveSafes };
