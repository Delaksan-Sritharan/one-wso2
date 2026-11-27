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

import { beforeEach, describe, expect, it } from "vitest";
import { backTarget, clearVisits, lastVisitedList, rememberVisit } from "./backTarget";

const A = "/finance/engagement-app";

describe("backTarget", () => {
  beforeEach(clearVisits);

  it("returns to the list's tab, search and page it was left on", () => {
    rememberVisit(`${A}/engagements/customer`);
    rememberVisit(`${A}/engagements/internal?q=zurich&page=2`);
    rememberVisit(`${A}/engagements/E06393/allocations`);
    rememberVisit(`${A}/engagements/E06393/details`);
    expect(backTarget(`${A}/engagements`, `${A}/engagements/E06393/details`)).toBe(`${A}/engagements/internal?q=zurich&page=2`);
  });

  it("returns to a list with no tabs with its query", () => {
    rememberVisit("/me/travel-requests?q=london");
    rememberVisit("/me/travel-requests/TRV-1/info");
    expect(backTarget("/me/travel-requests", "/me/travel-requests/TRV-1/info")).toBe("/me/travel-requests?q=london");
  });

  it("returns to the page tab last seen, not the default one", () => {
    rememberVisit(`${A}/engagements/E1/allocations`);
    rememberVisit(`${A}/engagements/E1/details`);
    rememberVisit(`${A}/engagements/E1/edit`);
    expect(backTarget(`${A}/engagements/E1/allocations`, `${A}/engagements/E1/edit`)).toBe(`${A}/engagements/E1/details`);
  });

  it("never returns to an Edit or Allocate form, which would bounce between the two", () => {
    rememberVisit(`${A}/engagements/E1/allocations`);
    rememberVisit(`${A}/engagements/E1/edit`);
    rememberVisit(`${A}/engagements/E1/allocate`);
    expect(backTarget(`${A}/engagements/E1/allocations`, `${A}/engagements/E1/allocate`)).toBe(`${A}/engagements/E1/allocations`);
    expect(backTarget(`${A}/engagements/E1/allocations`, `${A}/engagements/E1/edit`)).toBe(`${A}/engagements/E1/allocations`);
    clearVisits();
    rememberVisit(`${A}/engagements/E1/edit`);
    expect(backTarget(`${A}/engagements/E1/allocations`, `${A}/engagements/E1/allocate`)).toBe(`${A}/engagements/E1/allocations`);
  });

  it("never takes another section for a list", () => {
    rememberVisit(`${A}/approvals/internal`);
    expect(backTarget(`${A}/engagements`, `${A}/engagements/E1/allocations`)).toBe(`${A}/engagements`);
  });

  it("names the list a record was opened from, not just the first one", () => {
    const lists = [`${A}/engagements`, `${A}/approvals`, `${A}/search`].map((to) => ({ to }));
    rememberVisit(`${A}/engagements/customer`);
    rememberVisit(`${A}/approvals/internal`);
    rememberVisit(`${A}/engagements/E1/details`);
    expect(lastVisitedList(lists)?.to).toBe(`${A}/approvals`);
    rememberVisit(`${A}/search?q=zurich`);
    expect(lastVisitedList(lists)?.to).toBe(`${A}/search`);
    clearVisits();
    expect(lastVisitedList(lists)).toBeUndefined();
  });

  it("falls back to the link's own target when the list was not seen", () => {
    expect(backTarget(`${A}/travel-requests`, `${A}/travel-requests/TRV-1/info`)).toBe(`${A}/travel-requests`);
  });
});
