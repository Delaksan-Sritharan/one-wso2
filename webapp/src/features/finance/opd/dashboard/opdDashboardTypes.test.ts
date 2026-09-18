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

import { describe, it, expect } from "vitest";
import {
  claimLimitOf,
  utilizationName,
  utilizationPercent,
  utilizationTone,
  type OpdUtilizationRow,
} from "./opdDashboardTypes";

const row = (over: Partial<OpdUtilizationRow> = {}): OpdUtilizationRow => ({
  employeeEmail: "someone@wso2.com",
  firstName: "Some",
  lastName: "One",
  submittedAmount: 1000,
  claimLimit: 40000,
  percentUsed: 2.5,
  ...over,
});

describe("who a row is about", () => {
  it("uses the name when there is one", () => {
    expect(utilizationName(row())).toBe("Some One");
  });

  // An employee with no name on file is still somebody whose spend finance
  // needs to see, so the row must never come out blank.
  it("falls back to the work email", () => {
    expect(utilizationName(row({ firstName: "", lastName: "" }))).toBe("someone@wso2.com");
  });

  it("copes with only one of the two names", () => {
    expect(utilizationName(row({ lastName: "" }))).toBe("Some");
  });
});

describe("the percentage shown", () => {
  it("rounds", () => {
    expect(utilizationPercent(80.6)).toBe(81);
  });

  // The backend divides submitted by the limit, so a corrected claim can put
  // this above 100 and a zero limit makes it Infinity. Neither is a number to
  // put in front of anyone.
  it("clamps above 100", () => {
    expect(utilizationPercent(140)).toBe(100);
  });

  it("clamps below zero", () => {
    expect(utilizationPercent(-5)).toBe(0);
  });

  it("survives a non-finite value", () => {
    expect(utilizationPercent(Infinity)).toBe(0);
    expect(utilizationPercent(NaN)).toBe(0);
  });
});

// ClaimUtilizationTable.tsx:86 — 90 and over is over-spend territory, 70 and
// over is worth noticing, below that is unremarkable.
describe("the colour band", () => {
  it("marks 90% and over as high", () => {
    expect(utilizationTone(90)).toBe("high");
    expect(utilizationTone(99.9)).toBe("high");
  });

  it("marks 70% up to 90% as medium", () => {
    expect(utilizationTone(70)).toBe("medium");
    expect(utilizationTone(89.9)).toBe("medium");
  });

  it("leaves anything under 70% unmarked", () => {
    expect(utilizationTone(69.9)).toBe("normal");
    expect(utilizationTone(0)).toBe("normal");
  });
});

describe("the limit quoted beside the title", () => {
  it("is read off the first row", () => {
    expect(claimLimitOf([row(), row({ claimLimit: 999 })])).toBe(40000);
  });

  // With no rows there is no limit to quote, and inventing one would put a
  // figure on screen the backend never said.
  it("is absent when nobody has claimed", () => {
    expect(claimLimitOf([])).toBeNull();
  });
});
