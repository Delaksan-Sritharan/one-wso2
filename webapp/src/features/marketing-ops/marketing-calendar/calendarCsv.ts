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

import { categoryStyle } from "./calendarCategories";
import { itemFields } from "./calendarFields";
import type { CalendarRange } from "./calendarRange";
import type { CalendarCategory, CalendarItem } from "./marketingCalendarTypes";

// The List's CSV export for one type tab: a row per item shown, in the order
// shown, with that type's fields as columns (the drawer's labels and order,
// from calendarFields). Every item must be of one category, which a type tab
// guarantees; the All tab has no export.
//
// Dates stay YYYY-MM-DD, which spreadsheets read as dates and sort correctly.
// A list (BU, Region) is one cell, comma separated. A field with no value is
// an empty cell, so every row has every column.

const BOM = "﻿";
const NUMERIC_LIKE = /^[-+]?\d+(\.\d+)?%?$/;

/** The CSV text for `items`, all of one category. Empty when there are none. */
export function calendarCsv(items: readonly CalendarItem[]): string {
  if (items.length === 0) return "";
  const rows = items.map(itemCells);
  const header = rows[0].map(([label]) => label);
  const lines = [header, ...rows.map((cells) => cells.map(([, value]) => value))];
  return BOM + lines.map((cells) => cells.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** e.g. "marketing-calendar-content-2026-11-01-to-2026-11-30.csv" */
export function csvFileName(category: CalendarCategory, range: CalendarRange): string {
  return `marketing-calendar-${categoryStyle(category).segment}-${range.from}-to-${range.to}.csv`;
}

// The heading the drawer shows (the title, or an event's name) first, then the
// drawer's fields, then what the drawer shows under the heading and its link.
function itemCells(item: CalendarItem): [label: string, value: string][] {
  const { heading, fields } = itemFields(item);
  return [
    [item.category === "event" ? "Event Name" : "Title", heading],
    ...fields.map(({ label, value }): [string, string] => [
      label,
      value === undefined ? "" : typeof value === "string" ? value : value.join(", "),
    ]),
    ["Status", item.status ?? ""],
    ["State", item.state === "open" ? "Open" : "Closed"],
    ["GitHub Issue", item.url],
  ];
}

// Titles, abstracts and email bodies are text people typed in GitHub. A cell
// starting with =, +, -, @, a tab or a carriage return can run as a formula in
// a spreadsheet, so such a cell gets a leading quote, unless it is just a
// number. A cell with a quote, comma or line break is quoted, inner quotes doubled.
function csvCell(value: string): string {
  const guarded = !NUMERIC_LIKE.test(value) && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}
