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

// Lead import sheet: small pure helpers for the editable view of the converted workbook.

import type { SheetColumn, SheetMark, SheetRow } from "../leadImportTypes";

/** How a marked cell looks. `off` is a change or edit that was undone or dismissed: the
 *  cell holds the workbook's own value again, but can still be redone from it. */
export type MarkTone = "pending" | "claude" | "edited" | "off";

export function markTone(mark: SheetMark): MarkTone {
  if (mark.kind === "user_edit") return mark.status === "applied" ? "edited" : "off";
  if (mark.status === "pending") return "pending";
  return mark.status === "applied" ? "claude" : "off";
}

/** Which rows the sheet shows. */
export type SheetFilter = "all" | "changed" | "pending" | "edited";

function rowTones(row: SheetRow): Set<MarkTone> {
  return new Set(Object.values(row.marks ?? {}).map(markTone));
}

function matchesFilter(row: SheetRow, filter: SheetFilter): boolean {
  if (filter === "all") return true;
  const tones = rowTones(row);
  if (filter === "changed") return tones.has("claude") || tones.has("pending") || tones.has("edited");
  return tones.has(filter);
}

/** The rows that pass the filter and contain the search text (any cell, any case). */
export function filterRows(rows: SheetRow[], query: string, filter: SheetFilter): SheetRow[] {
  const needle = query.trim().toLowerCase();
  return rows.filter(
    (row) =>
      matchesFilter(row, filter) &&
      (!needle || row.cells.some((value) => value.toLowerCase().includes(needle))),
  );
}

/** How many rows each filter would show. */
export function filterCounts(rows: SheetRow[]): Record<SheetFilter, number> {
  const counts: Record<SheetFilter, number> = { all: rows.length, changed: 0, pending: 0, edited: 0 };
  for (const row of rows) {
    for (const filter of ["changed", "pending", "edited"] as const) {
      if (matchesFilter(row, filter)) counts[filter] += 1;
    }
  }
  return counts;
}

/** One cell's identity across saves: tab, lead email and column key. */
export function cellKey(tab: string, email: string, column: string): string {
  return `${tab}\u0000${email.toLowerCase()}\u0000${column}`;
}

/** The slice of rows to put in the DOM for a fixed-height-row list scrolled to
 *  `scrollTop`, with `overscan` rows either side so a fast scroll never shows a gap. */
export function visibleRange(
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  count: number,
  overscan: number,
): { first: number; last: number } {
  const first = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const last = Math.min(count, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan);
  return { first: Math.min(first, last), last };
}

const WIDE = new Set(["notes", "address", "email", "assigned_am"]);
const NARROW = new Set(["hot_lead", "score", "state"]);

/** A column's width in px: prose and emails get room, flags and numbers don't. */
export function columnWidth(column: Pick<SheetColumn, "key">): number {
  if (WIDE.has(column.key)) return 220;
  if (NARROW.has(column.key)) return 90;
  return 150;
}
