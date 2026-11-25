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
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import { Download, Upload } from "@wso2/oxygen-ui-icons-react";
import type { JSX } from "react";
import { useAuthApiClient } from "@features/security/grc/shim/useAuthApiClient";
import {
  downloadBulkImportResult,
  downloadBulkImportTemplate,
  fetchBulkImportJob,
  fetchSourceRegisterTeams,
  startBulkImport,
} from "../../api/riskApi";
import type { BulkImportDownload, BulkImportFinding, BulkImportJob, RiskTeam } from "../../api/riskApi";
import { dialogPaperSx } from "../cardStyles";
import { downloadBlob } from "./utils";

const POLL_INTERVAL_MS = 1500;
// Findings shown in the table. The full list is in the errors.csv download.
const MAX_FINDINGS_SHOWN = 100;

const TEMPLATE_LABELS: Record<string, string> = {
  STANDARD: "Standard",
  AGGREGATED: "Aggregated (platforms)",
  MANAGED_SERVICES: "Managed Services",
};

const PHASE_LABELS: Record<string, string> = {
  preflight: "Checking reference data",
  parse: "Reading the file",
  resolve: "Looking up people",
  write: "Writing risks",
  verify: "Verifying what was written",
};

const DOWNLOAD_LABELS: Record<BulkImportDownload, string> = {
  errors: "errors.csv",
  report: "report.txt",
  "risk-codes": "risk_codes.csv",
};

const SEVERITY_ORDER: Record<string, number> = { REJECT: 0, MISMATCH: 1, WARN: 2 };

interface BulkImportDialogProps {
  open: boolean;
  onClose: () => void;
  // Called once an import has finished, so the register list can refresh.
  onImported: () => void;
}

// Imports a historical register from a CSV into one register — Compliance Admin
// only (the backend enforces it; the page only shows the button to holders).
//
// The flow is deliberately two-step, and the server enforces the order: a dry run
// reads the whole file and reports every problem without writing anything, and
// the import is offered only for a file whose dry run found nothing to reject.
// Choosing a different file or register clears the dry run, because its result
// says nothing about the new one.
export default function BulkImportDialog({ open, onClose, onImported }: BulkImportDialogProps): JSX.Element {
  const authFetch = useAuthApiClient();

  const [registers, setRegisters] = useState<RiskTeam[]>([]);
  const [registersError, setRegistersError] = useState("");
  const [registerId, setRegisterId] = useState<number | "">("");
  const [file, setFile] = useState<File | null>(null);

  // The latest job — a dry run, then an import — and an error from starting one.
  const [job, setJob] = useState<BulkImportJob | null>(null);
  // The last dry run, kept while the import that follows replaces `job`.
  const [dryRun, setDryRun] = useState<BulkImportJob | null>(null);
  const [startError, setStartError] = useState("");
  const [starting, setStarting] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  const onImportedRef = useRef(onImported);
  onImportedRef.current = onImported;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setRegistersError("");
    fetchSourceRegisterTeams(authFetch)
      .then((teams) => {
        if (!cancelled) setRegisters(teams.filter((t) => t.status === "ACTIVE" && t.code));
      })
      .catch((e: unknown) => {
        if (!cancelled) setRegistersError(e instanceof Error ? e.message : "Failed to load the registers.");
      });
    return () => {
      cancelled = true;
    };
  }, [open, authFetch]);

  // Poll a running job until it finishes. Closing the dialog stops the polling,
  // not the job: it keeps running on the server.
  const runningId = job?.status === "running" ? job.id : null;
  const runningMode = job?.mode;
  useEffect(() => {
    if (!open || !runningId) return;
    let cancelled = false;
    const timer = setInterval(() => {
      fetchBulkImportJob(authFetch, runningId)
        .then((next) => {
          if (cancelled) return;
          setJob(next);
          if (next.status !== "running") {
            if (runningMode === "dry_run") setDryRun(next);
            if (runningMode === "import") onImportedRef.current();
          }
        })
        .catch((e: unknown) => {
          // A poll that fails (the service restarted, say) is shown, not retried
          // forever: the admin can run the same file again and it resumes.
          if (cancelled) return;
          setStartError(e instanceof Error ? e.message : "Lost track of the import.");
          setJob(null);
        });
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [open, runningId, runningMode, authFetch]);

  const reset = useCallback(() => {
    setJob(null);
    setDryRun(null);
    setStartError("");
    setAcknowledged(false);
    setDownloadError("");
  }, []);

  const running = job?.status === "running";
  const selectedRegister = registers.find((r) => r.id === registerId) ?? null;

  const handleClose = () => {
    if (running || starting) return;
    reset();
    setFile(null);
    setRegisterId("");
    onClose();
  };

  const start = async (mode: "dry_run" | "import") => {
    if (registerId === "" || !file) return;
    setStarting(true);
    setStartError("");
    setDownloadError("");
    try {
      const accepted = await startBulkImport(authFetch, {
        registerId,
        mode,
        file,
        acknowledgeWarnings: mode === "import" && acknowledged,
      });
      setJob(accepted);
      if (mode === "dry_run") {
        setDryRun(null);
        setAcknowledged(false);
      }
    } catch (e: unknown) {
      setStartError(e instanceof Error ? e.message : "Could not start the import.");
    } finally {
      setStarting(false);
    }
  };

  const download = async (task: () => Promise<{ blob: Blob; fileName: string }>) => {
    setDownloadError("");
    try {
      const { blob, fileName } = await task();
      downloadBlob(blob, fileName);
    } catch (e: unknown) {
      setDownloadError(e instanceof Error ? e.message : "Failed to download the file.");
    }
  };

  // What the latest dry run allows. The server decides; this only mirrors it so
  // the button is not offered for a file that would be refused.
  const dryCounts = dryRun?.counts;
  const warnings = dryCounts?.warnings ?? 0;
  // When the dry run knows what the import would write, nothing to write means
  // nothing to import: every row is already in the register.
  const toWrite = dryCounts?.plan_known ? (dryCounts.to_write ?? 0) : (dryRun?.rows ?? 0);
  const canImport =
    !!dryRun &&
    dryRun.status === "succeeded" &&
    dryRun.importable &&
    toWrite > 0 &&
    (warnings === 0 || acknowledged) &&
    !running &&
    !starting &&
    job?.mode !== "import";
  const importFinished = job?.mode === "import" && job.status !== "running";

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md" PaperProps={{ sx: dialogPaperSx }}>
      <DialogTitle>Import risks from CSV</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Alert severity="info">
            Use this to load a historical register. Imported risks enter as Approved or Closed, and each person named in the
            file is given the access their role needs. Do not raise risks in the register while an import runs, because risk
            numbers are assigned in order, and do not start two imports at once.
          </Alert>

          {registersError && <Alert severity="error">{registersError}</Alert>}

          <FormControl fullWidth size="small" disabled={running || starting}>
            <InputLabel id="bulk-import-register">Register</InputLabel>
            <Select
              labelId="bulk-import-register"
              label="Register"
              value={registerId}
              onChange={(e) => {
                setRegisterId(Number(e.target.value) || "");
                reset();
              }}
            >
              {registers.map((r) => (
                <MenuItem key={r.id} value={r.id}>
                  {r.name} — {TEMPLATE_LABELS[r.register_template] ?? r.register_template}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Download size={16} />}
              disabled={!selectedRegister || running || starting}
              onClick={() => selectedRegister && void download(() => downloadBulkImportTemplate(authFetch, selectedRegister.id))}
            >
              Download template
            </Button>
            <Button
              component="label"
              variant="outlined"
              size="small"
              startIcon={<Upload size={16} />}
              disabled={!selectedRegister || running || starting}
            >
              Choose CSV file
              <input
                hidden
                type="file"
                accept=".csv,text/csv"
                aria-label="CSV file"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  reset();
                  e.target.value = ""; // so choosing the same file again still fires
                }}
              />
            </Button>
            <Typography variant="body2" color="text.secondary" noWrap>
              {file ? file.name : "No file chosen"}
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            The template has only the columns this register needs, in order. Save your sheet as CSV (UTF-8). At most 1000 rows.
          </Typography>

          {startError && <Alert severity="error">{startError}</Alert>}
          {downloadError && <Alert severity="error">{downloadError}</Alert>}

          {running && job && <Progress job={job} />}

          {job?.status === "failed" && (
            <Alert severity="error">
              {job.error ?? "The run could not complete."}
              {job.mode === "import" && job.counts && job.counts.migrated + job.counts.skipped > 0
                ? " Some rows may already be written; run the same file again to continue."
                : ""}
            </Alert>
          )}

          {dryRun?.status === "succeeded" && job?.mode === "dry_run" && (
            <DryRunResult dryRun={dryRun} acknowledged={acknowledged} onAcknowledge={setAcknowledged} />
          )}

          {importFinished && job.status === "succeeded" && <ImportResult job={job} />}

          {job && job.status !== "running" && (job.downloads?.length ?? 0) > 0 && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
              <Typography variant="body2">Download:</Typography>
              {job.downloads?.map((d) => (
                <Button
                  key={d}
                  size="small"
                  variant="text"
                  startIcon={<Download size={14} />}
                  onClick={() => void download(() => downloadBulkImportResult(authFetch, job.id, d))}
                >
                  {DOWNLOAD_LABELS[d]}
                </Button>
              ))}
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={running || starting}>
          {importFinished ? "Close" : "Cancel"}
        </Button>
        <Button
          variant="outlined"
          disabled={registerId === "" || !file || running || starting || job?.mode === "import"}
          onClick={() => void start("dry_run")}
        >
          Run dry run
        </Button>
        <Button variant="contained" disabled={!canImport} onClick={() => void start("import")}>
          Import {toWrite > 0 ? `${toWrite} ${toWrite === 1 ? "row" : "rows"}` : ""}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function Progress({ job }: { job: BulkImportJob }): JSX.Element {
  const label = PHASE_LABELS[job.phase ?? ""] ?? "Working";
  const determinate = job.total > 0 && job.phase === "write";
  return (
    <Box>
      <Typography variant="body2" sx={{ mb: 0.5 }}>
        {job.mode === "dry_run" ? "Dry run" : "Import"}: {label}
        {determinate ? ` (${job.done} of ${job.total})` : "…"}
      </Typography>
      <LinearProgress variant={determinate ? "determinate" : "indeterminate"} value={determinate ? (job.done / job.total) * 100 : 0} />
      {job.mode === "import" && (
        <Typography variant="caption" color="text.secondary">
          Keep this window open. If it closes, the import keeps running; run the same file again to see where it got to.
        </Typography>
      )}
    </Box>
  );
}

function DryRunResult({
  dryRun,
  acknowledged,
  onAcknowledge,
}: {
  dryRun: BulkImportJob;
  acknowledged: boolean;
  onAcknowledge: (v: boolean) => void;
}): JSX.Element {
  const counts = dryRun.counts;
  const rejects = counts?.rejects ?? 0;
  const warnings = counts?.warnings ?? 0;
  const planKnown = !!counts?.plan_known;
  const toWrite = counts?.to_write ?? 0;
  const alreadyDone = counts?.already_done ?? 0;
  const nothingToImport = rejects === 0 && planKnown && toWrite === 0;
  const findings = [...(dryRun.findings ?? [])].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9) || a.csv_row - b.csv_row,
  );

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Chip size="small" label={`${dryRun.rows} rows`} />
        <Chip size="small" color={rejects ? "error" : "success"} label={`${rejects} rejected`} />
        <Chip size="small" color={warnings ? "warning" : "default"} label={`${warnings} warnings`} />
        {planKnown && rejects === 0 && <Chip size="small" color="info" label={`${toWrite} to write`} />}
        {planKnown && alreadyDone > 0 && <Chip size="small" label={`${alreadyDone} already there`} />}
      </Stack>

      {rejects > 0 ? (
        <Alert severity="error">
          Nothing was written, and this file cannot be imported while any row is rejected. Fix the rows below in the
          sheet and run the dry run again.
        </Alert>
      ) : nothingToImport ? (
        <Alert severity="info">
          Every row in this file is already in the register from an earlier import, so there is nothing to import. Nothing
          was written.
        </Alert>
      ) : (
        <Alert severity="success">
          The dry run found nothing to reject. Nothing has been written yet.
          {planKnown
            ? ` The import would write ${toWrite} ${toWrite === 1 ? "row" : "rows"}${alreadyDone > 0 ? ` and skip ${alreadyDone} that ${alreadyDone === 1 ? "is" : "are"} already there` : ""}.`
            : ""}
          {dryRun.importable_until ? ` You can import this file until ${new Date(dryRun.importable_until).toLocaleTimeString()}.` : ""}
        </Alert>
      )}

      {rejects === 0 && !nothingToImport && warnings > 0 && (
        <FormControlLabel
          control={<Checkbox checked={acknowledged} onChange={(e) => onAcknowledge(e.target.checked)} />}
          label="I have reviewed the warnings and accept them"
        />
      )}

      {findings.length > 0 && <FindingsTable findings={findings} truncated={!!dryRun.findings_truncated} />}
    </Stack>
  );
}

function FindingsTable({ findings, truncated }: { findings: BulkImportFinding[]; truncated: boolean }): JSX.Element {
  const shown = findings.slice(0, MAX_FINDINGS_SHOWN);
  return (
    <Box>
      <TableContainer sx={{ maxHeight: 320 }}>
        <Table size="small" stickyHeader aria-label="Findings">
          <TableHead>
            <TableRow>
              <TableCell>Row</TableCell>
              <TableCell>Severity</TableCell>
              <TableCell>Field</TableCell>
              <TableCell>Detail</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {shown.map((f, i) => (
              <TableRow key={`${f.csv_row}-${f.failure}-${i}`}>
                <TableCell>{f.csv_row > 0 ? f.csv_row : "—"}</TableCell>
                <TableCell>
                  <Chip size="small" color={f.severity === "WARN" ? "warning" : "error"} label={f.severity} />
                </TableCell>
                <TableCell>{f.failure}</TableCell>
                <TableCell>{f.detail}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {(findings.length > shown.length || truncated) && (
        <Typography variant="caption" color="text.secondary">
          Showing the first {shown.length}. Download errors.csv for the full list.
        </Typography>
      )}
    </Box>
  );
}

function ImportResult({ job }: { job: BulkImportJob }): JSX.Element {
  const c = job.counts;
  const problems = (c?.mismatches ?? 0) > 0 || (c?.rejects ?? 0) > 0;
  return (
    <Alert severity={problems ? "warning" : "success"}>
      {problems
        ? "The import finished, but the check afterwards found differences. Download errors.csv and report.txt."
        : "The import finished and what was written matches the file."}{" "}
      {c ? `${c.migrated} written, ${c.skipped} already there.` : ""} Download risk_codes.csv for the risk number of every row.
    </Alert>
  );
}
