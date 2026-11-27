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

import type { EngagementQueryParams } from "@config/apiConfig";
import { rangeFor, rangeProblem, type DateRange, type RangePreset } from "./dateRanges";

// The Travel Costs controls bar's state, in the address bar. It owns only the keys that start with "tc".

export const FILTER_KEYS = ["tcSource", "tcEmployee", "tcJob", "tcCountry", "tcAgent", "tcPaid", "tcCustomer", "tcCostType", "tcUnlinked"] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

/** The API parameter each filter key becomes. */
const PARAM: Readonly<Record<FilterKey, string>> = {
  tcSource: "source",
  tcEmployee: "employee",
  tcJob: "jobNumber",
  tcCountry: "country",
  tcAgent: "travelAgent",
  tcPaid: "paid",
  tcCustomer: "customer",
  tcCostType: "costType",
  tcUnlinked: "unlinked",
};

export const PAGE_SIZE = 25;
/** Transactions rows per page until the reader picks another size. */
export const TRANSACTIONS_DEFAULT_PAGE_SIZE = 10;
export const GROUPS = ["employee", "jobNumber", "country", "customer", "travelAgent", "source", "costType", "month"] as const;
export type GroupBy = (typeof GROUPS)[number];
export type CostSort = "date" | "-date" | "amount" | "-amount";
export type CostMode = "charts" | "tables";

const PRESETS: readonly RangePreset[] = ["ytd", "l12m", "qtd", "lastq", "mtd", "lastm", "year", "custom"];

export interface CostView {
  readonly range: RangePreset;
  readonly year?: number;
  readonly period: DateRange;
  readonly compare: boolean;
  readonly mode: CostMode;
  /** Filter values by their URL key. */
  readonly filters: Readonly<Partial<Record<FilterKey, readonly string[]>>>;
  readonly group?: GroupBy;
  readonly sort: CostSort;
  readonly page: number;
}

export type CostViewPatch = Readonly<Record<string, string | undefined>>;

/** Joins the values of one filter in the address bar. Not a comma: a country or customer name may contain one. */
export const FILTER_SEP = "|";
// A value that contains the separator (or the escape itself) is escaped, so it reads back as the one value it was.
const escapeValue = (v: string): string => v.replace(/%/g, "%25").replace(/\|/g, "%7C");
const unescapeValue = (v: string): string => v.replace(/%7C/gi, "|").replace(/%25/g, "%");
/** One filter's values as the address bar holds them. */
export const joinFilter = (values: readonly string[]): string => values.map(escapeValue).join(FILTER_SEP);
const split = (v: string | undefined): string[] => (v ? v.split(FILTER_SEP).filter(Boolean).map(unescapeValue) : []);

/** The view the address bar describes. Unknown or malformed values read as the default. */
export function readCostView(raw: Readonly<Record<string, string>>, today: string): CostView {
  const range = (PRESETS as readonly string[]).includes(raw.tcRange) ? (raw.tcRange as RangePreset) : "ytd";
  const year = /^\d{4}$/.test(raw.tcYear ?? "") ? Number(raw.tcYear) : undefined;
  const validDay = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  const filters: Partial<Record<FilterKey, string[]>> = {};
  for (const k of FILTER_KEYS) if (raw[k]) filters[k] = split(raw[k]);
  const sort = (["date", "-date", "amount", "-amount"] as const).find((s) => s === raw.tcSort) ?? "-date";
  let period = rangeFor(range, today, { year, from: validDay(raw.tcFrom), to: validDay(raw.tcTo) });
  // A custom range from the address bar is checked like one typed into the controls: a reversed or too long one falls back to the year to date.
  if (range === "custom" && rangeProblem(period)) period = rangeFor("ytd", today);
  return {
    range,
    year,
    period,
    compare: raw.tcCompare !== "0",
    mode: raw.tcView === "tables" ? "tables" : "charts",
    filters,
    group: GROUPS.find((g) => g === raw.tcGroup),
    sort,
    page: Math.max(0, Math.floor(Number(raw.tcPage ?? 0)) || 0),
  };
}

/** The last page (0-based) of `total` rows; 0 when there are none. */
export const lastPage = (total: number, size = PAGE_SIZE): number => Math.max(0, Math.ceil(total / size) - 1);

/** `page` held to the pages that exist, e.g. `?tcPage=999` on 508 rows is page 20. */
export const clampPage = (page: number, total: number, size = PAGE_SIZE): number => Math.min(Math.max(0, page), lastPage(total, size));

/** `view` with the `patch` applied. An empty or undefined patch value removes the key; every key outside "tc" is kept. */
export function patchCostView(view: Readonly<Record<string, string>>, patch: CostViewPatch): Record<string, string> {
  const next: Record<string, string> = { ...view };
  // Any change other than the page itself sends the Transactions back to the first page.
  if (!("tcPage" in patch)) delete next.tcPage;
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === "") delete next[k];
    else next[k] = v;
  }
  return next;
}

/** Click on a bar or row: that filter takes this one value (replacing any), and the Transactions go back to the first page. */
export function drillPatch(key: FilterKey, value: string): CostViewPatch {
  return { [key]: escapeValue(value), tcPage: undefined };
}

/** The filter a chart's bar sends back, by the widget that draws it. */
export const DRILL_KEY = {
  source: "tcSource",
  country: "tcCountry",
  customer: "tcCustomer",
  travelAgent: "tcAgent",
  costType: "tcCostType",
  paid: "tcPaid",
} as const satisfies Record<string, FilterKey>;

/** The filter and range parameters every Travel Costs call takes. */
export function costParams(view: CostView): EngagementQueryParams {
  const out: Record<string, string | boolean | readonly string[] | undefined> = {
    from: view.period.from,
    to: view.period.to,
    compare: view.compare ? undefined : false,
  };
  for (const k of FILTER_KEYS) {
    const values = view.filters[k];
    if (!values?.length) continue;
    out[PARAM[k]] = k === "tcUnlinked" ? "true" : values;
  }
  return out;
}

/** The Transactions call: the same filters, plus Group By, Sort and the page. */
export function transactionParams(view: CostView, size = PAGE_SIZE): EngagementQueryParams {
  return { ...costParams(view), groupBy: view.group, sort: view.sort === "-date" ? undefined : view.sort, limit: size, offset: view.page * size };
}

/** How many filters are applied (for the Filters button's badge). */
export const filterCount = (view: CostView): number => FILTER_KEYS.filter((k) => view.filters[k]?.length).length;
