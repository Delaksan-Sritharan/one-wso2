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

import { useCallback, useMemo } from "react";
import type { EngagementQueryParams } from "@config/apiConfig";
import { useUrlViewState, type UrlViewCodec } from "@hooks/useUrlViewState";
import { PAGE_SIZES, usePageSize } from "./pageSize";

/** A list's applied search, filters and page, all in the query string. */
export type ListView = Readonly<Record<string, string>>;

const codec: UrlViewCodec<ListView> = {
  // A repeated parameter (?engagementTypeId=1&engagementTypeId=5) reads as one comma-joined filter.
  parse: (search) => {
    const out: Record<string, string> = {};
    for (const [k, v] of new URLSearchParams(search)) out[k] = out[k] ? `${out[k]},${v}` : v;
    return out;
  },
  serialize: (view) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(view)) if (v) q.set(k, v);
    return q.toString();
  },
};

/**
 * A list screen's view, bound to the address bar: the search (`q`), each applied filter by its key (several values comma-joined), the page, and the column sort (`sort`, `-` for descending).
 * `id` names the list for its rows-per-page choice, which is kept per list in this browser. `defaultSort` is the order the list asks for until a header is clicked.
 */
export function useListView(id = "list", { defaultSort }: { defaultSort?: string } = {}) {
  const { view, setView } = useUrlViewState(codec);
  const [pageSize, choosePageSize] = usePageSize(id);
  const page = Math.max(0, Number(view.page ?? 0) || 0);
  const sort = view.sort ?? "";

  const setFilters = useCallback(
    (filters: ListView) => {
      // A new filter or search goes back to the first page.
      const next: Record<string, string> = { ...filters };
      if (view.q) next.q = view.q;
      if (view.sort) next.sort = view.sort;
      setView(next);
    },
    [setView, view.q, view.sort],
  );

  const setPage = (p: number) => setView({ ...view, page: p > 0 ? String(p) : "" });

  const filters = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(view)) if (k !== "q" && k !== "page" && k !== "sort") out[k] = v;
    return out;
  }, [view]);

  /** A new sort goes back to the first page; `""` is the default order. */
  const setSort = (next: string) => setView({ ...filters, ...(view.q ? { q: view.q } : {}), ...(next ? { sort: next } : {}) });

  return {
    view,
    search: view.q ?? "",
    page,
    sort,
    filters,
    setSearch: (q: string) => setView({ ...filters, ...(q ? { q } : {}), ...(sort ? { sort } : {}) }),
    setSort,
    setPage,
    pageSize,
    /** The pager a table shows for `total` rows: page, rows per page and the handlers for both. */
    pager: (total: number) => ({
      page,
      pageSize,
      total,
      onPage: setPage,
      pageSizes: PAGE_SIZES,
      onPageSize: (size: number) => {
        choosePageSize(size);
        setView({ ...view, page: "" });
      },
    }),
    /** The rows of the current page, for a list that holds all its rows in the browser. */
    pageOf: <T,>(rows: readonly T[]): T[] => rows.slice(page * pageSize, (page + 1) * pageSize),
    /** What a table's `sorting` takes. */
    sorting: { sort, onSort: setSort },
    setFilters,
    removeFilter: (key: string) => {
      const rest = { ...filters };
      delete rest[key];
      setFilters(rest);
    },
    /** The query parameters a list endpoint takes: search, filters, limit and offset. */
    paramsFor: (defs: readonly { key: string; type: string }[] = []): EngagementQueryParams => {
      const out: Record<string, string | readonly string[] | number | undefined> = {};
      for (const [k, v] of Object.entries(filters)) {
        out[k] = defs.find((d) => d.key === k)?.type === "multi" ? v.split(",").filter(Boolean) : v;
      }
      return { ...out, search: view.q || undefined, sort: sort || defaultSort || undefined, limit: pageSize, offset: page * pageSize };
    },
  };
}
