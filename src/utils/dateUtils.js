export const WEEKDAYS = [
  { key: "sun", label: "Sun", bit: 1 << 0 },
  { key: "mon", label: "Mon", bit: 1 << 1 },
  { key: "tue", label: "Tue", bit: 1 << 2 },
  { key: "wed", label: "Wed", bit: 1 << 3 },
  { key: "thu", label: "Thu", bit: 1 << 4 },
  { key: "fri", label: "Fri", bit: 1 << 5 },
  { key: "sat", label: "Sat", bit: 1 << 6 },
];

export const EVERY_DAY_MASK = WEEKDAYS.reduce((mask, day) => mask | day.bit, 0);

export function newId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function todayString() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function weekdayBit(dateString = todayString()) {
  const date = new Date(dateString + "T00:00:00");
  return 1 << date.getDay();
}

export function isRoutineActiveOnDate(routine, dateString = todayString()) {
  const mask = routine.dayMask ?? EVERY_DAY_MASK;
  return (mask & weekdayBit(dateString)) !== 0;
}

export function formatDayMask(mask = EVERY_DAY_MASK) {
  const active = WEEKDAYS.filter((day) => (mask & day.bit) !== 0).map((day) => day.label);
  if (active.length === 7) return "Every day";
  if (active.length === 0) return "No days";
  return active.join(", ");
}

export function addDays(dateString, days) {
  const date = new Date((dateString || todayString()) + "T00:00:00");
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function addMonths(dateString, months) {
  const date = new Date((dateString || todayString()) + "T00:00:00");
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

export function addCooldown(dateString, amount, unit) {
  const cleanAmount = Math.max(1, Number(amount) || 1);

  if (unit === "days") return addDays(dateString, cleanAmount);
  if (unit === "weeks") return addDays(dateString, cleanAmount * 7);
  if (unit === "months") return addMonths(dateString, cleanAmount);
  if (unit === "years") return addMonths(dateString, cleanAmount * 12);

  return addDays(dateString, cleanAmount);
}
