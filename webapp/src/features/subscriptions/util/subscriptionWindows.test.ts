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

import { describe, expect, it } from "vitest";
import {
  actionWindow,
  isWithinDayRange,
  isWindowOpen,
  periodLabel,
} from "@features/subscriptions/util/subscriptionWindows";

// The deployed defaults, which are also the interesting cases: the opt-in
// window wraps across the month boundary (25 → 5) while the opt-out window
// does not (25 → 31).
const META = {
  optInStartDay: 25,
  optInEndDay: 5,
  optOutStartDay: 25,
  optOutEndDay: 31,
};

/** Local midday, so no timezone shift can move the day of the month. */
function on(year: number, month1: number, day: number): Date {
  return new Date(year, month1 - 1, day, 12, 0, 0);
}

describe("isWithinDayRange", () => {
  it("treats a non-wrapping window as an inclusive range", () => {
    expect(isWithinDayRange(25, 31, 25)).toBe(true);
    expect(isWithinDayRange(25, 31, 31)).toBe(true);
    expect(isWithinDayRange(25, 31, 24)).toBe(false);
  });

  it("treats a wrapping window as a union, not an empty range", () => {
    // The bug this guards: reading 25 → 5 as `day >= 25 && day <= 5` is never
    // true, which would close the opt-in window permanently.
    expect(isWithinDayRange(25, 5, 26)).toBe(true);
    expect(isWithinDayRange(25, 5, 3)).toBe(true);
    expect(isWithinDayRange(25, 5, 5)).toBe(true);
    expect(isWithinDayRange(25, 5, 6)).toBe(false);
    expect(isWithinDayRange(25, 5, 24)).toBe(false);
  });

  it("handles a single-day window", () => {
    expect(isWithinDayRange(10, 10, 10)).toBe(true);
    expect(isWithinDayRange(10, 10, 11)).toBe(false);
  });
});

describe("isWindowOpen", () => {
  it("reads the day of the month from the supplied instant", () => {
    expect(isWindowOpen(25, 5, on(2026, 9, 28))).toBe(true);
    expect(isWindowOpen(25, 5, on(2026, 9, 12))).toBe(false);
  });
});

describe("periodLabel", () => {
  it("keeps a non-wrapping window inside one month", () => {
    expect(periodLabel(25, 31, on(2026, 9, 12))).toBe("25 Sep to 31 Sep");
  });

  it("names the next month for a window that wraps", () => {
    expect(periodLabel(25, 5, on(2026, 9, 12))).toBe("25 Sep to 5 Oct");
  });

  it("rolls the year over at December", () => {
    expect(periodLabel(25, 5, on(2026, 12, 28))).toBe("25 Dec to 5 Jan");
  });
});

describe("actionWindow", () => {
  it("governs a subscriber by the opt-OUT window", () => {
    const w = actionWindow(META, true, on(2026, 9, 28));
    expect(w.action).toBe("opt out");
    expect(w.open).toBe(true);
    expect(w.label).toBe("25 Sep to 31 Sep");
    // The reverse window is what the dialog offers as the way back.
    expect(w.reverseLabel).toBe("25 Sep to 5 Oct");
  });

  it("governs a non-subscriber by the opt-IN window", () => {
    const w = actionWindow(META, false, on(2026, 10, 3));
    expect(w.action).toBe("opt in");
    // Day 3 is inside the wrapped opt-in window but outside opt-out — the
    // case that proves the right window was chosen, not just any open one.
    expect(w.open).toBe(true);
    expect(actionWindow(META, true, on(2026, 10, 3)).open).toBe(false);
  });

  it("closes both windows mid-month", () => {
    expect(actionWindow(META, false, on(2026, 9, 12)).open).toBe(false);
    expect(actionWindow(META, true, on(2026, 9, 12)).open).toBe(false);
  });
});
