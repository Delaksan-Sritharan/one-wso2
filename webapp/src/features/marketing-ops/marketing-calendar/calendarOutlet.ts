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

import { useOutletContext } from "react-router";
import type { RoutedTabDef } from "@components/routed-tabs/RoutedTabs";
import { CALENDAR_CATEGORIES } from "./calendarCategories";
import type { CalendarMonth, CivilDate } from "./calendarDates";
import type { CalendarRange } from "./calendarRange";
import type { CalendarItem } from "./marketingCalendarTypes";

// The calendar's tabs, and what the shared layout hands each of them. The layout
// owns the one items query, so every tab reads the same fetch and switching tab
// makes no request.

export const MARKETING_CALENDAR_PATH = "/marketing-ops/marketing-calendar";

// All is the index route, at the calendar's own path.
export const CALENDAR_TABS: readonly RoutedTabDef[] = [
  { segment: "", label: "All" },
  ...CALENDAR_CATEGORIES.map((style) => ({ segment: style.segment, label: style.pluralLabel })),
];

// How every tab draws its items: the month grid (the default), or a list by day
// over a date range (`?view=list`).
export type CalendarDisplay = "calendar" | "list";

export interface CalendarOutletContext {
  month: CalendarMonth;
  weeks: CivilDate[][];
  view: CalendarDisplay;
  range: CalendarRange;
  // Every category's items for the drawn grid, or in List for the range; empty
  // until the first fetch lands.
  items: CalendarItem[];
  // The fetch has succeeded, so an empty view really is empty.
  loaded: boolean;
  // Sets (a string) or removes (null) query parameters, keeping the rest.
  updateSearchParams: (changes: Record<string, string | null>) => void;
  openItem: (item: CalendarItem) => void;
}

export function useCalendarOutlet(): CalendarOutletContext {
  return useOutletContext<CalendarOutletContext>();
}
