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
import { addMonths, currentMonth, isoDate, isoMonth, monthGridWeeks, parseIsoMonth } from "./calendarDates";

const gridRange = (year: number, month: number) => {
  const weeks = monthGridWeeks({ year, month });
  return { from: isoDate(weeks[0][0]), to: isoDate(weeks[weeks.length - 1][6]), weekCount: weeks.length };
};

describe("monthGridWeeks", () => {
  it("runs Monday to Sunday and includes the neighbouring months' days", () => {
    // 1 November 2026 is a Sunday, so the grid opens on Monday 26 October.
    expect(gridRange(2026, 11)).toEqual({ from: "2026-10-26", to: "2026-12-06", weekCount: 6 });
  });

  it("needs only four weeks for a February that starts on a Monday", () => {
    expect(gridRange(2027, 2)).toEqual({ from: "2027-02-01", to: "2027-02-28", weekCount: 4 });
  });

  it("crosses the year end", () => {
    expect(gridRange(2026, 12)).toEqual({ from: "2026-11-30", to: "2027-01-03", weekCount: 5 });
  });

  it("has seven days in every week, each one day after the last", () => {
    const days = monthGridWeeks({ year: 2028, month: 2 }).flat().map(isoDate);
    expect(days).toContain("2028-02-29");
    for (let i = 1; i < days.length; i++) {
      const gap = Date.parse(days[i]) - Date.parse(days[i - 1]);
      expect(gap).toBe(86_400_000);
    }
  });
});

describe("months", () => {
  it("steps across year ends both ways", () => {
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(addMonths({ year: 2027, month: 1 }, -1)).toEqual({ year: 2026, month: 12 });
    expect(addMonths({ year: 2026, month: 11 }, -23)).toEqual({ year: 2024, month: 12 });
  });

  it("reads back only a real YYYY-MM", () => {
    expect(parseIsoMonth("2026-11")).toEqual({ year: 2026, month: 11 });
    expect(parseIsoMonth("2026-13")).toBeNull();
    expect(parseIsoMonth("2026-1")).toBeNull();
    expect(parseIsoMonth(null)).toBeNull();
    expect(isoMonth({ year: 2026, month: 3 })).toBe("2026-03");
  });

  it("takes the current month from the reader's local clock", () => {
    expect(currentMonth(new Date(2026, 10, 30, 23, 30))).toEqual({ year: 2026, month: 11 });
  });
});
