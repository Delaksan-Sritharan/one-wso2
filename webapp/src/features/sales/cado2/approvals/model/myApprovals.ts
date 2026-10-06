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

// Someone holding several approval roles on one quote (say CRO, CFO and CEO,
// in sequence) decides one step at a time. These helpers say which steps are
// theirs and what a decision did, so each click visibly moves them on.

import type { ApprovalOutcome, ApprovalStep, ApprovalWorkflow } from "@features/sales/cado2/approvals/api/approvalTypes";
import { STEP_STATUS } from "@features/sales/cado2/approvals/model/approvalText";

/** Where one of the caller's own steps stands. */
export type MyStepState = "done" | "now" | "later" | "stopped";

export interface MyStep {
  readonly role: string;
  readonly roleLabel: string;
  readonly state: MyStepState;
  /** E.g. "Approved", "Your turn", "Later", "Rejected". */
  readonly label: string;
}

const mine = (s: ApprovalStep, roles: readonly string[]) => roles.includes(s.role) && s.status !== "CANCELLED";

/** The caller's steps on the quote, in workflow order; steps not needed are left out. */
export function myApprovalSteps(steps: readonly ApprovalStep[], approverRoles: readonly string[]): MyStep[] {
  return steps
    .filter((s) => mine(s, approverRoles))
    .map((s): MyStep => {
      if (s.status === "APPROVED") return { role: s.role, roleLabel: s.roleLabel, state: "done", label: "Approved" };
      if (s.canAct) return { role: s.role, roleLabel: s.roleLabel, state: "now", label: "Your turn" };
      if (s.status === "REJECTED" || s.status === "CHANGES_REQUESTED") {
        return { role: s.role, roleLabel: s.roleLabel, state: "stopped", label: STEP_STATUS[s.status].label };
      }
      return { role: s.role, roleLabel: s.roleLabel, state: "later", label: "Later" };
    });
}

/**
 * The "Your approvals" strip is worth showing only to someone with two or more
 * steps on the quote who may act on them (not, say, the person who submitted it).
 */
export function showMyApprovals(steps: readonly ApprovalStep[], approverRoles: readonly string[]): boolean {
  const own = steps.filter((s) => mine(s, approverRoles));
  return own.length >= 2 && own.every((s) => s.cantActReason === null);
}

const joined = (labels: string[]) =>
  labels.length <= 1 ? (labels[0] ?? "") : `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;

/**
 * What a decision did, for the confirmation after it is saved: e.g. "Approved
 * as CRO. CFO is also yours and is waiting for you now."
 */
export function decisionMessage(
  outcome: ApprovalOutcome,
  step: ApprovalStep,
  after: ApprovalWorkflow,
  approverRoles: readonly string[],
): string {
  if (outcome === "reject") return `Rejected as ${step.roleLabel}. The approval has stopped.`;
  if (outcome === "request-changes") return `Sent back for changes as ${step.roleLabel}. The owner is asked to revise it.`;
  const done = `Approved as ${step.roleLabel}.`;
  const own = after.steps.filter((s) => mine(s, approverRoles));
  const next = own.filter((s) => s.canAct).map((s) => s.roleLabel);
  if (next.length) return `${done} ${joined(next)} ${next.length === 1 ? "is" : "are"} also yours and waiting for you now.`;
  const later = own.filter((s) => s.status === "WAITING" || s.status === "PENDING").map((s) => s.roleLabel);
  if (later.length) return `${done} ${joined(later)} will come to you once the approvers before ${later.length === 1 ? "it" : "them"} have decided.`;
  if (after.status === "APPROVED") return `${done} The quote is now fully approved.`;
  return own.length > 1 ? `${done} All your approvals on this quote are done.` : done;
}
