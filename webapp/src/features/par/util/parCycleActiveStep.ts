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

import type { ParCycle } from "../api/types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** `dayjs().diff(date, "day", true)` — days between now and `date`,
 * fractional, positive once `date` is in the past. An absent date (source's
 * own `parSpecialRatingDeadline?` is optional on the type) never counts as
 * passed. */
function daysSince(date: string | undefined, now: Date): number {
  if (!date) return -Infinity;
  return (now.getTime() - new Date(date).getTime()) / DAY_MS;
}

// Ports TeamSummary.tsx's own useEffect: which of the cycle-dates stepper's
// five steps to land on, based on which deadlines have actually passed —
// unlike MultiTeamSummary.tsx's copy of the same stepper, which never
// advances past step 0. The four checks aren't else-if in source, so the
// last one that matches wins; the `- 1` on the lead deadline is source's
// own (undocumented) one-day grace before that step advances — kept as-is,
// not smoothed into the same shape as the other three.
export function calculateCycleActiveStep(
  cycle: Pick<ParCycle, "parEmployeeDeadline" | "parLeadDeadline" | "parSpecialRatingDeadline" | "parEvaluationEndDate">,
  now: Date = new Date(),
): number {
  let step = 0;
  if (daysSince(cycle.parEmployeeDeadline, now) >= 0) step = 1;
  if (daysSince(cycle.parLeadDeadline, now) - 1 >= 0) step = 2;
  if (daysSince(cycle.parSpecialRatingDeadline, now) >= 0) step = 3;
  if (daysSince(cycle.parEvaluationEndDate, now) >= 0) step = 4;
  return step;
}
