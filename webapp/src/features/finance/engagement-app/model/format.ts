// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

// Dates, ranges and amounts as the Engagement App shows them.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The twelve month names, for the invoice Month field. */
export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

interface Civil {
  y: number;
  m: number;
  d: number;
}

function civil(iso: string | undefined | null): Civil | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (c: Civil): string => `${c.y}-${pad(c.m)}-${pad(c.d)}`;

/** "19 Oct 2026", or "—". */
export function fmtDate(iso: string | undefined | null): string {
  const c = civil(iso);
  return c ? `${c.d} ${MONTHS[c.m - 1]} ${c.y}` : "—";
}

/** "19 Oct". */
export function fmtShort(iso: string): string {
  const c = civil(iso);
  return c ? `${c.d} ${MONTHS[c.m - 1]}` : "—";
}

/** "19–30 Oct 2026", "26 Oct – 13 Nov 2026", "28 Dec 2026 – 3 Jan 2027". */
export function fmtRange(start: string | undefined, end: string | undefined): string {
  const a = civil(start);
  const b = civil(end);
  if (!a || !b) return a ? fmtDate(start) : b ? fmtDate(end) : "—";
  if (a.y === b.y && a.m === b.m) return a.d === b.d ? fmtDate(start) : `${a.d}–${b.d} ${MONTHS[b.m - 1]} ${b.y}`;
  if (a.y === b.y) return `${fmtShort(start ?? "")} – ${fmtDate(end)}`;
  return `${fmtDate(start)} – ${fmtDate(end)}`;
}

/** "19 Oct 2026, 09:00" from "2026-10-19T09:00". */
export function fmtDateTime(iso: string | undefined): string {
  if (!iso) return "—";
  const time = /T(\d{2}:\d{2})/.exec(iso)?.[1];
  return time ? `${fmtDate(iso)}, ${time}` : fmtDate(iso);
}

/** "Oct 26" from "2026-10". */
export function fmtMonth(month: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(month);
  return match ? `${MONTHS[Number(match[2]) - 1]} ${match[1].slice(2)}` : month;
}

/** Days from `from` to `to` (civil dates), negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const a = civil(from);
  const b = civil(to);
  if (!a || !b) return 0;
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

/** The civil date `days` after `iso`. */
export function addDays(iso: string, days: number): string {
  const c = civil(iso);
  if (!c) return iso;
  const t = new Date(Date.UTC(c.y, c.m - 1, c.d + days));
  return isoOf({ y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() });
}

/** 1 January of the year of `iso`. */
export const yearStart = (iso: string): string => `${iso.slice(0, 4)}-01-01`;

/** "LKR 402,000" (LKR has no cents in the Travel app), "GBP 400.00". */
export function money(amount: number | undefined | null, currency: string | undefined): string {
  if (amount === undefined || amount === null || !Number.isFinite(amount)) return "—";
  const digits = currency === "LKR" ? 0 : 2;
  const n = amount.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return currency ? `${currency} ${n}` : n;
}

/** "1,234.50", the per diem tables' figures. */
export const n2 = (n: number): string => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "12,450". */
export const n0 = (n: number): string => Math.round(n).toLocaleString("en-US");

/** "USD 1.25M", "USD 412k", "USD 9,800": the dashboard's cost figures. */
export function usdShort(v: number): string {
  if (v >= 1e6) return `USD ${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e4) return `USD ${Math.round(v / 1e3)}k`;
  return `USD ${n0(v)}`;
}

/** The legacy "Expires In" (getTimeLabelAndColor): years, else months, else days; past is Expired; none is No expiry date. */
export function expiresIn(end: string | undefined, today: string): { label: string; expired: boolean; soon: boolean } {
  if (!end) return { label: "No expiry date", expired: false, soon: false };
  const n = daysBetween(today, end);
  if (n < 0) return { label: "Expired", expired: true, soon: false };
  const y = Math.floor(n / 365);
  const m = Math.floor((n % 365) / 30);
  const d = Math.floor((n % 365) % 30);
  const label = y > 0 ? `${y} ${y === 1 ? "yr" : "yrs"}` : m > 0 ? `${m} ${m === 1 ? "mo" : "mos"}` : `${d} ${d === 1 ? "day" : "days"}`;
  return { label, expired: false, soon: n < 90 };
}

/** "Singapore" or "Boston, United States of America". */
export function place(country: string | undefined, city?: string): string {
  if (!country) return city ?? "—";
  return city && city !== country ? `${city}, ${country}` : country;
}

/** "Orion Retail – Integration rollout", unless the title already starts with the account. */
export function engagementName(e: { kind: string; account: string; title: string }): string {
  if (e.kind !== "customer") return e.title;
  const first = e.account.split(" ")[0]?.toLowerCase() ?? "";
  return e.title.toLowerCase().startsWith(first) ? e.title : `${e.account} – ${e.title}`;
}

/** "3 consultants". */
export const plural = (n: number, one: string, many = `${one}s`): string => `${n0(n)} ${n === 1 ? one : many}`;

/** Dark text for a light fill and white for a dark one (`#rrggbb` fills; anything else gets white), so a label stays readable on any allocation type colour. */
export function readableOn(fill: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(fill.trim());
  if (!m) return "#fff";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Against white the contrast is 1.05 / (L + 0.05), against this near-black (L 0.01) it is (L + 0.05) / 0.06: they meet at L 0.2.
  return luminance > 0.2 ? "#111827" : "#fff";
}

/** A stable colour per allocation type, when the type defines none. */
export function typeColor(name: string, defined?: string): string {
  if (defined) return defined;
  const palette = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#0ea5e9", "#14b8a6", "#e11d48", "#6366f1", "#84cc16"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length];
}
