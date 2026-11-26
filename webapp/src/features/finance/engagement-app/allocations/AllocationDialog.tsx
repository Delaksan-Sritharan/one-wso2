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
import { Alert, Box, Checkbox, FormControlLabel, MenuItem, TextField } from "@wso2/oxygen-ui";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { defaultOverlapsOf } from "../api/engagementHttp";
import type { AllocationStatus, Engagement, Person, TimelineItem } from "../api/engagementTypes";
import { useCreateAllocation, useIdempotencyKey, type AllocationInput } from "../api/useEngagementMutations";
import EaDialog from "../components/EaDialog";
import SearchSelect from "../components/SearchSelect";
import { isPaidType } from "../model/engagementAccess";
import { addDays, fmtRange } from "../model/format";
import { defaultEnd, validateAllocation, type AllocationFormState } from "../model/allocationForm";
import { INTERNAL_START_STATUSES } from "../model/statuses";

/** Add New Allocation (AddNewAllocationPopup.js), for one consultant on one engagement: the legacy fields in the legacy order. */
export default function AllocationDialog({
  engagement: e,
  consultant,
  timeZones,
  defaultTimeZone,
  onClose,
}: {
  engagement: Engagement;
  consultant: Person;
  timeZones: readonly string[];
  defaultTimeZone?: string;
  onClose: () => void;
}): JSX.Element {
  const cust = e.kind === "customer";
  const paid = isPaidType(e.typeId);
  const needsStatus = !cust;
  const [f, setF] = useState<AllocationFormState>({
    start: e.start,
    end: defaultEnd(e.start, e.end),
    hourly: false,
    timeZone: defaultTimeZone ?? timeZones[0] ?? "",
    from: "09:00",
    to: "11:00",
    status: needsStatus ? "Tentative" : "",
    travel: "",
    comment: "",
    tentative: false,
    preparation: false,
    preparationStart: addDays(e.start, -2),
    postEngagement: false,
    postEngagementEnd: addDays(defaultEnd(e.start, e.end), 2),
  });
  const [error, setError] = useState<unknown>();
  const create = useCreateAllocation();
  const idem = useIdempotencyKey();
  // Default allocations the backend would trim or split: asked once, then resent with the go-ahead.
  const [trim, setTrim] = useState<readonly TimelineItem[]>([]);
  const notify = useNotifications();
  const set = <K extends keyof AllocationFormState>(k: K, v: AllocationFormState[K]) => setF((p) => ({ ...p, [k]: v }));
  const date = (k: "start" | "end" | "preparationStart" | "postEngagementEnd", label: string, min?: string, max?: string) => (
    <TextField
      size="small"
      type="date"
      required
      label={label}
      value={f[k]}
      onChange={(ev) => {
        set(k, ev.target.value);
        // The go-ahead covers only the overlaps shown; new dates are asked again under a new key.
        if (trim.length) {
          setTrim([]);
          idem.renew();
        }
      }}
      slotProps={{ inputLabel: { shrink: true }, htmlInput: { min, max } }}
    />
  );

  return (
    <EaDialog
      title="Add New Allocation"
      subtitle={e.title}
      busy={create.isPending}
      error={error}
      onClose={onClose}
      confirmLabel={trim.length ? "Add Anyway" : "Add Allocation"}
      onConfirm={() => {
        const problem = validateAllocation(f, { engStart: e.start, engEnd: e.end, needsStatus });
        if (problem) return setError(problem);
        setError(undefined);
        const body: AllocationInput = {
          consultantEmail: consultant.email,
          startDate: f.start,
          endDate: f.end,
          hourly: f.hourly ? { timeZone: f.timeZone, startTime: f.from, endTime: f.to } : undefined,
          clearanceStatus: needsStatus ? (f.status as AllocationStatus) : undefined,
          tentative: cust ? f.tentative : undefined,
          travelRequired: f.travel === "Yes",
          comment: f.comment || undefined,
          preparationStart: f.preparation ? f.preparationStart : undefined,
          postEngagementEnd: f.postEngagement ? f.postEngagementEnd : undefined,
          trimDefaultAllocations: trim.length ? true : undefined,
        };
        create.mutate(
          { engagementId: e.id, body, idempotencyKey: idem.key },
          {
            onSuccess: () => {
              notify.showSuccess("Allocation added successfully");
              onClose();
            },
            onError: (err) => {
              const overlaps = defaultOverlapsOf(err);
              if (overlaps.length && !trim.length) {
                // The resend with the go-ahead is a new request, so it gets its own key.
                idem.renew();
                setTrim(overlaps);
              } else setError(err);
            },
          },
        );
      }}
    >
      {trim.length ? (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          {`This allocation overlaps ${trim.length === 1 ? "a team allocation" : `${trim.length} team allocations`} (${trim
            .map((t) => `${t.allocationType || t.label} ${fmtRange(t.start, t.end)}`)
            .join(", ")}). They will be shortened or split around it. Do you want to continue?`}
        </Alert>
      ) : null}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2, pt: 1 }}>
        <TextField size="small" label="Email" value={consultant.email} slotProps={{ input: { readOnly: true } }} sx={{ gridColumn: "1 / -1" }} />
        <TextField size="small" label="Allocation Type" value={e.allocationType} slotProps={{ input: { readOnly: true } }} />
        <TextField size="small" label="Engagement Code" value={e.code} slotProps={{ input: { readOnly: true } }} />
        {date("start", "Start Date", e.start, e.end)}
        {date("end", "End Date", e.start, e.end)}
        <FormControlLabel
          sx={{ gridColumn: "1 / -1" }}
          control={<Checkbox size="small" checked={f.hourly} onChange={(ev) => set("hourly", ev.target.checked)} />}
          label="Hourly"
        />
        {f.hourly ? (
          <>
            <Box sx={{ gridColumn: "1 / -1" }}>
              <SearchSelect label="Select Time Zone" required value={f.timeZone} options={timeZones} onChange={(v) => set("timeZone", v)} />
            </Box>
            <TextField size="small" type="time" required label="Recurring Start Time" value={f.from} onChange={(ev) => set("from", ev.target.value)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: 900 } }} />
            <TextField size="small" type="time" required label="Recurring End Time" value={f.to} onChange={(ev) => set("to", ev.target.value)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: 900 } }} />
          </>
        ) : null}
        {needsStatus ? (
          <TextField select size="small" required label="Allocation Status" value={f.status} onChange={(ev) => set("status", ev.target.value)}>
            {INTERNAL_START_STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </TextField>
        ) : null}
        <TextField select size="small" required label="Travel Required?" value={f.travel} onChange={(ev) => set("travel", ev.target.value as "Yes" | "No")}>
          <MenuItem value="Yes">Yes</MenuItem>
          <MenuItem value="No">No</MenuItem>
        </TextField>
        {!needsStatus ? <span /> : null}
        <TextField
          size="small"
          label="Comment"
          multiline
          minRows={2}
          value={f.comment}
          onChange={(ev) => set("comment", ev.target.value)}
          slotProps={{ htmlInput: { maxLength: 255 } }}
          sx={{ gridColumn: "1 / -1" }}
        />
        {cust ? (
          <FormControlLabel
            sx={{ gridColumn: "1 / -1" }}
            control={<Checkbox size="small" checked={f.tentative} onChange={(ev) => set("tentative", ev.target.checked)} />}
            label="Tentative Allocation"
          />
        ) : null}
        {paid ? (
          <>
            <FormControlLabel
              control={<Checkbox size="small" checked={f.preparation} onChange={(ev) => set("preparation", ev.target.checked)} />}
              label="Preparation Overhead"
            />
            {f.preparation ? date("preparationStart", "Preparation Start", addDays(e.start, -14), e.end) : <span />}
            <FormControlLabel
              control={<Checkbox size="small" checked={f.postEngagement} onChange={(ev) => set("postEngagement", ev.target.checked)} />}
              label="Post Engagement Overhead"
            />
            {f.postEngagement ? date("postEngagementEnd", "Post Engagement End", e.start, addDays(e.end, 14)) : <span />}
          </>
        ) : null}
      </Box>
    </EaDialog>
  );
}
