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

import { Route } from "react-router";
import { CALENDAR_CATEGORIES } from "./calendarCategories";
import { AllCalendarView, CategoryCalendarView } from "./pages/CalendarViews";

// The calendar's tabs, nested under its layout route in App.tsx: All at the
// calendar's own path, then one route per category (`/events`, `/content`, …).
// Exported apart from the layout so the tests mount the same tree.
export const marketingCalendarViewRoutes = (
  <>
    <Route index element={<AllCalendarView />} />
    {CALENDAR_CATEGORIES.map((style) => (
      <Route key={style.key} path={style.segment} element={<CategoryCalendarView category={style.key} />} />
    ))}
  </>
);
