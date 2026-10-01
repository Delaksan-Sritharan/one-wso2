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
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useCreateTilSubmission } from "../api/useTilMutations";
import { TIL_WHAT_MAX_LENGTH, TIL_WHERE_OPTIONS, type TilWhere } from "../api/tilTypes";
import { describeError } from "../util/tilError";

// The "+ New entry" form. Mirrors the field set the Chat App's own Dialog
// presents (Who / Where / What) so the two entry points feel like the same
// product — see the backend's openapi.yaml for the shared contract.
export default function SubmitEntryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [who, setWho] = useState("");
  const [where, setWhere] = useState<TilWhere | "">("");
  const [what, setWhat] = useState("");
  const [touched, setTouched] = useState(false);
  const create = useCreateTilSubmission();
  const { showSuccess, showError } = useNotifications();

  const whoInvalid = who.trim().length === 0;
  const whereInvalid = where === "";
  const whatInvalid = what.trim().length === 0 || what.length > TIL_WHAT_MAX_LENGTH;
  const invalid = whoInvalid || whereInvalid || whatInvalid;

  const reset = () => {
    setWho("");
    setWhere("");
    setWhat("");
    setTouched(false);
    create.reset();
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = () => {
    setTouched(true);
    if (invalid) return;
    create.mutate(
      { who: who.trim(), where: where as TilWhere, what: what.trim() },
      {
        onSuccess: () => {
          showSuccess("Thanks for sharing what you learned!");
          close();
        },
        onError: (err) => showError(describeError(err)),
      },
    );
  };

  return (
    <Dialog open={open} onClose={create.isPending ? undefined : close} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>Today I Learned</DialogTitle>
      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Your name is recorded along with your entry — this isn&apos;t anonymous.
        </Typography>
        <TextField
          label="Who"
          placeholder="e.g. Jane Doe, Customer Success Engineer"
          value={who}
          onChange={(e) => setWho(e.target.value)}
          error={touched && whoInvalid}
          helperText={touched && whoInvalid ? "Required" : " "}
          fullWidth
          autoFocus
        />
        <TextField
          select
          label="Where"
          value={where}
          onChange={(e) => setWhere(e.target.value as TilWhere)}
          error={touched && whereInvalid}
          helperText={touched && whereInvalid ? "Required" : " "}
          fullWidth
        >
          {TIL_WHERE_OPTIONS.map((opt) => (
            <MenuItem key={opt} value={opt}>
              {opt}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="What"
          placeholder="What did you learn?"
          value={what}
          onChange={(e) => setWhat(e.target.value.slice(0, TIL_WHAT_MAX_LENGTH))}
          error={touched && whatInvalid}
          helperText={`${what.length}/${TIL_WHAT_MAX_LENGTH}`}
          multiline
          minRows={3}
          maxRows={8}
          fullWidth
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={close} disabled={create.isPending}>
          Cancel
        </Button>
        <Button variant="contained" onClick={submit} disabled={create.isPending}>
          {create.isPending ? "Sharing…" : "Share"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
