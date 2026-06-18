// Indian-system number formatting helpers.

export function formatIndian(value: number): string {
  const rounded = Math.round(Math.abs(value));
  const str = rounded.toString();
  if (str.length <= 3) return str;
  const lastThree = str.slice(-3);
  const other = str.slice(0, -3);
  return other.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree;
}

// ₹1,23,456 with currency symbol; preserves negative sign.
export function formatMoney(value: number, symbol = "₹"): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}${symbol}${formatIndian(value)}`;
}

// Compact label for chart axes, e.g. ₹2.1k, ₹1.2L.
export function shortMoney(value: number, symbol = "₹"): string {
  const n = Math.abs(Math.round(value));
  if (n >= 10000000) return `${symbol}${(n / 10000000).toFixed(1)}cr`;
  if (n >= 100000) return `${symbol}${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `${symbol}${(n / 1000).toFixed(1)}k`;
  return `${symbol}${n}`;
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  if (day === 1) return "Yesterday";
  if (day < 7) return `${day}d ago`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk}w ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export const CURRENCIES = [
  { code: "INR", symbol: "₹" },
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" },
  { code: "GBP", symbol: "£" },
  { code: "AED", symbol: "د.إ" },
];
