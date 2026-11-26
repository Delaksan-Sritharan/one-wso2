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

import { useState } from "react";
import type { TravelRequestSummary } from "../api/engagementTypes";
import { useEngagementAccess } from "../api/useEngagementUserInfo";
import type { RowAction } from "../components/EaTable";
import { TRAVEL } from "../model/engagementAccess";
import { AssignDialog, UpdateTravelLoader } from "./travelDialogs";

/** Travel request row actions. */
export function useTravelRowActions() {
  const { p, newTravelRequests } = useEngagementAccess();
  const [assigning, setAssigning] = useState<TravelRequestSummary | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const canEdit = p.t.has(TRAVEL.EDIT_STATUS) || p.t.has(TRAVEL.EDIT_AGENT) || p.t.has(TRAVEL.EDIT_VISA);
  // The row's `actions` decide when present.
  const assign = (t: TravelRequestSummary): RowAction[] =>
    t.status === "New" && (t.actions ? t.actions.assign : newTravelRequests) ? [{ label: "Assign Travel Agent", primary: true, onClick: () => setAssigning(t) }] : [];
  const update = (t: TravelRequestSummary): RowAction[] =>
    t.status !== "New" && (t.actions ? t.actions.update : canEdit) ? [{ label: "Update Travel Details", onClick: () => setUpdating(t.jobNumber) }] : [];
  const rowActions = (t: TravelRequestSummary): RowAction[] => [...assign(t), ...update(t)];
  const dialogs = (
    <>
      {assigning ? <AssignDialog trip={assigning} onClose={() => setAssigning(null)} /> : null}
      {updating ? <UpdateTravelLoader job={updating} onClose={() => setUpdating(null)} /> : null}
    </>
  );
  return { rowActions, dialogs };
}
