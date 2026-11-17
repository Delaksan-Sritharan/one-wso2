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

import { describe, expect, it } from "vitest";
import type { AuditControl } from "@features/security/grc/modules/audit/types/audit";
import {
  deadlineHandlerLabel,
  formatDelayLogEntry,
  groupDelayLog,
  lateDaySummary,
  isCurrentDeadlineOverdue,
  isMyDeadline,
  myDeadlineHandlers,
  myDeadlines,
  planGroups,
  showMyDeadlines,
} from "./deadlines";

type Tracked = Pick<AuditControl, "id" | "deadlineTracked" | "currentHandler" | "currentDueDate">;

const control = (id: number, over: Partial<Tracked> = {}): AuditControl =>
  ({ id, deadlineTracked: true, currentHandler: "OWNER", currentDueDate: "2026-11-20", ...over }) as AuditControl;

describe("deadlineHandlerLabel", () => {
  it("names each group", () => {
    expect(deadlineHandlerLabel("OWNER")).toBe("Owner");
    expect(deadlineHandlerLabel("COMPLIANCE")).toBe("Compliance");
    expect(deadlineHandlerLabel("AUDITOR")).toBe("Auditor");
  });

  it("shows an unknown group as received", () => {
    expect(deadlineHandlerLabel("LEGAL")).toBe("LEGAL");
  });
});

describe("formatDelayLogEntry", () => {
  it("formats as the group label and MM/DD", () => {
    expect(formatDelayLogEntry({ handledBy: "OWNER", date: "2026-11-08" })).toBe("Owner - 11/08");
    expect(formatDelayLogEntry({ handledBy: "AUDITOR", date: "2027-01-02" })).toBe("Auditor - 01/02");
  });

  it("keeps the calendar day whatever the timezone (no Date round trip)", () => {
    expect(formatDelayLogEntry({ handledBy: "COMPLIANCE", date: "2026-03-01" })).toBe("Compliance - 03/01");
  });

  it("shows a malformed date as received", () => {
    expect(formatDelayLogEntry({ handledBy: "OWNER", date: "soon" })).toBe("Owner - soon");
  });
});

describe("isCurrentDeadlineOverdue", () => {
  const today = "2026-11-12";

  it("is overdue only once the date is before today", () => {
    expect(isCurrentDeadlineOverdue(control(1, { currentDueDate: "2026-11-11" }), today)).toBe(true);
    expect(isCurrentDeadlineOverdue(control(1, { currentDueDate: "2026-11-12" }), today)).toBe(false);
  });

  it("is never overdue when untracked, finished or undated", () => {
    expect(isCurrentDeadlineOverdue(control(1, { deadlineTracked: false, currentDueDate: "2020-01-01" }), today)).toBe(false);
    expect(isCurrentDeadlineOverdue(control(1, { currentHandler: null, currentDueDate: "2020-01-01" }), today)).toBe(false);
    expect(isCurrentDeadlineOverdue(control(1, { currentDueDate: null }), today)).toBe(false);
    expect(isCurrentDeadlineOverdue({} as AuditControl, today)).toBe(false);
  });
});

describe("myDeadlineHandlers / showMyDeadlines", () => {
  it("maps submitting to Owner and validating to Auditor", () => {
    expect(myDeadlineHandlers({ canSubmit: true, canValidate: false })).toEqual(["OWNER"]);
    expect(myDeadlineHandlers({ canSubmit: false, canValidate: true })).toEqual(["AUDITOR"]);
    expect(myDeadlineHandlers({ canSubmit: true, canValidate: true })).toEqual(["OWNER", "AUDITOR"]);
    expect(myDeadlineHandlers({ canSubmit: false, canValidate: false })).toEqual([]);
  });

  it("is offered to someone who holds a turn, but not to org-wide viewers", () => {
    expect(showMyDeadlines(false, { canSubmit: true, canValidate: false })).toBe(true);
    expect(showMyDeadlines(true, { canSubmit: true, canValidate: false })).toBe(false);
    expect(showMyDeadlines(false, { canSubmit: false, canValidate: false })).toBe(false);
  });
});

describe("isMyDeadline / myDeadlines", () => {
  it("matches only controls currently with the user's side", () => {
    expect(isMyDeadline(control(1), ["OWNER"])).toBe(true);
    expect(isMyDeadline(control(1, { currentHandler: "COMPLIANCE" }), ["OWNER"])).toBe(false);
    expect(isMyDeadline(control(1, { currentHandler: "AUDITOR" }), ["OWNER"])).toBe(false);
  });

  it("excludes untracked, finished and undated controls", () => {
    expect(isMyDeadline(control(1, { deadlineTracked: false }), ["OWNER"])).toBe(false);
    expect(isMyDeadline(control(1, { currentHandler: null }), ["OWNER"])).toBe(false);
    expect(isMyDeadline(control(1, { currentDueDate: null }), ["OWNER"])).toBe(false);
    expect(isMyDeadline({} as AuditControl, ["OWNER"])).toBe(false);
  });

  it("lists mine soonest first and leaves the source list alone", () => {
    const all = [
      control(1, { currentDueDate: "2026-12-01" }),
      control(2, { currentHandler: "COMPLIANCE", currentDueDate: "2026-11-01" }),
      control(3, { currentDueDate: "2026-11-05" }),
      control(4, { currentHandler: "AUDITOR", currentDueDate: "2026-11-03" }),
    ];
    expect(myDeadlines(all, ["OWNER"]).map((c) => c.id)).toEqual([3, 1]);
    expect(myDeadlines(all, ["OWNER", "AUDITOR"]).map((c) => c.id)).toEqual([4, 3, 1]);
    expect(all.map((c) => c.id)).toEqual([1, 2, 3, 4]);
  });

  it("drops a control once handed on and brings it back with its new date when rejected", () => {
    const handedOn = control(1, { currentHandler: "COMPLIANCE", currentDueDate: "2026-11-22" });
    expect(myDeadlines([handedOn], ["OWNER"])).toEqual([]);
    const rejected = control(1, { currentHandler: "OWNER", currentDueDate: "2026-12-07" });
    expect(myDeadlines([rejected], ["OWNER"]).map((c) => c.currentDueDate)).toEqual(["2026-12-07"]);
  });
});

describe("groupDelayLog", () => {
  it("joins consecutive days of one group into a single range", () => {
    expect(
      groupDelayLog([
        { handledBy: "OWNER", date: "2026-10-30" },
        { handledBy: "OWNER", date: "2026-10-31" },
        { handledBy: "OWNER", date: "2026-11-01" },
      ]),
    ).toEqual(["Owner - 10/30 to 11/01 (3 days)"]);
  });

  it("starts a new line when the group or the run changes", () => {
    expect(
      groupDelayLog([
        { handledBy: "OWNER", date: "2026-11-08" },
        { handledBy: "OWNER", date: "2026-11-09" },
        { handledBy: "COMPLIANCE", date: "2026-11-10" },
        { handledBy: "OWNER", date: "2026-11-20" },
      ]),
    ).toEqual(["Owner - 11/08 to 11/09 (2 days)", "Compliance - 11/10 (1 day)", "Owner - 11/20 (1 day)"]);
  });

  it("is empty for an empty log and keeps a malformed date on its own line", () => {
    expect(groupDelayLog([])).toEqual([]);
    expect(groupDelayLog([{ handledBy: "AUDITOR", date: "soon" }])).toEqual(["Auditor - soon (1 day)"]);
  });
});

describe("lateDaySummary", () => {
  it("totals the late days and splits them by group", () => {
    const log = [
      ...Array.from({ length: 10 }, (_, i) => ({ handledBy: "OWNER" as const, date: `2026-10-${18 + i}` })),
      { handledBy: "COMPLIANCE" as const, date: "2026-11-14" },
      { handledBy: "COMPLIANCE" as const, date: "2026-11-15" },
    ];
    expect(lateDaySummary(log)).toBe("12 late days: Owner 10, Compliance 2");
  });

  it("is null for an empty log and singular for one day", () => {
    expect(lateDaySummary([])).toBeNull();
    expect(lateDaySummary([{ handledBy: "AUDITOR", date: "2026-12-25" }])).toBe("1 late day: Auditor 1");
  });
});

describe("OE phases", () => {
  it("labels an OE phase in the delay log and never merges late days across phases", () => {
    expect(
      groupDelayLog([
        { phase: "POPULATION", handledBy: "OWNER", date: "2026-11-08" },
        { phase: "POPULATION", handledBy: "OWNER", date: "2026-11-09" },
        { phase: "OE_EVIDENCE", handledBy: "OWNER", date: "2026-11-10" },
      ]),
    ).toEqual(["Owner (Population) - 11/08 to 11/09 (2 days)", "Owner (Evidence) - 11/10 (1 day)"]);
  });

  it("leaves Design's delay log wording alone", () => {
    expect(groupDelayLog([{ phase: "EVIDENCE", handledBy: "OWNER", date: "2026-11-08" }])).toEqual([
      "Owner - 11/08 (1 day)",
    ]);
  });

  it("shows one unlabelled plan for a Design control", () => {
    expect(
      planGroups({ plannedOwnerDate: "2026-11-07", plannedComplianceDate: "2026-11-17", plannedAuditorDate: "2026-11-27" }),
    ).toEqual([{ label: null, owner: "2026-11-07", compliance: "2026-11-17", auditor: "2026-11-27" }]);
  });

  it("shows a plan per phase for an OE control, evidence appearing once it has started", () => {
    const population = { phase: "POPULATION" as const, plannedOwnerDate: "2026-11-06", plannedComplianceDate: "2026-11-09", plannedAuditorDate: "2026-11-12" };
    expect(planGroups({ phasePlans: [population] }).map((g) => g.label)).toEqual(["Population"]);
    const both = planGroups({
      phasePlans: [population, { phase: "OE_EVIDENCE", plannedOwnerDate: "2026-11-10", plannedComplianceDate: "2026-11-12", plannedAuditorDate: "2026-11-14" }],
    });
    expect(both.map((g) => g.label)).toEqual(["Population", "Evidence"]);
    expect(both[1].auditor).toBe("2026-11-14");
  });
});
