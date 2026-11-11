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

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RunPicker } from "./BudgetSyncRunPicker";
import type { BudgetSyncRunSummary } from "../budgetSyncTypes";

const BASE_RUN: BudgetSyncRunSummary = {
  id: "run-1",
  spreadsheet_id: "ss-1",
  budget_year: 2026,
  reviewed_month: 9,
  ruleset_version: "v3",
  generated_at: "2026-11-01T10:00:00Z",
  generated_by: null,
  received_at: "2026-11-01T10:05:00Z",
  total_month: 50000,
  total_month_buffer: 5000,
  missing_sheets: [],
  warnings: [],
};

function renderPicker(overrides: Partial<BudgetSyncRunSummary> = {}) {
  return render(
    <RunPicker
      run={{ ...BASE_RUN, ...overrides }}
      years={[2026]}
      monthsForYear={() => [9]}
      onSelect={vi.fn()}
    />,
  );
}

describe("RunPicker caption attribution", () => {
  it("shows '· by <name>' when generated_by is set", () => {
    renderPicker({ generated_by: "alice@wso2.com" });
    expect(screen.getByText(/·\s*by alice@wso2\.com/)).toBeInTheDocument();
  });

  it("omits the attribution when generated_by is null", () => {
    renderPicker({ generated_by: null });
    expect(screen.queryByText(/·\s*by\s/)).not.toBeInTheDocument();
  });
});
