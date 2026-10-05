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

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatJobBand,
  joinedBand,
  latestPromotion,
  monthsSince,
  promotionSummary,
  sortPromotionsByBand,
} from "./promotionHistory";
import type { PromotionHistoryEntry } from "../api/types";

afterEach(() => {
  vi.useRealTimers();
});

// Minimal approved-request fixture; only the fields the ordering and the
// summary line read are meaningful.
function entry(p: Partial<PromotionHistoryEntry> = {}): PromotionHistoryEntry {
  return {
    id: 1,
    employeeEmail: "someone@wso2.com",
    currentJobBand: 4,
    currentJobRole: "Senior Software Engineer",
    nextJobBand: 5,
    promotionCycle: "2021-H1",
    promotionStatement: null,
    businessUnit: "Engineering",
    department: "Platform",
    team: "Integration",
    subTeam: null,
    promotionType: "NORMAL",
    status: "APPROVED",
    createdOn: "2021-03-01",
    updatedOn: "2021-04-22",
    ...p,
  };
}

describe("sortPromotionsByBand", () => {
  it("puts the highest job band first", () => {
    const sorted = sortPromotionsByBand([
      entry({ id: 1, nextJobBand: 5 }),
      entry({ id: 2, nextJobBand: 7 }),
      entry({ id: 3, nextJobBand: 6 }),
    ]);
    expect(sorted.map((e) => e.nextJobBand)).toEqual([7, 6, 5]);
  });

  it("ignores updatedOn when ordering", () => {
    // The bug this pins: an admin editing an old approved request bumps its
    // updatedOn, which under a timestamp sort would promote a 2021 record
    // above a genuinely later 2023 one.
    const sorted = sortPromotionsByBand([
      entry({ id: 1, nextJobBand: 5, promotionCycle: "2021-H1", updatedOn: "2026-09-18" }),
      entry({ id: 2, nextJobBand: 6, promotionCycle: "2023-H2", updatedOn: "2023-11-14" }),
    ]);
    expect(sorted[0].promotionCycle).toBe("2023-H2");
  });

  it("breaks ties on id, newest first", () => {
    const sorted = sortPromotionsByBand([
      entry({ id: 7, nextJobBand: 6 }),
      entry({ id: 9, nextJobBand: 6 }),
    ]);
    expect(sorted.map((e) => e.id)).toEqual([9, 7]);
  });

  it("leaves the caller's array untouched", () => {
    const list = [entry({ id: 1, nextJobBand: 5 }), entry({ id: 2, nextJobBand: 7 })];
    sortPromotionsByBand(list);
    expect(list.map((e) => e.id)).toEqual([1, 2]);
  });
});

describe("latestPromotion", () => {
  it("returns the highest band on record", () => {
    const top = latestPromotion([
      entry({ id: 1, nextJobBand: 5 }),
      entry({ id: 2, nextJobBand: 6, promotionCycle: "2023-H2" }),
    ]);
    expect(top?.promotionCycle).toBe("2023-H2");
  });

  it("returns null when nothing is approved", () => {
    // Drives the "No promotions" line rather than a false date.
    expect(latestPromotion([])).toBeNull();
    expect(latestPromotion(undefined)).toBeNull();
  });
});

describe("promotionSummary", () => {
  it("names the cycle and the band jump", () => {
    expect(
      promotionSummary(entry({ promotionCycle: "2023-H2", currentJobBand: 5, nextJobBand: 6 })),
    ).toBe("2023-H2 · JB 5 → 6");
  });
});

describe("monthsSince", () => {
  it("excludes the incomplete month", () => {
    // The bug this pins: a promotion dated yesterday should not already
    // read as "1 mo" just because the calendar month ticked over.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00"));
    expect(monthsSince("2026-09-30")).toBe(0);
  });

  it("counts whole months once the day has passed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00"));
    expect(monthsSince("2026-07-01")).toBe(3);
  });

  it("returns null for a missing or unparseable date", () => {
    expect(monthsSince(null)).toBeNull();
    expect(monthsSince(undefined)).toBeNull();
    expect(monthsSince("not-a-date")).toBeNull();
  });

  it("never goes negative for a future date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00"));
    expect(monthsSince("2026-06-01")).toBe(0);
  });
});

describe("formatJobBand", () => {
  it("prefixes a real band with JB", () => {
    expect(formatJobBand(5)).toBe("JB5");
  });

  it("shows a plain dash for a missing band, never \"JB—\"", () => {
    expect(formatJobBand(null)).toBe("—");
    expect(formatJobBand(undefined)).toBe("—");
  });
});

describe("joinedBand", () => {
  it("reads the lowest band off the (highest-first sorted) history", () => {
    const sorted = sortPromotionsByBand([
      entry({ currentJobBand: 4, nextJobBand: 5 }),
      entry({ currentJobBand: 5, nextJobBand: 6 }),
    ]);
    expect(joinedBand(sorted, 99)).toBe(4);
  });

  it("falls back to the current band when there is no promotion history", () => {
    expect(joinedBand([], 3)).toBe(3);
    expect(joinedBand([], null)).toBeNull();
  });
});
