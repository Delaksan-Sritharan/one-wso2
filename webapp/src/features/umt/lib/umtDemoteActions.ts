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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import type { UmtEditStepId } from "./umtEditSteps";

export interface UmtDemoteAction {
  label: string;
  targetLifecycleState: string;
  color?: "error";
}

// Mirrors legacy's 10 demote/reopen buttons (update-edit-view/index.tsx),
// confirmed one-by-one against source rather than inferred: none of them has
// its own disabled condition or confirmation dialog in legacy, so neither
// does this. Legacy's numeric-activeStep conditions (further split by
// security/non-security lifecycle) collapse onto this port's step-id model,
// since testing/validate already cover both lifecycle variants uniformly.
export function computeUmtDemoteActions(
  stepId: UmtEditStepId,
  lifecycleState: string | null | undefined,
  isHotfix: boolean,
  isAdmin: boolean,
): UmtDemoteAction[] {
  switch (stepId) {
    case "product-analysis":
      return [{ label: "Demote to Development", targetLifecycleState: "Development" }];
    case "description-instruction":
      // Legacy gates both of this step's demote buttons on !isHotfix, with no
      // separate rule for the hotfix branch.
      return isHotfix
        ? []
        : [
            { label: "Demote to PRAnalyzed", targetLifecycleState: "PRAnalyzed" },
            { label: "Demote to Development", targetLifecycleState: "Development" },
          ];
    case "file-approval":
      // Legacy gates this on isAdmin specifically (UMT_ADMIN role) - narrower
      // than the Admin-or-Product-Lead gate on this step's own Proceed/approve
      // action. Confirmed asymmetry in legacy, not a mistake to normalize away.
      return isAdmin ? [{ label: "Demote to Staging", targetLifecycleState: "Staging" }] : [];
    case "testing":
    case "validate":
      return [{ label: "Demote to Development", targetLifecycleState: "Development" }];
    case "verifying":
      if (lifecycleState === "UATStaging") {
        return [{ label: "Demote to Testing", targetLifecycleState: "Staging" }];
      }
      if (lifecycleState === "OnHold") {
        return [{ label: "Reopen", targetLifecycleState: "Development", color: "error" }];
      }
      return [];
    default:
      return [];
  }
}
