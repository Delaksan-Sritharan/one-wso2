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

import { useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import VirtualizedListbox from "@components/virtualized-listbox/VirtualizedListbox";
import { employeeDisplayName } from "@features/leave/util/employeeName";
import { useLeaveEmployees } from "@features/leave/api/useLeaveData";
import { describeError } from "@api/errors";

// Picks colleagues to add as 360° reviewers — par-app's ReviewRequestModal,
// with the picker itself reused from Leave's "Notify people" field rather
// than rebuilt (same shape: search-and-multi-select over the org).
export default function Par360RequestDialog({
  open,
  onClose,
  selfEmail,
  leadEmail,
  existingEmails,
  onSubmit,
  isSubmitting,
  error,
}: {
  open: boolean;
  onClose: () => void;
  /** The caller's own address — excluded, matching EmailAutocomplete.tsx's
   * `ownEmail` exclusion (this screen only ever requests for yourself). */
  selfEmail: string | undefined;
  /** Your own lead — ReviewRequestModal.tsx excludes this specifically
   * (rather than the employee being reviewed, which is the same person
   * here) when requesting for yourself: `emailsToSkip: [userInfo.leadEmail]`. */
  leadEmail: string | undefined;
  /** Already a reviewer — excluded from the options so it can't be re-added. */
  existingEmails: string[];
  onSubmit: (reviewerEmails: string[]) => void;
  isSubmitting: boolean;
  error: unknown;
}) {
  const employees = useLeaveEmployees(open);
  const [selected, setSelected] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");

  const offerable = useMemo(
    () =>
      (employees.data ?? []).filter(
        (e) =>
          e.employeeStatus !== "Left" &&
          e.workEmail &&
          e.workEmail !== selfEmail &&
          e.workEmail !== leadEmail &&
          !existingEmails.includes(e.workEmail),
      ),
    [employees.data, selfEmail, leadEmail, existingEmails],
  );
  const options = useMemo(() => offerable.map((e) => e.workEmail), [offerable]);
  const byEmail = useMemo(() => new Map(offerable.map((e) => [e.workEmail, e])), [offerable]);

  const handleClose = () => {
    setSelected([]);
    setInputValue("");
    onClose();
  };

  // EmailAutocomplete.tsx's own handlePaste: a comma/semicolon/newline
  // separated paste is split and matched against the available options,
  // rather than left for the field to reject wholesale.
  const handlePaste = (event: React.ClipboardEvent) => {
    const pastedText = event.clipboardData.getData("text");
    if (!/[,;\n]/.test(pastedText)) return;
    event.preventDefault();
    const pasted = pastedText
      .split(/[,;\n\s]+/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0 && options.includes(e));
    setSelected((prev) => Array.from(new Set([...prev, ...pasted])));
    setInputValue("");
  };

  // EmailAutocomplete.tsx's own handleKeyDown: typing a comma or semicolon
  // after a valid address adds it, the same as picking it from the list.
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      return;
    }
    if ((event.key === "," || event.key === ";") && inputValue.trim()) {
      const email = inputValue.trim().replace(/[,;]$/, "");
      if (options.includes(email) && !selected.includes(email)) {
        event.preventDefault();
        setSelected((prev) => [...prev, email]);
        setInputValue("");
      }
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      {/* ReviewRequestModal.tsx: title, a divider under it, then "From:"
          labelling the picker — not just the field on its own. */}
      <DialogTitle sx={{ pb: 2 }}>Request 360° Feedback</DialogTitle>
      <Divider />
      <DialogContent>
        <Typography sx={{ pb: 2, pt: 2 }}>From:</Typography>
        <Autocomplete
          multiple
          size="small"
          options={options}
          value={selected}
          onChange={(_e, v) => setSelected(v as string[])}
          inputValue={inputValue}
          onInputChange={(_e, v) => setInputValue(v)}
          loading={employees.isLoading}
          loadingText="Loading colleagues…"
          noOptionsText={employees.isError ? "Couldn't load colleagues" : "No colleagues found"}
          disableListWrap
          ListboxComponent={VirtualizedListbox}
          // Row is one line (~30px) inside VirtualizedListbox's fixed 52px
          // slot (sized for Leave's two-line rows) — the gap under each row
          // is that mismatch, not a bug here.
          // EmailAutocomplete.tsx's own row: a plain Avatar (no fallback
          // text, so a missing photo shows MUI's generic person icon, never
          // an initial letter) beside the name, then the raw address in grey.
          renderOption={(props, option) => {
            const employee = byEmail.get(option);
            return (
              <li {...props} key={option}>
                <div style={{ display: "flex", alignItems: "center", height: 30 }}>
                  <Avatar
                    src={employee?.employeeThumbnail || undefined}
                    slotProps={{ img: { referrerPolicy: "no-referrer" } }}
                    sx={{ width: 24, height: 24, marginRight: "8px" }}
                  />
                  {employee ? employeeDisplayName(employee) : null}
                  <span style={{ color: "gray", marginLeft: 8 }}>{option}</span>
                </div>
              </li>
            );
          }}
          // EmailAutocomplete.tsx's own tag: the same plain avatar (shown
          // only when there's a thumbnail, per source) beside the raw
          // address — not the display name.
          renderTags={(value, getTagProps) =>
            value.map((option, index) => {
              const employee = byEmail.get(option);
              const { key, ...tagProps } = getTagProps({ index });
              return (
                <Chip
                  key={key}
                  variant="outlined"
                  label={
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                      {employee?.employeeThumbnail && (
                        <Avatar
                          src={employee.employeeThumbnail}
                          slotProps={{ img: { referrerPolicy: "no-referrer" } }}
                          sx={{ width: 24, height: 24, marginRight: "8px", marginLeft: "-8px" }}
                        />
                      )}
                      {option}
                    </Box>
                  }
                  {...tagProps}
                />
              );
            })
          }
          filterOptions={(opts, { inputValue }) => {
            const q = inputValue.trim().toLowerCase();
            if (!q) return opts;
            return opts.filter((o) => {
              const e = byEmail.get(o);
              return o.toLowerCase().includes(q) || (e ? employeeDisplayName(e).toLowerCase().includes(q) : false);
            });
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Search by email or paste comma-separated emails"
              autoFocus
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
            />
          )}
        />
        {error !== undefined && <Alert severity="error" sx={{ mt: 2 }}>{describeError(error)}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={selected.length === 0 || isSubmitting}
          onClick={() => onSubmit(selected)}
        >
          {isSubmitting ? "Requesting…" : "Request"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
