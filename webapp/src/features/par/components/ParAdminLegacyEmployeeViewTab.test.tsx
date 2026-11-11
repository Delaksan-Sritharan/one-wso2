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
import { render, screen } from "@testing-library/react";
import type { DataGrid } from "@wso2/oxygen-ui";
import ParAdminLegacyEmployeeViewTab from "./ParAdminLegacyEmployeeViewTab";
import type { ParLegacyHistory } from "../api/types";

function legacyRecord(overrides: Partial<ParLegacyHistory> = {}): ParLegacyHistory {
  return {
    legacyHeaderId: 1,
    employeeEmail: "jane@wso2.com",
    employeeName: "Jane Doe",
    location: null,
    businessUnit: "Engineering",
    department: "Platform",
    team: "Core",
    subTeam: null,
    reviewerName: "Lead One",
    reviewerEmail: null,
    cycleName: "2016 Quarterly Review - Q3/Q4",
    reviewCompletedDate: null,
    overallRating: null,
    overallSpecialRating: null,
    overallCommentEmployee: null,
    overallCommentManager: null,
    employeeScoreCode: null,
    managerScoreCode: 3,
    employeeHasQuestionAnswer: false,
    questionAnswers: null,
    feedback360: null,
    ...overrides,
  };
}

// Kept in the cycle's order: department, lead, email, then name matches,
// so the name match starts last and has to be moved up by the search.
const records = [
  legacyRecord({ legacyHeaderId: 1, employeeName: "Amal Perera", employeeEmail: "amal@wso2.com", department: "Kasun Labs", reviewerName: "Lead One" }),
  legacyRecord({ legacyHeaderId: 2, employeeName: "Nimal Silva", employeeEmail: "nimal@wso2.com", reviewerName: "Kasun Fernando" }),
  legacyRecord({ legacyHeaderId: 3, employeeName: "Ruwan Jayasinghe", employeeEmail: "kasunj@wso2.com", reviewerName: "Lead One" }),
  legacyRecord({ legacyHeaderId: 4, employeeName: "Kasun Fernando", employeeEmail: "kfernando@wso2.com", reviewerName: "Lead Two" }),
  legacyRecord({ legacyHeaderId: 5, employeeName: "Saman Kumara", employeeEmail: "saman@wso2.com", reviewerName: "Lead Two" }),
];

function show(searchText: string, sortModel: DataGrid.GridSortModel = [], rows: ParLegacyHistory[] = records) {
  render(
    <ParAdminLegacyEmployeeViewTab
      records={rows}
      searchText={searchText}
      onSearchTextChange={() => {}}
      paginationModel={{ page: 0, pageSize: 10 }}
      onPaginationModelChange={() => {}}
      sortModel={sortModel}
      onSortModelChange={() => {}}
      thumbnailFor={() => undefined}
      onOpenRecord={() => {}}
    />,
  );
}

// The Employee Name cell of every row, top to bottom.
const shownNames = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => row.querySelector('[data-field="employeeName"]')?.textContent);

describe("ParAdminLegacyEmployeeViewTab search", () => {
  it("lists employee-name matches first, then email, lead and department matches", () => {
    show("kasun");

    expect(shownNames()).toEqual(["Kasun Fernando", "Ruwan Jayasinghe", "Nimal Silva", "Amal Perera"]);
  });

  it("keeps the cycle's order within the same rank", () => {
    show("lead one");

    expect(shownNames()).toEqual(["Amal Perera", "Ruwan Jayasinghe"]);
  });

  it("shows every record in the cycle's order when the search is empty", () => {
    show("  ");

    expect(shownNames()).toEqual(["Amal Perera", "Nimal Silva", "Ruwan Jayasinghe", "Kasun Fernando", "Saman Kumara"]);
  });

  it("ranks a nameless row's email match as an email match, not a name match", () => {
    const rows = [
      legacyRecord({ legacyHeaderId: 1, employeeName: null, employeeEmail: "kasun@wso2.com" }),
      legacyRecord({ legacyHeaderId: 2, employeeName: "Kasun Fernando", employeeEmail: "kf@wso2.com" }),
    ];
    show("kasun", [], rows);

    expect(shownNames()).toEqual(["Kasun Fernando", "-"]);
  });

  it("lets a column sort the admin picks override the ranking", () => {
    show("kasun", [{ field: "employeeName", sort: "asc" }]);

    expect(shownNames()).toEqual(["Amal Perera", "Kasun Fernando", "Nimal Silva", "Ruwan Jayasinghe"]);
  });
});
