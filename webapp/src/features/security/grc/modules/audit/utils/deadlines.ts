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

import type {
  AuditControl,
  DeadlineHandler,
  DeadlinePhase,
  DelayLogEntry,
} from "@features/security/grc/modules/audit/types/audit";

export const DEADLINE_HANDLER_LABELS: Record<DeadlineHandler, string> = {
  OWNER: "Owner",
  COMPLIANCE: "Compliance",
  AUDITOR: "Auditor",
};

/** "OWNER" → "Owner"; anything unrecognised is shown as received. */
export function deadlineHandlerLabel(handler: string): string {
  return DEADLINE_HANDLER_LABELS[handler as DeadlineHandler] ?? handler;
}

/**
 * Formats a delay-log entry as "Owner - 11/08" (MM/DD). The date is parsed
 * from the "YYYY-MM-DD" string itself — never through Date — so the day cannot
 * move with the reader's timezone. A malformed date is shown as received.
 */
export function formatDelayLogEntry(entry: DelayLogEntry): string {
  const match = /^\d{4}-(\d{2})-(\d{2})/.exec(entry.date);
  const day = match ? `${match[1]}/${match[2]}` : entry.date;
  return `${deadlineHandlerLabel(entry.handledBy)} - ${day}`;
}

/** Phase names for the OE phases; Design's EVIDENCE needs none, so it is left out. */
const OE_PHASE_LABELS: Partial<Record<DeadlinePhase, string>> = {
  POPULATION: "Population",
  OE_EVIDENCE: "Evidence",
};

/** "Owner" or, in an OE phase, "Owner (Population)". */
function whoLabel(handler: string, phase?: DeadlinePhase): string {
  const phaseLabel = phase ? OE_PHASE_LABELS[phase] : undefined;
  return phaseLabel ? `${deadlineHandlerLabel(handler)} (${phaseLabel})` : deadlineHandlerLabel(handler);
}

const DAY_MS = 86_400_000;

function dayNumber(date: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS : null;
}

function monthDay(date: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(date);
  return m ? `${m[1]}/${m[2]}` : date;
}

/**
 * Collapses the delay log into one line per run of consecutive late days for
 * the same group, e.g. "Owner - 10/19 to 11/16 (29 days)", so a control that has
 * been late for weeks does not produce a line per day. Entries are expected in
 * the order the server sends them; a malformed date stands on its own line.
 */
export function groupDelayLog(entries: DelayLogEntry[]): string[] {
  const lines: string[] = [];
  let i = 0;
  while (i < entries.length) {
    const start = entries[i];
    let end = start;
    let count = 1;
    let prev = dayNumber(start.date);
    while (i + count < entries.length && prev !== null) {
      const next = entries[i + count];
      const n = dayNumber(next.date);
      if (next.handledBy !== start.handledBy || next.phase !== start.phase || n === null || n !== prev + 1) break;
      end = next;
      prev = n;
      count += 1;
    }
    const who = whoLabel(start.handledBy, start.phase);
    const days = `${count} ${count === 1 ? "day" : "days"}`;
    lines.push(
      count === 1
        ? `${who} - ${monthDay(start.date)} (${days})`
        : `${who} - ${monthDay(start.date)} to ${monthDay(end.date)} (${days})`,
    );
    i += count;
  }
  return lines;
}

/** One-line total for the delay log, e.g. "12 late days: Owner 10, Compliance 2". Null when nobody was late. */
export function lateDaySummary(entries: DelayLogEntry[]): string | null {
  if (entries.length === 0) return null;
  const perGroup = new Map<string, number>();
  for (const e of entries) perGroup.set(e.handledBy, (perGroup.get(e.handledBy) ?? 0) + 1);
  const parts = [...perGroup].map(([handler, n]) => `${deadlineHandlerLabel(handler)} ${n}`);
  return `${entries.length} late ${entries.length === 1 ? "day" : "days"}: ${parts.join(", ")}`;
}

/** True when the backend tracks deadlines for this control. */
export function isDeadlineTracked(control: Pick<AuditControl, "deadlineTracked">): boolean {
  return control.deadlineTracked === true;
}

/**
 * True when the control's current deadline has passed. Both sides are civil
 * "YYYY-MM-DD" dates, so a string comparison is exact. A finished (no holder)
 * or untracked control is never overdue.
 */
export function isCurrentDeadlineOverdue(
  control: Pick<AuditControl, "deadlineTracked" | "currentHandler" | "currentDueDate">,
  today: string,
): boolean {
  if (!isDeadlineTracked(control) || !control.currentHandler || !control.currentDueDate) return false;
  return control.currentDueDate < today;
}

export interface DeadlineSide {
  // SubmitEvidence — the internal team that submits evidence.
  canSubmit: boolean;
  // ValidateEvidence — the external auditor that validates it.
  canValidate: boolean;
}

/**
 * The groups whose turn counts as "mine". Derived from the same privileges that
 * gate the actions each group performs, not from a new privilege or a role name.
 */
export function myDeadlineHandlers(side: DeadlineSide): DeadlineHandler[] {
  const handlers: DeadlineHandler[] = [];
  if (side.canSubmit) handlers.push("OWNER");
  if (side.canValidate) handlers.push("AUDITOR");
  return handlers;
}

/**
 * Key for the controls table. My Deadlines arrives ordered soonest-first, so
 * entering or leaving it remounts the table and drops any sort picked on
 * another tab, which would otherwise replace that order.
 */
export function controlsTableKey(quickFilter: string | null): string {
  return quickFilter === "myDeadlines" ? "my-deadlines" : "controls";
}

/**
 * Whether the My Deadlines view is offered: org-wide GRC viewers already see
 * every control and every deadline, so it is for everyone else who holds a turn.
 */
export function showMyDeadlines(canViewAll: boolean, side: DeadlineSide): boolean {
  return !canViewAll && myDeadlineHandlers(side).length > 0;
}

/** True when the control is currently with one of `handlers` and has a deadline. */
export function isMyDeadline(
  control: Pick<AuditControl, "deadlineTracked" | "currentHandler" | "currentDueDate">,
  handlers: DeadlineHandler[],
): boolean {
  return (
    isDeadlineTracked(control) &&
    control.currentHandler != null &&
    handlers.includes(control.currentHandler) &&
    Boolean(control.currentDueDate)
  );
}

/** The controls currently with `handlers`, soonest deadline first (stable for ties). */
export function myDeadlines(controls: AuditControl[], handlers: DeadlineHandler[]): AuditControl[] {
  return controls
    .filter((c) => isMyDeadline(c, handlers))
    .sort((a, b) => (a.currentDueDate as string).localeCompare(b.currentDueDate as string));
}

/** True when at least one control carries a delay log (it is sent to org-wide GRC viewers only). */
export function hasDelayLog(controls: Pick<AuditControl, "delayLog">[]): boolean {
  return controls.some((c) => Array.isArray(c.delayLog));
}

export interface PlanGroup {
  /** Heading for an OE phase; null for a Design control's single plan. */
  label: string | null;
  owner: string | null;
  compliance: string | null;
  auditor: string | null;
}

/**
 * The planned dates to show, one group per phase the control has started. A
 * Design control, or one the server sent no per-phase plan for, has the single
 * plan from the flat fields and no heading.
 */
export function planGroups(
  control: Pick<AuditControl, "phasePlans" | "plannedOwnerDate" | "plannedComplianceDate" | "plannedAuditorDate">,
): PlanGroup[] {
  const plans = control.phasePlans ?? [];
  if (plans.length > 0 && plans.some((p) => p.phase !== "EVIDENCE")) {
    return plans.map((p) => ({
      label: OE_PHASE_LABELS[p.phase] ?? null,
      owner: p.plannedOwnerDate ?? null,
      compliance: p.plannedComplianceDate ?? null,
      auditor: p.plannedAuditorDate ?? null,
    }));
  }
  return [
    {
      label: null,
      owner: control.plannedOwnerDate ?? null,
      compliance: control.plannedComplianceDate ?? null,
      auditor: control.plannedAuditorDate ?? null,
    },
  ];
}
