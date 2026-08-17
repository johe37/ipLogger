const crypto = require("node:crypto");

function text(value) {
  if (value == null || value === "") return null;
  return String(value);
}

function int(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function timestamp(value) {
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) {
    return value;
  }
  return new Date().toISOString();
}

function clampInt(value, fallback, min, max) {
  const n = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function numberValue(value) {
  if (typeof value === "bigint") return Number(value);
  return Number(value) || 0;
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  const max = Math.max(left.length, right.length);
  const padLeft = Buffer.alloc(max);
  const padRight = Buffer.alloc(max);
  left.copy(padLeft);
  right.copy(padRight);
  return crypto.timingSafeEqual(padLeft, padRight) && left.length === right.length;
}

module.exports = {
  text,
  int,
  timestamp,
  clampInt,
  numberValue,
  safeEqual
};
