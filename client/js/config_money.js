// ===== CONFIG_MONEY.JS =====
// ตั้งค่าระบบเงินทั้งหมด แก้ที่นี่ที่เดียวมีผลทุกที่

var MONEY_CONFIG = {

  // ===== เงินเริ่มต้นสำหรับผู้เล่นใหม่ =====
  STARTING_MONEY: 1000,   // $ (ได้จากการเล่น)
  STARTING_POINT: 0,    // 💎 Point (ได้จากการเติมเงิน)

  // ===== รางวัลจากการเล่น =====
  REWARD_PER_KILL:    100,   // $ ต่อ 1 kill
  REWARD_PER_MATCH:   100,   // $ ต่อการจบ match (ไม่ว่าจะชนะหรือแพ้)
  REWARD_WIN_BONUS:   100,   // $ โบนัสเพิ่มถ้าเป็น top 1

  // ===== Firebase path =====
  // ข้อมูลเงินจะถูกเก็บที่ /users/{uid}/wallet
  FIREBASE_PATH: 'users',

};
