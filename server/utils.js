// ===== UTILS =====
// ฟังก์ชันเล็กๆ ที่ใช้ร่วมกัน

function randomColor() {
  const colors = ['#4fc3f7', '#81c784', '#ffb74d', '#f06292', '#ce93d8', '#80cbc4'];
  return colors[Math.floor(Math.random() * colors.length)];
}

module.exports = { randomColor };
