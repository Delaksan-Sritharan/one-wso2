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

/** A header click moves ascending, then descending, then back to the default order. */
export function nextSort(current: string, sortKey: string): string {
  if (current === sortKey) return `-${sortKey}`;
  if (current === `-${sortKey}`) return "";
  return sortKey;
}

/** What a column sorts by: one value per row, or none (blank values always sit last). */
export type SortValue = string | number | null | undefined;
export type SortAccessors<T> = Readonly<Record<string, (row: T) => SortValue>>;

/** The accessors `sortRows` takes, from the columns that declare a `sortKey` and a `sortValue`. */
export function columnAccessors<T>(columns: readonly { sortKey?: string; sortValue?: (row: T) => SortValue }[]): SortAccessors<T> {
  const out: Record<string, (row: T) => SortValue> = {};
  for (const c of columns) if (c.sortKey && c.sortValue) out[c.sortKey] = c.sortValue;
  return out;
}

const isBlank = (v: SortValue): v is null | undefined | "" => v === null || v === undefined || v === "";

/**
 * A client-side list sorted by the same keys the server lists take (`startDate`, or `-startDate` for descending).
 * An empty or unknown key keeps the order given. Text compares without case and numbers inside text by value (`E2` before `E10`),
 * blanks go last either way, and rows that compare equal keep their order.
 */
export function sortRows<T>(rows: readonly T[], sort: string, accessors: SortAccessors<T>): T[] {
  const desc = sort.startsWith("-");
  const key = desc ? sort.slice(1) : sort;
  // Own keys only: `?sort=__proto__` must fall back to the given order, not call an inherited property.
  const get = Object.hasOwn(accessors, key) ? accessors[key] : undefined;
  if (!sort || !get) return [...rows];
  const sign = desc ? -1 : 1;
  return rows
    .map((row, i) => ({ row, i, v: get(row) }))
    .sort((a, b) => {
      if (isBlank(a.v) || isBlank(b.v)) return isBlank(a.v) === isBlank(b.v) ? a.i - b.i : isBlank(a.v) ? 1 : -1;
      const c =
        typeof a.v === "number" && typeof b.v === "number"
          ? a.v - b.v
          : String(a.v).localeCompare(String(b.v), undefined, { numeric: true, sensitivity: "base" });
      return c ? c * sign : a.i - b.i;
    })
    .map((x) => x.row);
}
