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

import { useState, type JSX } from "react";
import { MenuItem, Stack, TextField } from "@wso2/oxygen-ui";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { Allocation, AllocationStatus } from "../api/engagementTypes";
import { useSetAllocationStatus } from "../api/useEngagementMutations";
import EaDialog from "../components/EaDialog";
import { FactsGrid } from "../components/Facts";
import { fmtDate } from "../model/format";
import { nextAllocationStatuses } from "../model/statuses";

/** The legacy Update Allocation Status popup: the allocation's facts, the Allocation Status choices the legacy list offered from its current status (no pre-selection), and the comment (255). */
export default function AllocationStatusDialog({ allocation, onClose }: { allocation: Allocation; onClose: () => void }): JSX.Element {
  const [status, setStatus] = useState<AllocationStatus | "">("");
  const [comment, setComment] = useState(allocation.comment ?? "");
  const [error, setError] = useState<unknown>();
  const [statusError, setStatusError] = useState("");
  const save = useSetAllocationStatus();
  const notify = useNotifications();
  const a = allocation;
  return (
    <EaDialog
      title="Update Allocation Status"
      subtitle={`${a.id} is ${a.status}`}
      confirmLabel="Update Status"
      busy={save.isPending}
      error={error}
      onClose={onClose}
      dirty={status !== "" || comment !== (a.comment ?? "")}
      onConfirm={() => {
        setStatusError(status ? "" : "Select the new allocation status");
        if (!status) return;
        setError(undefined);
        save.mutate(
          { id: a.id, status, comment },
          {
            onSuccess: () => {
              notify.showSuccess("Allocation status updated successfully");
              onClose();
            },
            onError: setError,
          },
        );
      }}
    >
      <Stack spacing={2.25} sx={{ pt: 1 }}>
        <FactsGrid
          columns={3}
          facts={[
            { label: "Email", value: a.consultant.email },
            { label: "Allocation Type", value: a.engagement.allocationType },
            { label: "Engagement Code", value: a.engagement.code },
            { label: "Start Date", value: fmtDate(a.start) },
            { label: "End Date", value: fmtDate(a.end) },
            { label: "Travel Required?", value: a.travelRequired },
            a.hourly && { label: "Hourly", value: `${a.hourly.from} – ${a.hourly.to} (${a.hourly.timeZone})` },
          ]}
        />
        <TextField
          select
          required
          size="small"
          label="Allocation Status"
          value={status}
          error={Boolean(statusError)}
          helperText={statusError}
          onChange={(e) => setStatus(e.target.value as AllocationStatus)}
        >
          {nextAllocationStatuses(a.status).map((s) => (
            <MenuItem key={s} value={s}>
              {s}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          label="Comment"
          multiline
          minRows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          slotProps={{ htmlInput: { maxLength: 255 } }}
        />
      </Stack>
    </EaDialog>
  );
}
