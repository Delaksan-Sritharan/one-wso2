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

import type { ReactNode } from "react";
import { Navigate, useSearchParams } from "react-router";
import { Box, Typography } from "@wso2/oxygen-ui";
import {
  ClearFiltersButton,
  MultiSelectFilter,
} from "../../ad-campaigns/campaign-tracker/components/FilterControls";
import { CALENDAR_CATEGORIES, categoryStyle, parseCategory } from "../calendarCategories";
import { monthTitle, type CalendarMonth } from "../calendarDates";
import { MARKETING_CALENDAR_PATH, useCalendarOutlet, type CalendarDisplay } from "../calendarOutlet";
import { shortDate, type CalendarRange } from "../calendarRange";
import {
  categoryFilterState,
  filterItems,
  listParamValue,
  SHOW_PARAM,
  showParamValue,
  shownCategories,
} from "../filterItems";
import type { CalendarCategory } from "../marketingCalendarTypes";
import CategoryLegendFilter from "../components/CategoryLegendFilter";
import ItemList from "../components/ItemList";
import MonthGrid from "../components/MonthGrid";

// The calendar's tab bodies. Each draws its filters and the month grid (or in
// List, the item list) over the items the layout has already fetched;
// filterItems decides what shows.

const LEGACY_CATEGORY_PARAM = "category";

/** All: every category, narrowed by the legend (`?show=`). */
export function AllCalendarView() {
  const { month, weeks, view, range, items, loaded, updateSearchParams, openItem } = useCalendarOutlet();
  const [searchParams] = useSearchParams();

  // `?category=event` is how a link from before the tabs named a category. It now
  // opens that category's tab, keeping the rest of the query (the month). Any
  // other value (`all`, or one never valid) just drops the parameter.
  if (searchParams.has(LEGACY_CATEGORY_PARAM)) {
    const legacy = parseCategory(searchParams.get(LEGACY_CATEGORY_PARAM));
    const rest = new URLSearchParams(searchParams);
    rest.delete(LEGACY_CATEGORY_PARAM);
    const pathname = legacy
      ? `${MARKETING_CALENDAR_PATH}/${categoryStyle(legacy).segment}`
      : MARKETING_CALENDAR_PATH;
    const search = rest.toString();
    return <Navigate to={{ pathname, search: search ? `?${search}` : "" }} replace />;
  }

  const shown = shownCategories(searchParams);
  const shownItems = filterItems(items, "all", searchParams);
  const filtered = shown.length < CALENDAR_CATEGORIES.length;

  return (
    <>
      <CategoryLegendFilter
        shown={shown}
        onChange={(next) => updateSearchParams({ [SHOW_PARAM]: showParamValue(next) })}
      />
      {loaded && shownItems.length === 0 && (
        <EmptyNote>
          Nothing planned {period(view, month, range)}
          {filtered ? " with these filters" : ""}.
        </EmptyNote>
      )}
      {view === "list" ? (
        <ItemList items={shownItems} onOpenItem={openItem} />
      ) : (
        <MonthGrid month={month} weeks={weeks} items={shownItems} onOpenItem={openItem} />
      )}
    </>
  );
}

/** One category's tab: its items, narrowed by its own filters. */
export function CategoryCalendarView({ category }: { category: CalendarCategory }) {
  const { month, weeks, view, range, items, loaded, updateSearchParams, openItem } = useCalendarOutlet();
  const [searchParams] = useSearchParams();

  const filters = categoryFilterState(items, category, searchParams);
  const shownItems = filterItems(items, category, searchParams);
  const activeCount = filters.filter((state) => state.selected.length > 0).length;
  const clearFilters = () =>
    updateSearchParams(Object.fromEntries(filters.map((state) => [state.filter.param, null])));

  return (
    <>
      <Box sx={{ display: "flex", alignItems: "flex-end", flexWrap: "wrap", gap: 1.5, mb: 2 }}>
        {filters.map(({ filter, options, selected }) => (
          <MultiSelectFilter
            key={filter.param}
            label={filter.label}
            options={options}
            selected={selected}
            onChange={(values) => updateSearchParams({ [filter.param]: listParamValue(values) })}
          />
        ))}
        {activeCount > 0 && <ClearFiltersButton activeCount={activeCount} onClear={clearFilters} />}
      </Box>
      {loaded && shownItems.length === 0 && (
        <EmptyNote>
          No {categoryStyle(category).noun} planned {period(view, month, range)}
          {activeCount > 0 ? " with these filters" : ""}.
        </EmptyNote>
      )}
      {view === "list" ? (
        <ItemList items={shownItems} onOpenItem={openItem} />
      ) : (
        <MonthGrid month={month} weeks={weeks} items={shownItems} onOpenItem={openItem} />
      )}
    </>
  );
}

// The empty state names the view and says when its filters are what emptied it.
function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
      {children}
    </Typography>
  );
}

// What the empty state says was searched: "for November 2026", or in List
// "between 1 Nov 2026 and 30 Nov 2026".
function period(view: CalendarDisplay, month: CalendarMonth, range: CalendarRange): string {
  return view === "list"
    ? `between ${shortDate(range.from)} and ${shortDate(range.to)}`
    : `for ${monthTitle(month)}`;
}
