// ui/today.js — today's date as YYYY-MM-DD in the viewer's LOCAL time zone (what a date
// input expects). `toISOString()` is UTC, which is already tomorrow/yesterday for part of the day.
export function todayLocal(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}
