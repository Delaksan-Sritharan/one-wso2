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

import { useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  DataGrid,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { PlusIcon, TrashIcon, UploadIcon } from "@wso2/oxygen-ui-icons-react";
import JSZip from "jszip";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import {
  bundleInfoApplies,
  bundlesInfoPathError,
  isManualFileTooLarge,
  isZipDisallowedForPath,
  jarNameError,
  manualFileNameMatchesPath,
  relativeJarPathError,
  umtSvnLocationRegex,
} from "../../../lib/umtPrAnalysis";
import type { UmtBundleInfoChange, UmtFileOperation } from "../../../api/umtUpdates";
import { useUmtUploadPullRequestAnalysisFile } from "../../../api/useUmtPrAnalysis";

const { DataGrid: DataGridComponent } = DataGrid;

type UmtManualFileOperation = "Added" | "Modified" | "Removed";
type UmtManualFileSource = "upload" | "svn" | "github";

interface UmtAddManualFilesSectionProps {
  updateId: string;
  disabled: boolean;
  files: UmtFileOperation[];
  onFilesChange: (files: UmtFileOperation[]) => void;
  bundlesInfoChanges: UmtBundleInfoChange[];
  onBundlesInfoChanged: (changes: UmtBundleInfoChange[]) => void;
  onDirty: () => void;
}

export default function UmtAddManualFilesSection({
  updateId,
  disabled,
  files,
  onFilesChange,
  bundlesInfoChanges,
  onBundlesInfoChanged,
  onDirty,
}: UmtAddManualFilesSectionProps) {
  const upload = useUmtUploadPullRequestAnalysisFile(updateId);
  const { showError } = useNotifications();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [relativePath, setRelativePath] = useState("");
  const [operation, setOperation] = useState<UmtManualFileOperation | "">("");
  const [source, setSource] = useState<UmtManualFileSource>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [svnLocation, setSvnLocation] = useState("");
  const [githubRawUrl, setGithubRawUrl] = useState("");
  const [formError, setFormError] = useState<string | undefined>();

  const [bundlesInfoPath, setBundlesInfoPath] = useState("");
  const [jarName, setJarName] = useState("");
  const [jarVersion, setJarVersion] = useState("");
  const [relativeJarPath, setRelativeJarPath] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteBundleTarget, setDeleteBundleTarget] = useState<string | null>(null);
  // Spans the whole Add operation, including every sequential upload inside
  // a zip's entry loop — unlike `upload.isPending`, which flips true/false
  // once per individual mutateAsync call and made the button (and its
  // cursor) flicker across a multi-entry zip.
  const [isSubmitting, setIsSubmitting] = useState(false);

  const needsBundleInfo = bundleInfoApplies(relativePath, operation);

  function resetForm() {
    setRelativePath("");
    setOperation("");
    setSource("upload");
    setSelectedFile(null);
    setSvnLocation("");
    setGithubRawUrl("");
    setFormError(undefined);
    setBundlesInfoPath("");
    setJarName("");
    setJarVersion("");
    setRelativeJarPath("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (isManualFileTooLarge(file)) {
      showError("The file exceeds 50MB. Please provide an SVN location instead.");
      event.target.value = "";
      return;
    }
    if (isZipDisallowedForPath(file.name, relativePath)) {
      showError("Zip files are not supported for the /plugins directory.");
      event.target.value = "";
      return;
    }
    if (!manualFileNameMatchesPath(file.name, relativePath)) {
      showError("The uploaded file name does not match the file path name.");
      event.target.value = "";
      return;
    }
    setSelectedFile(file);
  }

  async function handleAdd() {
    setFormError(undefined);
    if (!relativePath.trim() || !operation) {
      setFormError("Path and operation are required.");
      return;
    }

    const svnTrimmed = svnLocation.trim();
    const githubTrimmed = githubRawUrl.trim();
    if (source === "upload" && !selectedFile) {
      setFormError("Choose a file to upload.");
      return;
    }
    if (source === "svn") {
      if (!svnTrimmed || !umtSvnLocationRegex(updateId).test(svnTrimmed)) {
        setFormError(
          "SVN location should start with http/https, contain '/svn/largefileSVN/', and contain the update ID.",
        );
        return;
      }
    }
    if (source === "github" && !githubTrimmed) {
      setFormError("Provide the GitHub raw source URL.");
      return;
    }

    if (needsBundleInfo) {
      const errors = [
        bundlesInfoPathError(bundlesInfoPath),
        jarNameError(jarName, jarVersion),
        relativeJarPathError(relativeJarPath),
      ].filter(Boolean);
      if (!bundlesInfoPath.trim() || !jarName.trim() || !relativeJarPath.trim() || errors.length > 0) {
        setFormError(errors[0] ?? "Bundle info fields are required for plugin JAR changes.");
        return;
      }
    }

    // The externally-sourced path (SVN location or GitHub raw URL) that the
    // backend's `sourceFilePath` field carries when there is no local file —
    // legacy collects and validates the SVN location but never actually
    // sends it; this port routes it through the same field GitHub-raw URLs
    // already use, rather than silently dropping validated user input.
    const sourceFilePath = source === "svn" ? svnTrimmed : source === "github" ? githubTrimmed : "";
    // Only ever carry the locally-picked file when "Upload File" is the
    // chosen source — otherwise a file picked earlier under "Upload File"
    // and left selected while the user switches to SVN/GitHub would get
    // uploaded instead of the URL-only placeholder those sources expect.
    const fileForUpload = source === "upload" ? selectedFile : null;

    setIsSubmitting(true);
    try {
      const newRows =
        fileForUpload && fileForUpload.name.toLowerCase().endsWith(".zip")
          ? await addZipEntries(fileForUpload, relativePath, operation, sourceFilePath)
          : await addSingleEntry(fileForUpload, relativePath, operation, sourceFilePath);

      onFilesChange([...files, ...newRows]);
      if (needsBundleInfo) {
        onBundlesInfoChanged([
          ...bundlesInfoChanges,
          { bundlesInfoPath, jarName, jarVersion, relativeJarPath, changeType: "New" },
        ]);
      }
      onDirty();
      resetForm();
      setIsOpen(false);
    } catch (error) {
      showError(`Upload failed. ${describeError(error)}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function addSingleEntry(
    file: File | null,
    path: string,
    op: UmtManualFileOperation,
    sourceFilePath: string,
  ): Promise<UmtFileOperation[]> {
    const fileName = file?.name ?? lastPathSegment(sourceFilePath);
    await upload.mutateAsync({
      relativePath: path,
      sourceFilePath,
      file: file ?? new Blob([], { type: "application/octet-stream" }),
    });
    return [{ file: `${path}/${fileName}`, operation: op }];
  }

  async function addZipEntries(
    zipFile: File,
    path: string,
    op: UmtManualFileOperation,
    sourceFilePath: string,
  ): Promise<UmtFileOperation[]> {
    const zip = await JSZip.loadAsync(zipFile);
    const entries = Object.values(zip.files).filter((entry) => !entry.dir);
    const rows: UmtFileOperation[] = [];

    for (const entry of entries) {
      const blob = await entry.async("blob");
      const extractedFile = new File([blob], entry.name);
      await upload.mutateAsync({ relativePath: path, sourceFilePath, file: extractedFile });
      rows.push({ file: `${path}/${entry.name}`, operation: op });
    }

    return rows;
  }

  function confirmDeleteFile() {
    if (!deleteTarget) return;
    onFilesChange(files.filter((row) => row.file !== deleteTarget));
    onDirty();
    setDeleteTarget(null);
  }

  function confirmDeleteBundleInfo() {
    if (!deleteBundleTarget) return;
    onBundlesInfoChanged(bundlesInfoChanges.filter((row) => row.bundlesInfoPath !== deleteBundleTarget));
    onDirty();
    setDeleteBundleTarget(null);
  }

  return (
    <Box sx={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? "none" : "auto" }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mt: 2 }}>
        <Typography variant="h6">Manual Files</Typography>
        <IconButton aria-label="Add manual file" size="small" onClick={() => setIsOpen(true)}>
          <PlusIcon size={18} />
        </IconButton>
      </Stack>

      {files.length > 0 ? (
        <DataGridComponent
          autoHeight
          columnHeaderHeight={40}
          disableColumnMenu
          disableRowSelectionOnClick
          getRowHeight={() => "auto"}
          getRowId={(row: UmtFileOperation) => row.file ?? ""}
          hideFooter
          rows={files}
          sx={{ mt: 2 }}
          columns={[
            {
              field: "file",
              headerName: "File",
              flex: 3,
              sortable: false,
              renderCell: (params: { row: UmtFileOperation }) => (
                <Stack sx={{ justifyContent: "center", minHeight: "100%", py: 0.75, width: "100%" }}>
                  {params.row.file}
                </Stack>
              ),
            },
            {
              field: "operation",
              headerName: "Operation",
              flex: 1,
              sortable: false,
              renderCell: (params: { row: UmtFileOperation }) => (
                <Stack sx={{ justifyContent: "center", minHeight: "100%", py: 0.75, width: "100%" }}>
                  {params.row.operation}
                </Stack>
              ),
            },
            {
              field: "delete",
              headerName: "",
              width: 52,
              sortable: false,
              renderCell: (params: { row: UmtFileOperation }) => (
                <Stack sx={{ justifyContent: "center", minHeight: "100%", width: "100%" }}>
                  <IconButton
                    aria-label="Delete file"
                    size="small"
                    onClick={() => setDeleteTarget(params.row.file ?? null)}
                  >
                    <TrashIcon size={16} />
                  </IconButton>
                </Stack>
              ),
            },
          ]}
        />
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          No manual files added.
        </Typography>
      )}

      {bundlesInfoChanges.length > 0 && (
        <DataGridComponent
          autoHeight
          columnHeaderHeight={40}
          disableColumnMenu
          disableRowSelectionOnClick
          getRowHeight={() => "auto"}
          getRowId={(row: UmtBundleInfoChange) => row.bundlesInfoPath ?? ""}
          hideFooter
          rows={bundlesInfoChanges}
          sx={{ mt: 2 }}
          columns={[
            {
              field: "bundlesInfoPath",
              headerName: "Bundles Info Path",
              flex: 3,
              sortable: false,
              renderCell: (params: { row: UmtBundleInfoChange }) => (
                <Stack sx={{ justifyContent: "center", minHeight: "100%", py: 0.75, width: "100%" }}>
                  {params.row.bundlesInfoPath}
                </Stack>
              ),
            },
            {
              field: "jarName",
              headerName: "JAR Name",
              flex: 2,
              sortable: false,
              renderCell: (params: { row: UmtBundleInfoChange }) => (
                <Stack sx={{ justifyContent: "center", minHeight: "100%", py: 0.75, width: "100%" }}>
                  {params.row.jarName}
                </Stack>
              ),
            },
            {
              field: "relativeJarPath",
              headerName: "Relative JAR Path",
              flex: 3,
              sortable: false,
              renderCell: (params: { row: UmtBundleInfoChange }) => (
                <Stack sx={{ justifyContent: "center", minHeight: "100%", py: 0.75, width: "100%" }}>
                  {params.row.relativeJarPath}
                </Stack>
              ),
            },
            {
              field: "delete",
              headerName: "",
              width: 52,
              sortable: false,
              renderCell: (params: { row: UmtBundleInfoChange }) => (
                <Stack sx={{ justifyContent: "center", minHeight: "100%", width: "100%" }}>
                  <IconButton
                    aria-label="Delete bundle info entry"
                    size="small"
                    onClick={() => setDeleteBundleTarget(params.row.bundlesInfoPath ?? null)}
                  >
                    <TrashIcon size={16} />
                  </IconButton>
                </Stack>
              ),
            },
          ]}
        />
      )}

      <Dialog open={isOpen} onClose={() => setIsOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add Manual File</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Path in Product Pack"
              value={relativePath}
              onChange={(e) => setRelativePath(e.target.value)}
            />
            <Select
              displayEmpty
              value={operation}
              onChange={(e) => setOperation(e.target.value as UmtManualFileOperation)}
            >
              <MenuItem value="" disabled>
                Operation
              </MenuItem>
              <MenuItem value="Added">Added</MenuItem>
              <MenuItem value="Modified">Modified</MenuItem>
              <MenuItem value="Removed">Removed</MenuItem>
            </Select>

            <RadioGroup
              row
              value={source}
              onChange={(e) => {
                const nextSource = e.target.value as UmtManualFileSource;
                setSource(nextSource);
                if (nextSource !== "upload") {
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }
              }}
            >
              <FormControlLabel value="upload" control={<Radio />} label="Upload File" />
              <FormControlLabel value="svn" control={<Radio />} label="SVN Location" />
              <FormControlLabel value="github" control={<Radio />} label="GitHub Raw URL" />
            </RadioGroup>

            {source === "upload" && (
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={<UploadIcon size={16} />}
                >
                  Choose File
                  <input ref={fileInputRef} hidden type="file" onChange={handleFileChange} />
                </Button>
                {selectedFile && <Typography variant="body2">{selectedFile.name}</Typography>}
              </Stack>
            )}
            {source === "svn" && (
              <TextField
                fullWidth
                label="SVN Location"
                value={svnLocation}
                onChange={(e) => setSvnLocation(e.target.value)}
              />
            )}
            {source === "github" && (
              <TextField
                fullWidth
                label="GitHub Raw Source URL"
                value={githubRawUrl}
                onChange={(e) => setGithubRawUrl(e.target.value)}
              />
            )}

            {needsBundleInfo && (
              <>
                <Divider />
                <Typography variant="subtitle2">Bundle Info Changes</Typography>
                <TextField
                  fullWidth
                  label="Bundles Info Path"
                  value={bundlesInfoPath}
                  onChange={(e) => setBundlesInfoPath(e.target.value)}
                  error={Boolean(bundlesInfoPath) && Boolean(bundlesInfoPathError(bundlesInfoPath))}
                  helperText={bundlesInfoPath ? bundlesInfoPathError(bundlesInfoPath) : undefined}
                />
                <TextField
                  fullWidth
                  label="JAR Name"
                  value={jarName}
                  onChange={(e) => setJarName(e.target.value)}
                  error={Boolean(jarName) && Boolean(jarNameError(jarName, jarVersion))}
                  helperText={jarName ? jarNameError(jarName, jarVersion) : undefined}
                />
                <TextField
                  fullWidth
                  label="JAR Version"
                  value={jarVersion}
                  onChange={(e) => setJarVersion(e.target.value)}
                />
                <TextField
                  fullWidth
                  label="Relative JAR Path"
                  value={relativeJarPath}
                  onChange={(e) => setRelativeJarPath(e.target.value)}
                  error={Boolean(relativeJarPath) && Boolean(relativeJarPathError(relativeJarPath))}
                  helperText={relativeJarPath ? relativeJarPathError(relativeJarPath) : undefined}
                />
              </>
            )}

            {formError && <Alert severity="error">{formError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button variant="contained" loading={isSubmitting} onClick={() => void handleAdd()}>
            Add
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>Are you sure you want to delete this file?</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="contained" onClick={confirmDeleteFile}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteBundleTarget)} onClose={() => setDeleteBundleTarget(null)}>
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>Are you sure you want to delete this bundle info entry?</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteBundleTarget(null)}>Cancel</Button>
          <Button variant="contained" onClick={confirmDeleteBundleInfo}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function lastPathSegment(url: string): string {
  const withoutQuery = url.split("?")[0] ?? url;
  return withoutQuery.split("/").filter(Boolean).pop() ?? "";
}
