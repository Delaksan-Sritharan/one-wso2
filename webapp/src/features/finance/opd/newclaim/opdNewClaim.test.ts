/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { describe, expect, it } from "vitest";
import {
  OPD_COPY,
  amountCapMessage,
  billsTotal,
  breaksSameYearRule,
  draftRestoreRefusal,
  maxAllowedAmount,
  spentPercent,
  yearOf,
} from "./opdNewClaim";
import type { OpdTransaction } from "../opdTypes";

const bill = (date: string, amount: number): OpdTransaction => ({
  date,
  amount,
  comment: "Consultation",
  receiptUrl: "r.pdf",
});

describe("what the bills come to", () => {
  it("is zero before anything is added", () => {
    expect(billsTotal([])).toBe(0);
  });

  it("adds every bill on screen", () => {
    expect(billsTotal([bill("2026-03-01", 1200), bill("2026-03-04", 800)])).toBe(2000);
  });
});

// ExpenseForm.tsx:75-87 — the cap is the year's remaining balance less what is
// already listed, so a claim cannot be built past the allowance one bill at a
// time.
describe("the most a bill may be", () => {
  const items = [bill("2026-03-01", 1200), bill("2026-03-04", 800)];

  it("is the whole remaining balance when nothing is listed", () => {
    expect(maxAllowedAmount(5000, [], null)).toBe(5000);
  });

  it("drops by what is already listed", () => {
    expect(maxAllowedAmount(5000, items, null)).toBe(3000);
  });

  // The one that bites: without this, opening a bill and pressing Update
  // without changing anything is refused, because its own amount is counted
  // against the limit it is being checked against.
  it("gives back the amount of the bill being edited", () => {
    // Editing the 1200 bill leaves only the 800 counted, and vice versa.
    expect(maxAllowedAmount(5000, items, 0)).toBe(4200);
    expect(maxAllowedAmount(5000, items, 1)).toBe(3800);
  });

  it("writes the cap to two decimals, as the source does", () => {
    expect(amountCapMessage(3000)).toBe("Amount cannot exceed available limit of 3,000.00");
  });
});

// ExpenseForm.tsx:129-144. The picker's bounds steer this, but the date field
// is typeable, so the rule is enforced rather than implied.
describe("the single-year rule", () => {
  it("accepts anything as the first bill", () => {
    expect(breaksSameYearRule([], "2019-07-04")).toBe(false);
  });

  it("accepts another bill from the same year", () => {
    expect(breaksSameYearRule([bill("2026-03-01", 100)], "2026-12-31")).toBe(false);
  });

  it("refuses one from a different year", () => {
    expect(breaksSameYearRule([bill("2026-03-01", 100)], "2025-12-31")).toBe(true);
  });

  it("reads the year off the date rather than a clock", () => {
    expect(yearOf("2024-01-01")).toBe("2024");
  });
});

// NewClaim.tsx:79-100 — both refusals, in the source's order and wording.
describe("restoring a saved draft", () => {
  it("is allowed onto an empty claim", () => {
    expect(draftRestoreRefusal([bill("2026-03-01", 100)], [])).toBeNull();
  });

  it("is allowed when the years agree", () => {
    expect(
      draftRestoreRefusal([bill("2026-03-01", 100)], [bill("2026-09-09", 50)]),
    ).toBeNull();
  });

  it("is refused when the draft itself spans two years", () => {
    expect(
      draftRestoreRefusal([bill("2026-03-01", 100), bill("2025-11-02", 100)], []),
    ).toBe(OPD_COPY.draftMultiYear);
  });

  // Checked before the claim's own year, so a draft that is broken on its own
  // says so rather than blaming what is on screen.
  it("says the draft is at fault even when the claim disagrees too", () => {
    expect(
      draftRestoreRefusal(
        [bill("2026-03-01", 100), bill("2025-11-02", 100)],
        [bill("2024-01-01", 10)],
      ),
    ).toBe(OPD_COPY.draftMultiYear);
  });

  it("is refused when the claim on screen is from another year", () => {
    expect(
      draftRestoreRefusal([bill("2026-03-01", 100)], [bill("2025-09-09", 50)]),
    ).toBe(OPD_COPY.draftOtherYear);
  });

  it("has nothing to refuse when the draft is empty", () => {
    expect(draftRestoreRefusal([], [bill("2026-03-01", 100)])).toBeNull();
  });
});

// ClaimOverviewer.tsx:38-40 divides claimed by the limit and does not clamp.
describe("how full the allowance bar is", () => {
  it("is the share of the limit already claimed", () => {
    expect(spentPercent(12000, 50000)).toBe(24);
  });

  it("does not run past the end of the bar", () => {
    expect(spentPercent(60000, 50000)).toBe(100);
  });

  // A limit of zero gives the source Infinity, and a bar drawn off the page.
  it("stays at zero when there is no limit to divide by", () => {
    expect(spentPercent(100, 0)).toBe(0);
  });

  it("does not go negative", () => {
    expect(spentPercent(-5, 50000)).toBe(0);
  });
});
