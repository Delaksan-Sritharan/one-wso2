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
import type { ParCycleConfigurations } from "../api/types";
import { cleanDepartments, departmentDeadlinesProblem, employeeDeadlineFor, needsNoEvidence } from "./parDepartments";

const configurations = {
  evidenceExemptDepartments: ["FIELD OPS", "PARTNER OPS"],
  departmentEmployeeDeadlines: [{ department: "FIELD OPS", deadline: "2027-07-08" }],
} as ParCycleConfigurations;
const cycle = { parEmployeeDeadline: "2027-07-05", parCycleConfigurations: configurations };

describe("employeeDeadlineFor", () => {
  it("is the department's own, by name whatever the case or spaces, or the cycle's", () => {
    expect(employeeDeadlineFor(cycle, " Field Ops ")).toBe("2027-07-08");
    expect(employeeDeadlineFor(cycle, "FIELD OPS ENGINEERING")).toBe("2027-07-05");
    expect(employeeDeadlineFor(cycle, undefined)).toBe("2027-07-05");
    expect(employeeDeadlineFor({ ...cycle, parCycleConfigurations: {} as ParCycleConfigurations }, "FIELD OPS")).toBe(
      "2027-07-05",
    );
  });
});

describe("needsNoEvidence", () => {
  it("is only for the departments named", () => {
    expect(needsNoEvidence(configurations, "partner ops")).toBe(true);
    expect(needsNoEvidence(configurations, "FIELD OPS ENGINEERING")).toBe(false);
    expect(needsNoEvidence(configurations, undefined)).toBe(false);
    expect(needsNoEvidence(undefined, "FIELD OPS")).toBe(false);
  });
});

describe("cleanDepartments", () => {
  it("trims each name and leaves out a blank or repeated one", () => {
    expect(cleanDepartments([" FIELD OPS ", "", "field ops", "PARTNER OPS"])).toEqual(["FIELD OPS", "PARTNER OPS"]);
  });
});

describe("departmentDeadlinesProblem", () => {
  const dates = { evaluationStart: "2027-06-01", evaluationEnd: "2027-07-31", leadDeadline: "2027-07-15" };

  it("needs a department, once, and a date in the evaluation before the lead deadline", () => {
    expect(departmentDeadlinesProblem([], dates)).toBeNull();
    expect(departmentDeadlinesProblem([{ department: "FIELD OPS", deadline: "2027-07-08" }], dates)).toBeNull();
    expect(departmentDeadlinesProblem([{ department: "", deadline: "2027-07-08" }], dates)).toBe(
      "Pick a department for each self-review deadline.",
    );
    expect(departmentDeadlinesProblem([{ department: "FIELD OPS", deadline: "" }], dates)).toBe(
      "Pick a self-review deadline for FIELD OPS.",
    );
    expect(
      departmentDeadlinesProblem(
        [
          { department: "FIELD OPS", deadline: "2027-07-08" },
          { department: "field ops", deadline: "2027-07-09" },
        ],
        dates,
      ),
    ).toBe("field ops has more than one self-review deadline.");
    expect(departmentDeadlinesProblem([{ department: "FIELD OPS", deadline: "2027-07-15" }], dates)).toBe(
      "FIELD OPS's self-review deadline must be before the deadline for lead's feedback.",
    );
    expect(departmentDeadlinesProblem([{ department: "FIELD OPS", deadline: "2027-06-01" }], dates)).toBe(
      "FIELD OPS's self-review deadline must be after the PAR creation date and no later than the evaluation closes.",
    );
  });
});
