// ===== CONFIG_REPUTATION.JS =====
// ตั้งค่าระบบ Reputation ทั้งหมด แก้ที่นี่ที่เดียวมีผลทุกที่

var REPUTATION_CONFIG = {

  // ===== Firebase path =====
  FIREBASE_PATH: 'users',  // เก็บที่ /users/{uid}/reputation

  // ===== Reputation เริ่มต้น =====
  STARTING_REP: 0,

  // ===== ค่า threshold ของแต่ละยศ (เรียงจากน้อยไปมาก) =====
  // ค่า min คือ reputation ขั้นต่ำที่ต้องมีเพื่อได้ยศนั้น
  TIERS: [
    // ── คนเลว (ค่าติดลบ) ──────────────────────────────────
    { id: 'assassin', label: 'Assassin', min: -Infinity, max: -1000, img: 'assassin.png',  side: 'evil'  },
    { id: 'villain',  label: 'Villain',  min: -999,      max: -600,  img: 'villain.png',   side: 'evil'  },
    { id: 'hitman',   label: 'Hitman',   min: -599,      max: -300,  img: 'hitman.png',    side: 'evil'  },
    { id: 'bandit',   label: 'Bandit',   min: -299,      max: -100,  img: 'bandit.png',    side: 'evil'  },
    { id: 'outlaw',   label: 'Outlaw',   min: -99,       max: -50,   img: 'outlaw.png',    side: 'evil'  },
    { id: 'thuglife', label: 'Thug',     min: -49,       max: -10,   img: 'thuglife.png',  side: 'evil'  },
    // ── กลาง ─────────────────────────────────────────────
    { id: 'neutral',  label: '',         min: -9,        max: 4,     img: null,            side: 'neutral' },
    // ── คนดี (ค่าบวก) ─────────────────────────────────────
    { id: 'constable',label: 'Constable',min: 5,         max: 49,    img: 'constable.png', side: 'good'  },
    { id: 'deputy',   label: 'Deputy',   min: 50,        max: 99,    img: 'deputy.png',    side: 'good'  },
    { id: 'lawmen',   label: 'Lawmen',   min: 100,       max: 249,   img: 'lawmen.png',    side: 'good'  },
    { id: 'guardian', label: 'Guardian', min: 250,       max: 499,   img: 'guardian.png',  side: 'good'  },
    { id: 'vigilante',label: 'Vigilante',min: 500,       max: 999,   img: 'vigilante.png', side: 'good'  },
    { id: 'paragon',  label: 'Paragon',  min: 1000,      max: Infinity, img: 'paragon.png', side: 'good' },
  ],

  // ===== รางวัล/โทษเมื่อฆ่า PvP =====
  // แต่ละ tier ของเหยื่อจะให้ผลต่างกัน
  // ค่าบวก = เพิ่ม rep ให้คนฆ่า, ค่าลบ = ลด rep ให้คนฆ่า
  KILL_REWARDS: {
    //   เหยื่อ tier id    :  { good_gets, evil_gets }
    //   good_gets  = ผลที่คนดีได้เมื่อฆ่า tier นี้
    //   evil_gets  = ผลที่คนเลวได้เมื่อฆ่า tier นี้
    assassin:  { good_gets: +80,  evil_gets: +15 },  // ฆ่า assassin
    villain:   { good_gets: +50,  evil_gets: +10 },
    hitman:    { good_gets: +35,  evil_gets: +7  },
    bandit:    { good_gets: +20,  evil_gets: +5  },
    outlaw:    { good_gets: +12,  evil_gets: +3  },
    thuglife:  { good_gets: +5,   evil_gets: +2  },
    neutral:   { good_gets: -5,   evil_gets: -3  },  // ฆ่าคนกลาง: เสีย rep เล็กน้อย
    constable: { good_gets: -8,   evil_gets: -5  },  // คนดีฆ่าคนดี = เสีย
    deputy:    { good_gets: -15,  evil_gets: -8  },
    lawmen:    { good_gets: -25,  evil_gets: -12 },
    guardian:  { good_gets: -40,  evil_gets: -18 },
    vigilante: { good_gets: -60,  evil_gets: -25 },
    paragon:   { good_gets: -100, evil_gets: -40 },
  },

  // ===== รางวัลจากการฆ่า PvE (zombie/boss) =====
  // ทุกคน (ทั้งดีและเลว) ได้ + เสมอ
  ENTITY_KILL_REP: {
    zombie: +1,
    boss:   +5,
  },

};
