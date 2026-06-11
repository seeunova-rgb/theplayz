// ===== UTILITIES =====

function dist(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

function clamp(v, mn, mx) {
  return Math.max(mn, Math.min(mx, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function normalizeVector(dx, dy) {
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return { x: 0, y: 0 };
  return { x: dx / len, y: dy / len };
}
