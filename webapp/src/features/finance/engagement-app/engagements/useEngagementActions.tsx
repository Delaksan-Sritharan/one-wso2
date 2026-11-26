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

import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { EngagementStatus, EngagementSummary } from "../api/engagementTypes";
import PickEngagementStatus from "./PickEngagementStatus";
import { useApproveEngagement, useSetEngagementStatus, useSetRequestStatus } from "../api/useEngagementMutations";
import { useEngagementAccess } from "../api/useEngagementUserInfo";
import { ConfirmDialog } from "../components/EaDialog";
import type { RowAction } from "../components/EaTable";
import { engagementPaths } from "../engagementPaths";
import { CheckIcon } from "@wso2/oxygen-ui-icons-react";
import {
  canAllocateType,
  canApprove,
  canCompleteEngagement,
  canEditEngagement,
  canEditPending,
  canSetEngagementStatus,
} from "../model/engagementAccess";

type Pending =
  | { kind: "request"; e: EngagementSummary; to: "Completed" | "In Progress" }
  | { kind: "pick-status"; e: EngagementSummary }
  | { kind: "confirm-status"; e: EngagementSummary; to: EngagementStatus }
  | { kind: "approve"; e: EngagementSummary };

const what = (e: EngagementSummary) => (e.kind === "marketing" ? "event" : "engagement");

/** The legacy row actions of an engagement, shared by Engagements, the engagement page and Approvals. */
export function useEngagementActions(): {
  actionsFor: (e: EngagementSummary) => { primary?: RowAction; menu: RowAction[] };
  /** All of a row's actions in one list, for a table. */
  rowActionsFor: (e: EngagementSummary) => RowAction[];
  dialogs: ReactNode;
} {
  const { p } = useEngagementAccess();
  const navigate = useNavigate();
  const notify = useNotifications();
  const setRequestStatus = useSetRequestStatus();
  const setEngagementStatus = useSetEngagementStatus();
  const approve = useApproveEngagement();
  const [pending, setPending] = useState<Pending | null>(null);
  const close = () => setPending(null);

  const actionsFor = (e: EngagementSummary) => {
    const st = e.requestStatus;
    const isPending = st === "Pending Approval";
    const closed = st === "Cancelled";
    // The backend's `actions` decide; the legacy privilege rules stand in only where a row carries none.
    const a = e.actions;
    const may = {
      approve: a ? Boolean(a.approve) : isPending && canApprove(p, e.typeId),
      allocate: a ? Boolean(a.allocate) : !isPending && !closed && canAllocateType(p, e.typeId),
      editPending: a ? Boolean(a.editPending) : isPending && canEditPending(p, e.typeId),
      edit: a ? Boolean(a.edit) : !isPending && !closed && canEditEngagement(p, e.typeId),
      complete: a ? Boolean(a.complete) : !isPending && !closed && canCompleteEngagement(p, e.typeId),
      status: a ? Boolean(a.changeEngagementStatus) : !isPending && !closed && canSetEngagementStatus(p, e.typeId),
    };
    const menu: RowAction[] = [];
    let primary: RowAction | undefined;
    if (may.approve) {
      primary = { label: "Approve", icon: <CheckIcon size={14} />, onClick: () => setPending({ kind: "approve", e }) };
    } else if (may.allocate) {
      primary = { label: "Allocate", onClick: () => navigate(engagementPaths.allocate(e.id)) };
    }
    if (may.editPending) {
      menu.push({ label: "Edit", onClick: () => navigate(engagementPaths.editEngagement(e.id, true)) });
    } else if (may.edit) {
      menu.push({ label: "Edit", onClick: () => navigate(engagementPaths.editEngagement(e.id)) });
    }
    if (may.complete) {
      menu.push(
        st === "Completed"
          ? { label: "Reopen", onClick: () => setPending({ kind: "request", e, to: "In Progress" }) }
          : { label: "Mark as Completed", onClick: () => setPending({ kind: "request", e, to: "Completed" }) },
      );
    }
    if (may.status) {
      menu.push({ label: "Change Engagement Status", onClick: () => setPending({ kind: "pick-status", e }) });
    }
    return { primary, menu };
  };

  let dialogs: ReactNode = null;
  if (pending?.kind === "request") {
    const { e, to } = pending;
    dialogs = (
      <ConfirmDialog
        title="Change Request Status"
        confirmLabel={to === "Completed" ? "Mark as Completed" : "Reopen"}
        busyLabel="Updating…"
        text={`Are you sure you want to change the Status of ${e.id} to ${to}?`}
        run={() => setRequestStatus.mutateAsync({ id: e.id, status: to })}
        onDone={() => notify.showSuccess("Status updated successfully")}
        onClose={close}
      />
    );
  } else if (pending?.kind === "pick-status") {
    dialogs = <PickEngagementStatus e={pending.e} onClose={close} onNext={(to) => setPending({ kind: "confirm-status", e: pending.e, to })} />;
  } else if (pending?.kind === "confirm-status") {
    const { e, to } = pending;
    dialogs = (
      <ConfirmDialog
        title="Change Engagement Status"
        confirmLabel={to === "Cancelled" ? `Cancel ${what(e) === "event" ? "Event" : "Engagement"}` : "Change Status"}
        busyLabel="Updating…"
        danger={to === "Cancelled"}
        text={
          to === "Cancelled"
            ? `Are you sure you want to change the Engagement Status of ${e.id} to Cancelled? Its allocations become Allocation Cancelled and its open travel requests Cancelled. The consultants and the Travel group are emailed.`
            : `Are you sure you want to change the Engagement Status of ${e.id} to ${to}?`
        }
        run={() => setEngagementStatus.mutateAsync({ id: e.id, status: to })}
        onDone={() => notify.showSuccess(to === "Cancelled" ? `${e.id} cancelled successfully` : "Status updated successfully")}
        onClose={close}
      />
    );
  } else if (pending?.kind === "approve") {
    const { e } = pending;
    dialogs = (
      <ConfirmDialog
        title={what(e) === "event" ? "Approve Event" : "Approve Engagement"}
        confirmLabel="Approve"
        busyLabel="Approving…"
        text={`Are you sure you want to confirm and approve ${e.id}? Once approved, this action cannot be undone.`}
        run={() => approve.mutateAsync({ id: e.id })}
        onDone={() => notify.showSuccess(`${what(e) === "event" ? "Event" : "Engagement"} approved successfully`)}
        onClose={close}
      />
    );
  }
  const rowActionsFor = (e: EngagementSummary) => {
    const { primary, menu } = actionsFor(e);
    return primary ? [primary, ...menu] : menu;
  };
  return { actionsFor, rowActionsFor, dialogs };
}
