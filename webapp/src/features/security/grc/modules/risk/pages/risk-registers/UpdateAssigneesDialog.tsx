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

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import type { JSX } from "react";
import { formatBackendTimestampForDisplay } from "@features/security/grc/utils/dateTime";
import {
  fetchManagementApprovers,
  fetchRiskAssignerCandidates,
  fetchRiskOwnerCandidates,
  resolveUserByEmail,
  searchEmployees,
} from "../../api/riskApi";
import type {
  EmployeeOption,
  RiskDetail,
  RiskTeam,
  UpdateAssigneesPayload,
  UserOption,
} from "../../api/riskApi";
import { dialogPaperSx } from "../cardStyles";
import { useAuthApiClient } from "@features/security/grc/shim/useAuthApiClient";

// Minimum characters before searching — matches the backend's own floor.
const MIN_EMPLOYEE_SEARCH_LEN = 2;
const EMPLOYEE_SEARCH_DEBOUNCE_MS = 300;

// withCurrent keeps the risk's saved person selectable even when they are not
// among today's candidates — a migrated risk can name a placeholder who holds
// no grant — so opening the dialog never silently blanks a field.
function withCurrent(candidates: UserOption[], id: number, name: string): UserOption[] {
  if (!id || candidates.some((u) => u.id === id)) return candidates;
  return [...candidates, { id, display_name: name || `User #${id}`, email: "", risk_team_ids: [] }];
}

interface UpdateAssigneesDialogProps {
  open: boolean;
  detail: RiskDetail;
  assignmentTeams: RiskTeam[];
  // Only used to show the current Action Owner's name — RiskDetail carries the
  // action owner's id but not their name.
  users: UserOption[];
  onClose: () => void;
  onSave: (payload: UpdateAssigneesPayload) => Promise<void>;
}

// UpdateAssigneesDialog corrects a migrated risk's people and assignment team
// during its correction window (RISK_MODULE_DESIGN.md §7, Assignee correction
// rule). Deliberately separate from EditRiskDialog: it works in any status,
// never triggers re-approval, and sends only the fields that changed.
export default function UpdateAssigneesDialog({
  open,
  detail,
  assignmentTeams,
  users,
  onClose,
  onSave,
}: UpdateAssigneesDialogProps): JSX.Element {
  const authFetch = useAuthApiClient();

  const [assignerId, setAssignerId] = useState(detail.assigner_id);
  const [ownerId, setOwnerId] = useState(detail.owner_id);
  const [managementApproverId, setManagementApproverId] = useState(detail.management_approver_id);
  const [assignmentTeamId, setAssignmentTeamId] = useState(detail.assignment_team_id);
  const currentActionOwnerId = detail.action_plan?.action_owner_id ?? null;
  const [actionOwnerId, setActionOwnerId] = useState<number | null>(currentActionOwnerId);

  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");

  // Candidates are role-filtered exactly as in Add Risk, so only someone who
  // already holds the grant can be picked and will not 403 when they act.
  // Assigner is scoped to the source register; Owner and Management Approver
  // to the source register and the (possibly changed) assignment team.
  const [assignerCandidates, setAssignerCandidates] = useState<UserOption[]>([]);
  const [ownerCandidates, setOwnerCandidates] = useState<UserOption[]>([]);
  const [managementApprovers, setManagementApprovers] = useState<UserOption[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchRiskAssignerCandidates(authFetch, [detail.source_register_id])
      .then((list) => { if (!cancelled) setAssignerCandidates(list); })
      .catch(() => { if (!cancelled) setAssignerCandidates([]); });
    return () => { cancelled = true; };
  }, [open, authFetch, detail.source_register_id]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const teamIds = [detail.source_register_id, assignmentTeamId];
    fetchRiskOwnerCandidates(authFetch, teamIds)
      .then((list) => { if (!cancelled) setOwnerCandidates(list); })
      .catch(() => { if (!cancelled) setOwnerCandidates([]); });
    fetchManagementApprovers(authFetch, teamIds)
      .then((list) => { if (!cancelled) setManagementApprovers(list); })
      .catch(() => { if (!cancelled) setManagementApprovers([]); });
    // Cancelled on the next team change, so a slower earlier request can
    // never overwrite the list for the team now selected.
    return () => { cancelled = true; };
  }, [open, authFetch, detail.source_register_id, assignmentTeamId]);

  // Action Owner can be any employee, searched live against the HR entity and
  // resolved to a user id on selection — same as Add Risk and Edit Risk.
  const [actionOwnerOptions, setActionOwnerOptions] = useState<EmployeeOption[]>([]);
  const [actionOwnerSelected, setActionOwnerSelected] = useState<EmployeeOption | null>(null);
  const [actionOwnerSearchLoading, setActionOwnerSearchLoading] = useState(false);
  const [actionOwnerResolving, setActionOwnerResolving] = useState(false);
  const [actionOwnerError, setActionOwnerError] = useState<string | null>(null);
  const actionOwnerDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runActionOwnerSearch = useCallback((query: string) => {
    if (query.trim().length < MIN_EMPLOYEE_SEARCH_LEN) {
      setActionOwnerOptions([]);
      setActionOwnerError(null);
      return;
    }
    setActionOwnerSearchLoading(true);
    setActionOwnerError(null);
    searchEmployees(authFetch, query)
      .then(setActionOwnerOptions)
      .catch(() => {
        setActionOwnerOptions([]);
        setActionOwnerError("Unable to reach the employee directory. Please try again.");
      })
      .finally(() => setActionOwnerSearchLoading(false));
  }, [authFetch]);

  const handleActionOwnerInputChange = (value: string): void => {
    if (actionOwnerDebounce.current) clearTimeout(actionOwnerDebounce.current);
    actionOwnerDebounce.current = setTimeout(() => runActionOwnerSearch(value), EMPLOYEE_SEARCH_DEBOUNCE_MS);
  };

  useEffect(() => {
    if (!open) return;
    setAssignerId(detail.assigner_id);
    setOwnerId(detail.owner_id);
    setManagementApproverId(detail.management_approver_id);
    setAssignmentTeamId(detail.assignment_team_id);
    setActionOwnerId(detail.action_plan?.action_owner_id ?? null);
    const currentActionOwner = users.find((u) => u.id === detail.action_plan?.action_owner_id);
    setActionOwnerSelected(
      currentActionOwner ? { name: currentActionOwner.display_name, email: currentActionOwner.email } : null,
    );
    setActionOwnerError(null);
    setApiError("");
  }, [open, detail, users]);

  const payload: UpdateAssigneesPayload = {};
  if (assignerId !== detail.assigner_id) payload.assigner_id = assignerId;
  if (ownerId !== detail.owner_id) payload.owner_id = ownerId;
  if (managementApproverId !== detail.management_approver_id) payload.management_approver_id = managementApproverId;
  if (assignmentTeamId !== detail.assignment_team_id) payload.assignment_team_id = assignmentTeamId;
  if (actionOwnerId !== null && actionOwnerId !== currentActionOwnerId) payload.action_owner_id = actionOwnerId;
  const hasChanges = Object.keys(payload).length > 0;

  const handleSave = async () => {
    if (!hasChanges) return;
    setSubmitting(true);
    setApiError("");
    try {
      await onSave(payload);
      onClose();
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : "Failed to update assignees.");
    } finally {
      setSubmitting(false);
    }
  };

  const deadline = formatBackendTimestampForDisplay(detail.assignees_editable_until, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const assignerOptions = withCurrent(assignerCandidates, detail.assigner_id, detail.assigner_name);
  const ownerOptions = withCurrent(ownerCandidates, detail.owner_id, detail.owner_name);
  const managementApproverOptions = withCurrent(
    managementApprovers,
    detail.management_approver_id,
    detail.management_approver_name,
  );

  return (
    <Dialog
      open={open}
      onClose={() => !submitting && onClose()}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: dialogPaperSx }}
    >
      {/* DialogTitle already renders an <h2>, so both children are spans. */}
      <DialogTitle>
        <Typography component="span" variant="h6" fontWeight={700} display="block">
          Update Assignees
        </Typography>
        <Typography component="span" variant="caption" color="text.secondary" display="block">
          {detail.risk_code}
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        <Stack gap={2.5} sx={{ py: 1 }}>
          {apiError && <Alert severity="error">{apiError}</Alert>}

          <Alert severity="info">
            This risk came from the risk register migration, so its people and assignment team
            can be corrected{deadline ? <> until <strong>{deadline}</strong></> : null}. Changes here
            don&apos;t send the risk for re-approval, and no one is emailed.
          </Alert>

          <FormControl fullWidth disabled={submitting}>
            <InputLabel>Risk Assigned To</InputLabel>
            <Select label="Risk Assigned To" value={assignerId} onChange={(e) => setAssignerId(Number(e.target.value))}>
              {assignerOptions.map((u) => <MenuItem key={u.id} value={u.id}>{u.display_name}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl fullWidth disabled={submitting}>
            <InputLabel>Assignment Team</InputLabel>
            <Select label="Assignment Team" value={assignmentTeamId} onChange={(e) => setAssignmentTeamId(Number(e.target.value))}>
              {assignmentTeams.map((t) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl fullWidth disabled={submitting}>
            <InputLabel>Risk Owner</InputLabel>
            <Select label="Risk Owner" value={ownerId} onChange={(e) => setOwnerId(Number(e.target.value))}>
              {ownerOptions.map((u) => <MenuItem key={u.id} value={u.id}>{u.display_name}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl fullWidth disabled={submitting}>
            <InputLabel>Management Approver</InputLabel>
            <Select
              label="Management Approver"
              value={managementApproverId}
              onChange={(e) => setManagementApproverId(Number(e.target.value))}
            >
              {managementApproverOptions.map((u) => <MenuItem key={u.id} value={u.id}>{u.display_name}</MenuItem>)}
            </Select>
          </FormControl>

          <Autocomplete
            options={actionOwnerOptions}
            loading={actionOwnerSearchLoading || actionOwnerResolving}
            filterOptions={(opts) => opts}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.email === value.email}
            value={actionOwnerSelected}
            disabled={submitting}
            onInputChange={(_, newInputValue, reason) => {
              if (reason === "input") handleActionOwnerInputChange(newInputValue);
            }}
            onChange={(_, newValue) => {
              // Clearing the field means "leave it as it is" — the correction
              // never removes an Action Owner, only replaces one.
              if (!newValue) {
                setActionOwnerSelected(null);
                setActionOwnerId(currentActionOwnerId);
                return;
              }
              setActionOwnerResolving(true);
              resolveUserByEmail(authFetch, newValue)
                .then((resolved) => {
                  setActionOwnerSelected(newValue);
                  setActionOwnerId(resolved.id);
                  setActionOwnerError(null);
                })
                .catch(() => {
                  setActionOwnerSelected(null);
                  setActionOwnerId(currentActionOwnerId);
                  setActionOwnerError("Unable to link this employee to a user account. Please try again.");
                })
                .finally(() => setActionOwnerResolving(false));
            }}
            loadingText="Searching…"
            noOptionsText={actionOwnerError ?? "Type at least 2 characters of the employee's email to search"}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Action Owner"
                placeholder="Search by email"
                error={!!actionOwnerError}
                helperText={actionOwnerError ?? undefined}
              />
            )}
          />
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={() => !submitting && onClose()} disabled={submitting} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={submitting || !hasChanges} variant="contained">
          {submitting ? "Saving..." : "Save Changes"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
