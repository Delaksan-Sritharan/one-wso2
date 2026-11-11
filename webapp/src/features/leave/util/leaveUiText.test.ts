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
import { DAY_PORTION_LABEL, GENERIC_LABEL, LEAVE_TOOLTIP, SnackMessage, leaveTypeLabel } from "./leaveUiText";

// Each location names some leave types its own way, so one name for all would be wrong for most locations.
describe("leaveTypeLabel", () => {
  it("names casual leave the way each location names it", () => {
    expect(leaveTypeLabel("Sri Lanka", "casual")).toBe("Casual/Annual");
    expect(leaveTypeLabel("India", "casual")).toBe("Casual");
    expect(leaveTypeLabel("Spain", "casual")).toBe("Casual Leave");
  });

  it("names annual leave the way each location names it", () => {
    expect(leaveTypeLabel("India", "annual")).toBe("Annual / Earned");
    expect(leaveTypeLabel("Spain", "annual")).toBe("Annual Leave");
  });

  it("gives France its own two types", () => {
    expect(leaveTypeLabel("France", "conges_payes")).toBe("Congés Payés");
    expect(leaveTypeLabel("France", "rtt")).toBe("RTT");
  });

  it("calls sick leave 'Sick Leave', not 'Sick'", () => {
    for (const location of ["India", "France", "Spain"]) {
      expect(leaveTypeLabel(location, "sick")).toBe("Sick Leave");
    }
  });

  it("names the location-independent types the same everywhere", () => {
    for (const location of ["Sri Lanka", "India", "France", "Spain"]) {
      expect(leaveTypeLabel(location, "maternity")).toBe("Maternity");
      expect(leaveTypeLabel(location, "paternity")).toBe("Paternity");
      expect(leaveTypeLabel(location, "lieu")).toBe("Lieu");
      expect(leaveTypeLabel(location, "sabbatical")).toBe("Sabbatical");
    }
  });

  it("falls back to Sri Lanka for an unknown or missing location", () => {
    expect(leaveTypeLabel("Atlantis", "casual")).toBe("Casual/Annual");
    expect(leaveTypeLabel(null, "casual")).toBe("Casual/Annual");
    expect(leaveTypeLabel(undefined, "casual")).toBe("Casual/Annual");
  });

  it("still names a type offered outside its own location", () => {
    // Sri Lanka's map has no `rtt`, but a row can still carry one.
    expect(leaveTypeLabel("Sri Lanka", "rtt")).toBe("RTT");
    expect(leaveTypeLabel("Sri Lanka", "sick")).toBe("Sick Leave");
  });
});

describe("GENERIC_LABEL", () => {
  it("covers every leave type", () => {
    for (const [type, label] of Object.entries(GENERIC_LABEL)) {
      expect(label, type).toBeTruthy();
    }
  });

  it("labels annual leave Casual/Annual, the same as casual leave", () => {
    // The entitlement warning is built from this label.
    expect(GENERIC_LABEL.annual).toBe("Casual/Annual");
    expect(GENERIC_LABEL.casual).toBe("Casual/Annual");
  });
});

describe("the rest of the leave text", () => {
  it("names the day portions", () => {
    expect(DAY_PORTION_LABEL.full).toBe("Full Day");
    expect(DAY_PORTION_LABEL.first).toBe("First Half");
    expect(DAY_PORTION_LABEL.second).toBe("Second Half");
  });

  it("carries a tooltip for exactly the three types that have one", () => {
    expect(Object.keys(LEAVE_TOOLTIP).sort()).toEqual(["conges_payes", "rtt", "sick"]);
    expect(LEAVE_TOOLTIP.rtt).toBe("Réduction du Temps de Travail");
  });

  it("keeps the result messages word for word", () => {
    expect(SnackMessage.success.submitLeaveMessage).toBe("Leave request submitted successfully");
    expect(SnackMessage.success.cancelLeaveMessage).toBe("Leave cancelled successfully");
    expect(SnackMessage.error.submitLeaveMessage).toBe("Failed to submit leave request");
    // Unlike the Apply form's own SUBMIT_SUCCESS, the shared message has no exclamation mark.
    expect(SnackMessage.success.submitLeaveMessage).not.toMatch(/!$/);
  });
});
