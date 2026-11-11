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

// Month-grid arithmetic on civil dates ({year, month, day}), never on instants —
// docs/conventions.md "Time". A calendar item's date is a day, not a moment, so
// it must land in the same cell wherever the reader is.
//
// Day stepping goes through Date.UTC, which has no daylight-saving jumps, and
// reads the result back with the getUTC* accessors. Nothing here reads the
// local clock except currentMonth.

import { localIsoMonth } from "@utils/localDate";

export interface CivilDate {
  year: number;
  month: number; // 1–12
  day: number;
}

export interface CalendarMonth {
  year: number;
  month: number; // 1–12
}

const DAYS_PER_WEEK = 7;

/** "YYYY-MM-DD". */
export function isoDate({ year, month, day }: CivilDate): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** "YYYY-MM", the form the page keeps in its `?month=` parameter. */
export function isoMonth({ year, month }: CalendarMonth): string {
  return `${year}-${pad(month)}`;
}

/** A "YYYY-MM" back into a month, or null when it isn't one. */
export function parseIsoMonth(value: string | null): CalendarMonth | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

/** The month it is now, where the reader is. */
export function currentMonth(now: Date = new Date()): CalendarMonth {
  return parseIsoMonth(localIsoMonth(now))!;
}

/** The month `count` months later; negative goes back. */
export function addMonths({ year, month }: CalendarMonth, count: number): CalendarMonth {
  const monthsSinceYearZero = year * 12 + (month - 1) + count;
  return { year: Math.floor(monthsSinceYearZero / 12), month: (monthsSinceYearZero % 12) + 1 };
}

/**
 * The weeks to draw for a month: Monday to Sunday, from the week holding the 1st
 * to the week holding the last day. The days before the 1st and after the last
 * belong to the neighbouring months and are drawn too, so every row is full.
 */
export function monthGridWeeks({ year, month }: CalendarMonth): CivilDate[][] {
  const firstOfMonth = Date.UTC(year, month - 1, 1);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // getUTCDay counts from Sunday = 0; the grid starts its weeks on Monday.
  const daysBeforeTheFirst = (new Date(firstOfMonth).getUTCDay() + 6) % DAYS_PER_WEEK;
  const weekCount = Math.ceil((daysBeforeTheFirst + daysInMonth) / DAYS_PER_WEEK);

  const weeks: CivilDate[][] = [];
  for (let week = 0; week < weekCount; week++) {
    const days: CivilDate[] = [];
    for (let weekday = 0; weekday < DAYS_PER_WEEK; weekday++) {
      const dayOffset = week * DAYS_PER_WEEK + weekday - daysBeforeTheFirst;
      days.push(civilDateOf(new Date(Date.UTC(year, month - 1, 1 + dayOffset))));
    }
    weeks.push(days);
  }
  return weeks;
}

/** "November 2026". */
export function monthTitle({ year, month }: CalendarMonth): string {
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    Date.UTC(year, month - 1, 1),
  );
}

/** "Tuesday, 10 November 2026" for a "YYYY-MM-DD", in the reader's locale. */
export function longDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(Date.UTC(year, month - 1, day));
}

function civilDateOf(utcDate: Date): CivilDate {
  return { year: utcDate.getUTCFullYear(), month: utcDate.getUTCMonth() + 1, day: utcDate.getUTCDate() };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
