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
import { filterHistoryChainEmployees } from "./parHistoryChain";
import type { ParEmployee } from "../api/types";

function employee(overrides: Partial<ParEmployee>): ParEmployee {
  return {
    employeeName: "Jane Doe",
    workEmail: "jane@wso2.com",
    isLead: false,
    ...overrides,
  };
}

describe("filterHistoryChainEmployees", () => {
  it("matches the search term against name or email", () => {
    const rows = [employee({ workEmail: "jane@wso2.com", employeeName: "Jane Doe" })];
    expect(filterHistoryChainEmployees(rows, "jane", false)).toHaveLength(1);
    expect(filterHistoryChainEmployees(rows, "Doe", false)).toHaveLength(1);
    expect(filterHistoryChainEmployees(rows, "amy", false)).toHaveLength(0);
  });

  it("keeps every row when showLeadsOnly is false", () => {
    const rows = [employee({ isLead: false }), employee({ isLead: true })];
    expect(filterHistoryChainEmployees(rows, "", false)).toHaveLength(2);
  });

  it("keeps only leads when showLeadsOnly is true", () => {
    const rows = [employee({ isLead: false }), employee({ isLead: true })];
    const filtered = filterHistoryChainEmployees(rows, "", true);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].isLead).toBe(true);
  });

  it("treats a missing isLead as not a lead", () => {
    const rows = [employee({ isLead: undefined })];
    expect(filterHistoryChainEmployees(rows, "", true)).toHaveLength(0);
  });

  it("combines the search and leads-only filters", () => {
    const rows = [
      employee({ workEmail: "jane@wso2.com", isLead: true }),
      employee({ workEmail: "jane2@wso2.com", isLead: false }),
      employee({ employeeName: "Amy Lee", workEmail: "amy@wso2.com", isLead: true }),
    ];
    expect(filterHistoryChainEmployees(rows, "jane", true)).toHaveLength(1);
  });
});
