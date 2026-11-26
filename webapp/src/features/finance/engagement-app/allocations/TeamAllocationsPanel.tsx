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
import { Alert, Autocomplete, Box, Button, Menu, MenuItem, Stack, TextField, Typography, Skeleton } from "@wso2/oxygen-ui";
import { PlusIcon, UploadIcon } from "@wso2/oxygen-ui-icons-react";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { localIsoDate } from "@utils/localDate";
import type { AllocationTypeDef, BulkValidation, EmployeeOption, TimelineItem } from "../api/engagementTypes";
import { useEngagementTypes, useOrgStructure, useReferenceData, useTeamAllocations } from "../api/useEngagementApi";
import {
  useCreateTeamAllocation,
  useDeleteTeamAllocation,
  useIdempotencyKey,
  useUpdateTeamAllocation,
  useUploadTeamAllocations,
  useValidateTeamUpload,
} from "../api/useEngagementMutations";
import EaDialog, { ConfirmDialog } from "../components/EaDialog";
import { Failed } from "../components/ListCard";
import { addDays, fmtRange, typeColor, plural } from "../model/format";
import { validateTeamAllocation } from "../model/allocationForm";
import { FilterBar, FilterDate, FilterInput, FilterSelect } from "../components/FilterFields";
import Timeline, { type TimelineRow } from "./Timeline";

/** Team Allocations: the default allocations per team (engagement -1), what a team is doing when it is not on an engagement. */
export default function TeamAllocationsPanel(): JSX.Element {
  const today = localIsoDate();
  const ref = useReferenceData();
  const org = useOrgStructure();
  const types = useEngagementTypes();
  const teamTypes = types.data?.find((t) => t.id === 1)?.allocationTypes ?? [];
  const initial = { businessUnit: "", department: "", team: "", types: [] as string[], start: addDays(today, -14), end: addDays(today, 42) };
  const [draft, setDraft] = useState(initial);
  const [search, setSearch] = useState<typeof draft | null>(null);
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<{ who: EmployeeOption; allocation?: TimelineItem } | null>(null);
  const [deleting, setDeleting] = useState<TimelineItem | null>(null);
  const [barMenu, setBarMenu] = useState<{ anchor: HTMLElement; allocation: TimelineItem; who: EmployeeOption } | null>(null);
  const [bulk, setBulk] = useState(false);
  const remove = useDeleteTeamAllocation();
  const notify = useNotifications();

  // One call: the team's people, each with their engagement and default allocations over the window.
  const people = useTeamAllocations(
    {
      businessUnit: search?.businessUnit || undefined,
      department: search?.department || undefined,
      team: search?.team || undefined,
      allocationTypeId: search?.types.length ? search.types : undefined,
      from: search?.start,
      to: search?.end,
    },
    Boolean(search),
  );

  const departments = (org.data?.departments ?? []).filter((d) => !draft.businessUnit || d.businessUnit === draft.businessUnit).map((d) => d.name);
  const teams = (org.data?.teams ?? []).filter(
    (t) => (!draft.businessUnit || t.businessUnit === draft.businessUnit) && (!draft.department || t.department === draft.department),
  );

  const rows: TimelineRow[] = (people.data ?? []).map(({ person: who, items }) => ({
    key: who.email,
    label: who.name || who.email,
    sub: who.jobBand ?? who.title,
    bars: items.map((a) => ({
      key: a.id,
      start: a.start,
      end: a.end,
      label: a.label || `${a.code}: ${a.allocationType}`,
      title: `${a.id}: ${a.kind === "default" ? a.allocationType : a.label}, ${fmtRange(a.start, a.end)}`,
      color: a.color || typeColor(a.allocationType, teamTypes.find((x) => x.name === a.allocationType)?.color),
      type: a.allocationType,
      thin: Boolean(a.hourly),
      // A team allocation still within its 30 days opens Edit / Delete.
      onClick: a.kind === "default" && a.editable ? (anchor: HTMLElement) => setBarMenu({ anchor, allocation: a, who }) : undefined,
    })),
    action: (
      <Button size="small" variant="outlined" startIcon={<PlusIcon size={14} />} onClick={() => setEditing({ who })}>
        Add
      </Button>
    ),
  }));

  return (
    <Box>
      <FilterBar
        onSearch={() => {
          if (!draft.businessUnit && !draft.department && !draft.team) return setNotice("Select a Business Unit, Department or Team");
          if (!draft.start || !draft.end || draft.start > draft.end) return setNotice("Start Date must be on or before End Date");
          setNotice("");
          setSearch(draft);
        }}
        onReset={() => {
          setDraft(initial);
          setSearch(null);
          setNotice("");
        }}
        start={
          <Button size="small" variant="outlined" startIcon={<UploadIcon size={14} />} onClick={() => setBulk(true)}>
            Bulk Upload
          </Button>
        }
      >
        <FilterSelect
          label="Business Unit"
          value={draft.businessUnit}
          options={org.data?.businessUnits ?? ref.data?.businessUnits ?? []}
          onChange={(v) => setDraft((d) => ({ ...d, businessUnit: v, department: "", team: "" }))}
        />
        <FilterSelect label="Department" value={draft.department} options={departments} onChange={(v) => setDraft((d) => ({ ...d, department: v, team: "" }))} />
        <FilterSelect label="Team" value={draft.team} options={teams.map((t) => t.name)} onChange={(v) => setDraft((d) => ({ ...d, team: v }))} />
        <Autocomplete
          multiple
          size="small"
          options={teamTypes}
          getOptionLabel={(t) => t.name}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          value={teamTypes.filter((t) => draft.types.includes(t.id))}
          onChange={(_, v) => setDraft((d) => ({ ...d, types: v.map((t) => t.id) }))}
          renderInput={(params) => <FilterInput params={params} label="By Allocation Types" />}
        />
        <FilterDate label="Start Date" value={draft.start} onChange={(v) => setDraft((d) => ({ ...d, start: v }))} />
        <FilterDate label="End Date" value={draft.end} onChange={(v) => setDraft((d) => ({ ...d, end: v }))} />
      </FilterBar>
      {notice ? (
        <Alert severity="info" sx={{ mb: 1.5 }} onClose={() => setNotice("")}>
          {notice}
        </Alert>
      ) : null}
      {people.isError ? <Failed what="the team" error={people.error} onRetry={() => void people.refetch()} retrying={people.isFetching} /> : null}
      {search && people.isPending ? (
        <Skeleton variant="rounded" height={220} />
      ) : search ? (
        <Timeline
          start={search.start}
          end={search.end}
          rows={rows}
          marks={[{ date: today, label: "Today", tone: "today" }]}
          empty="Nobody in this team."
        />
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center", border: 1, borderColor: "divider", borderRadius: 1.5 }}>
          Pick a Business Unit, Department or Team and search to see its default allocations.
        </Typography>
      )}

      <Menu anchorEl={barMenu?.anchor} open={Boolean(barMenu)} onClose={() => setBarMenu(null)}>
        <MenuItem
          onClick={() => {
            if (barMenu) setEditing({ who: barMenu.who, allocation: barMenu.allocation });
            setBarMenu(null);
          }}
        >
          Edit
        </MenuItem>
        <MenuItem
          sx={{ color: "error.main" }}
          onClick={() => {
            if (barMenu) setDeleting(barMenu.allocation);
            setBarMenu(null);
          }}
        >
          Delete
        </MenuItem>
      </Menu>

      {editing ? (
        <TeamAllocationDialog who={editing.who} allocation={editing.allocation} types={teamTypes} today={today} onClose={() => setEditing(null)} />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          title="Delete Allocation"
          confirmLabel="Delete"
          busyLabel="Deleting…"
          text={`Are you sure you want to delete ${deleting.id} (${deleting.allocationType}, ${fmtRange(deleting.start, deleting.end)})?`}
          danger
          run={() => remove.mutateAsync({ id: deleting.id })}
          onDone={() => notify.showSuccess("Allocation deleted successfully")}
          onClose={() => setDeleting(null)}
        />
      ) : null}
      {bulk ? <BulkUploadDialog onClose={() => setBulk(false)} /> : null}
    </Box>
  );
}

function TeamAllocationDialog({
  who,
  allocation,
  types,
  today,
  onClose,
}: {
  who: EmployeeOption;
  allocation?: TimelineItem;
  types: readonly AllocationTypeDef[];
  today: string;
  onClose: () => void;
}): JSX.Element {
  const [f, setF] = useState({
    allocationType: allocation?.allocationType ?? "",
    code: allocation?.code ?? "",
    start: allocation?.start ?? today,
    end: allocation?.end ?? addDays(today, 13),
    comment: allocation?.comment ?? "",
  });
  const [error, setError] = useState<unknown>();
  const create = useCreateTeamAllocation();
  const update = useUpdateTeamAllocation();
  const idem = useIdempotencyKey();
  const busy = create.isPending || update.isPending;
  const notify = useNotifications();
  const typeDef = types.find((t) => t.name === f.allocationType);
  return (
    <EaDialog
      title={allocation ? "Update Allocation" : "Add New Allocation"}
      subtitle="Team allocation"
      confirmLabel={allocation ? "Update Allocation" : "Add Allocation"}
      busy={busy}
      error={error}
      onClose={onClose}
      onConfirm={() => {
        const problem = validateTeamAllocation(f, today, Boolean(allocation));
        if (problem) return setError(problem);
        const done = {
          onSuccess: () => {
            notify.showSuccess(allocation ? "Allocation updated successfully" : "Allocation added successfully");
            onClose();
          },
          onError: setError,
        };
        if (allocation) {
          update.mutate({ id: allocation.id, startDate: f.start, endDate: f.end, comment: f.comment }, done);
        } else if (typeDef) {
          create.mutate(
            {
              body: {
                email: who.email,
                allocationTypeId: Number(typeDef.id),
                // The type's default code applies; a typed code only when the type has none.
                engagementCode: typeDef.code ? undefined : f.code,
                startDate: f.start,
                endDate: f.end,
                comment: f.comment || undefined,
              },
              idempotencyKey: idem.key,
            },
            done,
          );
        }
      }}
    >
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2, pt: 1 }}>
        <TextField size="small" label="Email" value={who.email} slotProps={{ input: { readOnly: true } }} sx={{ gridColumn: "1 / -1" }} />
        <TextField
          select
          size="small"
          required
          label="Select Allocation Type"
          value={f.allocationType}
          disabled={Boolean(allocation)}
          onChange={(ev) => {
            const t = types.find((x) => x.name === ev.target.value);
            setF((p) => ({ ...p, allocationType: ev.target.value, code: t?.code ? `${t.code}${t.suffix ? `-${t.suffix}` : ""}` : "" }));
          }}
        >
          {types.map((t) => (
            <MenuItem key={t.name} value={t.name}>
              {t.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          required
          label="Engagement Code"
          value={f.code}
          onChange={(ev) => setF((p) => ({ ...p, code: ev.target.value }))}
          slotProps={{ input: { readOnly: Boolean(typeDef?.code), sx: { fontFamily: "monospace" } } }}
        />
        <TextField size="small" type="date" required label="Start Date" value={f.start} onChange={(ev) => setF((p) => ({ ...p, start: ev.target.value }))} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField size="small" type="date" required label="End Date" value={f.end} onChange={(ev) => setF((p) => ({ ...p, end: ev.target.value }))} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField
          size="small"
          label="Comment"
          multiline
          minRows={2}
          value={f.comment}
          onChange={(ev) => setF((p) => ({ ...p, comment: ev.target.value }))}
          slotProps={{ htmlInput: { maxLength: 255 } }}
          sx={{ gridColumn: "1 / -1" }}
        />
      </Box>
    </EaDialog>
  );
}

/** Bulk Upload: CSV rows of username, team, start, end and allocation type, checked by the backend. */
function BulkUploadDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const [csv, setCsv] = useState("");
  const [error, setError] = useState<unknown>();
  // Step one checks the rows (nothing saved); step two saves the valid ones.
  const [checked, setChecked] = useState<BulkValidation | null>(null);
  const validate = useValidateTeamUpload();
  const upload = useUploadTeamAllocations();
  const idem = useIdempotencyKey();
  const notify = useNotifications();
  return (
    <EaDialog
      title="Bulk Upload"
      subtitle="Team allocations from a CSV file: username, team, start date, end date, allocation type."
      confirmLabel={checked?.valid.length ? "Add Allocations" : "Validate"}
      busy={validate.isPending || upload.isPending}
      error={error}
      onClose={onClose}
      onConfirm={() => {
        if (!csv.trim()) return setError("Paste the CSV rows or choose a file");
        setError(undefined);
        if (!checked?.valid.length) {
          validate.mutate({ csv }, { onSuccess: (res) => setChecked(res), onError: setError });
          return;
        }
        upload.mutate(
          { csv, idempotencyKey: idem.key },
          {
            onSuccess: (res) => {
              notify.showSuccess(`${plural(res?.saved ?? 0, "team allocation")} uploaded successfully`);
              onClose();
            },
            onError: setError,
          },
        );
      }}
    >
      <Stack spacing={2} sx={{ pt: 1 }}>
        <Button variant="outlined" component="label" startIcon={<UploadIcon size={15} />} sx={{ alignSelf: "flex-start" }}>
          Choose CSV File
          <input
            hidden
            type="file"
            accept=".csv,text/csv"
            onChange={(ev) => {
              const file = ev.target.files?.[0];
              if (file)
                void file.text().then((text) => {
                  setCsv(text);
                  setChecked(null);
                  idem.renew();
                });
            }}
          />
        </Button>
        <TextField
          multiline
          minRows={6}
          label="Or Paste the Rows"
          placeholder="shayan,Finance Apps,2026-11-02,2026-11-06,Digital Operations"
          value={csv}
          onChange={(ev) => {
            setCsv(ev.target.value);
            setChecked(null);
            idem.renew();
          }}
          slotProps={{ htmlInput: { style: { fontFamily: "monospace", fontSize: 12.5 } } }}
        />
        {checked?.errors.length ? (
          <Alert severity="warning">
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              {checked.errors.map((m, i) => (
                <li key={`${i}-${m}`}>{m}</li>
              ))}
            </Box>
          </Alert>
        ) : null}
        {checked ? (
          <Typography variant="body2" color="text.secondary">
            {checked.valid.length
              ? `${plural(checked.valid.length, "row")} ready to upload.${checked.errors.length ? " The rows with errors are skipped." : ""}`
              : "No row is ready to upload. Fix the rows and validate again."}
          </Typography>
        ) : null}
      </Stack>
    </EaDialog>
  );
}
