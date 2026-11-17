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

import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { useState, type JSX } from "react";
import { useGetDeadlineDays } from "@features/security/grc/modules/audit/api/useGetDeadlineDays";
import { useUpdateDeadlineDays } from "@features/security/grc/modules/audit/api/useUpdateDeadlineDays";
import { useAuditPrivileges } from "@features/security/grc/modules/audit/hooks/useAuditPrivileges";
import { AuditPrivilege } from "@features/security/grc/modules/audit/privileges";
import type { DeadlineDayRow, DeadlineRecalcSummary } from "@features/security/grc/modules/audit/types/audit";
import {
  DEADLINE_CYCLES,
  DEADLINE_HANDLERS,
  DEADLINE_PHASES,
  rowPhase,
  allowedDaysError,
  buildDeadlineDaysUpdate,
  deadlineCellKey,
  draftFromRows,
  validateDraft,
} from "@features/security/grc/modules/audit/utils/deadlineDays";
import { deadlineHandlerLabel } from "@features/security/grc/modules/audit/utils/deadlines";

// ── Form ─────────────────────────────────────────────────────────────────────

interface DeadlineDaysFormProps {
  rows: DeadlineDayRow[];
  isSaving: boolean;
  isPreviewing: boolean;
  error: string | null;
  onSave: (rows: DeadlineDayRow[], draft: Record<string, string>, applyToOpenStages: boolean) => void;
  /** Works out what applying the draft to the open stages would do, without saving. */
  onPreview: (rows: DeadlineDayRow[], draft: Record<string, string>) => void;
  /** The last preview's result, or null when none has been asked for. */
  preview: DeadlineRecalcSummary | null;
  onClearPreview: () => void;
  onClose: () => void;
}

/** What a change does to controls already in progress, shown before saving. */
function previewText(p: DeadlineRecalcSummary): string {
  const controls = `${p.stagesUpdated} ${p.stagesUpdated === 1 ? "control" : "controls"}`;
  const overdue = p.newlyOverdue > 0 ? ` ${p.newlyOverdue} would become overdue if you update them.` : "";
  return `${controls} in progress currently with a group will keep their present deadline unless you update them too.${overdue}`;
}

function DeadlineDaysForm({
  rows, isSaving, isPreviewing, error, onSave, onPreview, preview, onClearPreview, onClose,
}: DeadlineDaysFormProps): JSX.Element {
  const [draft, setDraft] = useState(() => draftFromRows(rows));
  // Errors show once a cell has been touched, so a fresh form is not red.
  const [touched, setTouched] = useState<Set<string>>(new Set());

  const errors = validateDraft(draft);
  const hasChanges = buildDeadlineDaysUpdate(rows, draft).days.length > 0;
  const canSave = !isSaving && !isPreviewing && hasChanges && Object.keys(errors).length === 0;
  // Controls already with a group are affected by this change: the admin chooses
  // whether to update them, so it can never be forgotten.
  const choosing = preview !== null;

  return (
    <>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Days each group has to act on a control once it is handed to them. Design controls and the
          two OE phases are set separately. A change applies to hand-offs that happen afterwards; when it
          would affect controls already with a group, saving asks whether to update those too.
        </Typography>
        {DEADLINE_PHASES.map(({ phase, label: title, hint }) => (
          <Box key={phase} sx={{ mt: phase === "EVIDENCE" ? 0 : 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{title}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>{hint}</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }} />
                  {DEADLINE_HANDLERS.map((h) => (
                    <TableCell key={h} sx={{ fontWeight: 600 }}>{deadlineHandlerLabel(h)}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {DEADLINE_CYCLES.map(({ cycleType, label }) => (
                  <TableRow key={cycleType}>
                    <TableCell sx={{ fontWeight: 600 }}>{label}</TableCell>
                    {DEADLINE_HANDLERS.map((h) => {
                      const key = deadlineCellKey(phase, cycleType, h);
                      const row = rows.find((r) => rowPhase(r) === phase && r.cycleType === cycleType && r.handledBy === h);
                      const err = touched.has(key) ? allowedDaysError(draft[key] ?? "") : null;
                      return (
                        <TableCell key={h} sx={{ verticalAlign: "top" }}>
                          <TextField
                            size="small"
                            value={draft[key] ?? ""}
                            disabled={isSaving || isPreviewing || !row}
                            error={err !== null}
                            helperText={err ?? undefined}
                            onChange={(e) => {
                              onClearPreview();
                              setDraft((d) => ({ ...d, [key]: e.target.value }));
                              setTouched((t) => new Set(t).add(key));
                            }}
                            slotProps={{
                              htmlInput: {
                                inputMode: "numeric",
                                "aria-label": `${label} days for ${deadlineHandlerLabel(h)} (${title})`,
                              },
                            }}
                            sx={{ width: 96 }}
                          />
                          {row?.isDefault && (
                            <Box sx={{ mt: 0.5 }}>
                              <Chip label="Default" size="small" variant="outlined" sx={{ height: 18, fontSize: "0.65rem" }} />
                            </Box>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        ))}
        {preview !== null && (
          <Alert severity={preview.newlyOverdue > 0 ? "warning" : "info"} sx={{ mt: 2 }}>
            {previewText(preview)} Planned dates and ultimate deadlines do not change either way.
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={isSaving || isPreviewing} sx={{ textTransform: "none" }}>
          Cancel
        </Button>
        {choosing ? (
          <>
            <Button
              variant="outlined"
              disabled={isSaving}
              onClick={() => onSave(rows, draft, false)}
              sx={{ textTransform: "none" }}
            >
              Save for new hand-offs only
            </Button>
            <Button
              variant="contained"
              disabled={isSaving}
              onClick={() => onSave(rows, draft, true)}
              startIcon={isSaving ? <CircularProgress size={14} /> : undefined}
              sx={{ textTransform: "none" }}
            >
              {`Save and update ${preview.stagesUpdated} ${preview.stagesUpdated === 1 ? "control" : "controls"}`}
            </Button>
          </>
        ) : (
          <Button
            variant="contained"
            disabled={!canSave}
            onClick={() => onPreview(rows, draft)}
            startIcon={isSaving || isPreviewing ? <CircularProgress size={14} /> : undefined}
            sx={{ textTransform: "none" }}
          >
            Save
          </Button>
        )}
      </DialogActions>
    </>
  );
}

// ── Dialog ───────────────────────────────────────────────────────────────────

interface DeadlineDaysDialogProps {
  auditId: number;
  open: boolean;
  onClose: () => void;
}

/** Allowed-days settings for an audit — for holders of the manage-controls privilege only. */
export default function DeadlineDaysDialog({ auditId, open, onClose }: DeadlineDaysDialogProps): JSX.Element | null {
  const { can } = useAuditPrivileges();
  const canManage = can(AuditPrivilege.ManageControls);

  const { data, isLoading, isError, error: loadError, refetch } = useGetDeadlineDays(auditId, open && canManage);
  const updateMutation = useUpdateDeadlineDays();
  const previewMutation = useUpdateDeadlineDays();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [preview, setPreview] = useState<DeadlineRecalcSummary | null>(null);

  if (!canManage) return null;

  function handleClose() {
    setSaveError(null);
    setPreview(null);
    onClose();
  }

  function handlePreview(rows: DeadlineDayRow[], draft: Record<string, string>) {
    setSaveError(null);
    previewMutation.mutate(
      { auditId, req: { ...buildDeadlineDaysUpdate(rows, draft), dryRun: true } },
      {
        onSuccess: (res) => {
          const found = res.recalculated ?? { stagesUpdated: 0, newlyOverdue: 0 };
          // Nothing in progress is affected, so there is nothing to choose: just save.
          if (found.stagesUpdated === 0) handleSave(rows, draft, false);
          else setPreview(found);
        },
        onError: (e) => setSaveError(e instanceof Error ? e.message : "Failed to check which controls are affected"),
      },
    );
  }

  function handleSave(rows: DeadlineDayRow[], draft: Record<string, string>, applyToOpenStages: boolean) {
    setSaveError(null);
    updateMutation.mutate(
      { auditId, req: { ...buildDeadlineDaysUpdate(rows, draft), ...(applyToOpenStages ? { applyToOpenStages: true } : {}) } },
      {
        onSuccess: handleClose,
        onError: (e) => setSaveError(e instanceof Error ? e.message : "Failed to update deadline days"),
      },
    );
  }

  return (
    <Dialog open={open} // A backdrop click or Escape must not dismiss the dialog mid-request, a check or a save.
      onClose={() => { if (!updateMutation.isPending && !previewMutation.isPending) handleClose(); }} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Deadline Days</DialogTitle>
      {isLoading ? (
        <DialogContent>
          <Skeleton variant="rectangular" height={140} sx={{ borderRadius: 1 }} />
        </DialogContent>
      ) : isError || !data ? (
        <>
          <DialogContent>
            <Alert severity="error">
              {loadError instanceof Error ? loadError.message : "Failed to load deadline days"}
            </Alert>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={handleClose} sx={{ textTransform: "none" }}>Close</Button>
            <Button variant="outlined" onClick={() => void refetch()} sx={{ textTransform: "none" }}>Retry</Button>
          </DialogActions>
        </>
      ) : (
        <DeadlineDaysForm
          // Re-seed the draft when the server's numbers change (after a save).
          key={data.days.map((r) => `${rowPhase(r)}:${r.cycleType}:${r.handledBy}:${r.allowedDays}`).join("|")}
          rows={data.days}
          isSaving={updateMutation.isPending}
          isPreviewing={previewMutation.isPending}
          error={saveError}
          onSave={handleSave}
          onPreview={handlePreview}
          preview={preview}
          onClearPreview={() => setPreview(null)}
          onClose={handleClose}
        />
      )}
    </Dialog>
  );
}
