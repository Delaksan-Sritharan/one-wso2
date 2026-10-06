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
import type { ApprovalStep, ApprovalWorkflow } from "@features/sales/cado2/approvals/api/approvalTypes";
import { decisionMessage, myApprovalSteps, showMyApprovals } from "./myApprovals";

const step = (role: ApprovalStep["role"], status: ApprovalStep["status"], over: Partial<ApprovalStep> = {}): ApprovalStep => ({
  stepId: 1, role, roleLabel: role === "AREA_GM" ? "Area GM" : role, branches: ["DISCOUNT"], dependsOn: [], triggers: [],
  status, requestedAt: null, actedAt: null, actedByEmail: null, comment: null, canAct: false, cantActReason: null, ...over,
});
const wf = (steps: readonly ApprovalStep[], status: ApprovalWorkflow["status"] = "IN_PROGRESS"): ApprovalWorkflow =>
  ({ status, createdAt: "2026-10-06T09:00:00Z", completedAt: null, steps });
const all = ["CRO", "CFO", "CEO"];

describe("myApprovalSteps", () => {
  it("lists only the caller's steps, in order, with where each stands", () => {
    const steps = [
      step("AREA_GM", "APPROVED"),
      step("CRO", "APPROVED"),
      step("CFO", "PENDING", { canAct: true }),
      step("CEO", "WAITING"),
    ];
    expect(myApprovalSteps(steps, all).map((s) => `${s.roleLabel}: ${s.label}`)).toEqual([
      "CRO: Approved", "CFO: Your turn", "CEO: Later",
    ]);
  });

  it("leaves out steps that are not needed", () => {
    expect(myApprovalSteps([step("CRO", "PENDING", { canAct: true }), step("CEO", "CANCELLED")], all)).toHaveLength(1);
  });
});

describe("showMyApprovals", () => {
  it("shows the strip from two of the caller's steps", () => {
    expect(showMyApprovals([step("CRO", "PENDING", { canAct: true }), step("AREA_GM", "WAITING")], all)).toBe(false);
    expect(showMyApprovals([step("CRO", "PENDING", { canAct: true }), step("CFO", "WAITING")], all)).toBe(true);
  });

  it("hides it when the caller may not act, e.g. they submitted the quote", () => {
    const own = { cantActReason: "You submitted this quote" };
    expect(showMyApprovals([step("CRO", "PENDING", own), step("CFO", "WAITING", own)], all)).toBe(false);
  });
});

describe("decisionMessage", () => {
  const cro = step("CRO", "PENDING", { canAct: true });

  it("says the next step is the caller's too", () => {
    const after = wf([step("CRO", "APPROVED"), step("CFO", "PENDING", { canAct: true }), step("CEO", "WAITING")]);
    expect(decisionMessage("approve", cro, after, all)).toBe("Approved as CRO. CFO is also yours and waiting for you now.");
  });

  it("says when the caller's next step comes after someone else", () => {
    const after = wf([step("CRO", "APPROVED"), step("AREA_GM", "PENDING"), step("CEO", "WAITING")]);
    expect(decisionMessage("approve", cro, after, all)).toBe(
      "Approved as CRO. CEO will come to you once the approvers before it have decided.",
    );
  });

  it("says when all the caller's approvals are done", () => {
    const ceo = step("CEO", "PENDING", { canAct: true });
    const after = wf([step("CRO", "APPROVED"), step("CEO", "APPROVED"), step("AREA_GM", "PENDING")]);
    expect(decisionMessage("approve", ceo, after, all)).toBe("Approved as CEO. All your approvals on this quote are done.");
    expect(decisionMessage("approve", ceo, wf(after.steps, "APPROVED"), all)).toBe("Approved as CEO. The quote is now fully approved.");
  });

  it("keeps a single approver's message short", () => {
    expect(decisionMessage("approve", cro, wf([step("CRO", "APPROVED"), step("AREA_GM", "PENDING")]), ["CRO"])).toBe("Approved as CRO.");
  });

  it("names the role for a rejection or a send-back", () => {
    const after = wf([step("CRO", "REJECTED")], "REJECTED");
    expect(decisionMessage("reject", cro, after, all)).toBe("Rejected as CRO. The approval has stopped.");
    expect(decisionMessage("request-changes", cro, after, all)).toBe("Sent back for changes as CRO. The owner is asked to revise it.");
  });
});
