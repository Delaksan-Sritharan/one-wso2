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
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { dialogPaperSx } from "@components/confirmation-dialog/dialogPaperSx";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useTilUserInfo } from "../api/useTilData";
import { useCreateTilSubmission } from "../api/useTilMutations";
import { TIL_WHAT_MAX_LENGTH, TIL_WHERE_OPTIONS, type TilWhere } from "../api/tilTypes";
import { describeError } from "../util/tilError";
import { isEmptyTilHtml, tilPlainTextLength } from "../util/tilRichText";
import TilRichTextField from "./TilRichTextField";

// Where options whose feed entry needs a bit more detail -- which customer,
// which partner, or what "Other" actually means here. Internal is the one
// option that's already self-explanatory on its own.
const WHERE_OPTIONS_NEEDING_DETAIL: readonly TilWhere[] = ["Customer", "Partner", "Other"];

function whereDetailCopy(where: TilWhere): { label: string; placeholder: string; helper: string } {
  switch (where) {
    case "Customer":
      return { label: "Customer name", placeholder: "e.g. Acme Corp", helper: "Which customer" };
    case "Partner":
      return { label: "Partner name", placeholder: "e.g. Acme Reseller", helper: "Which partner" };
    default:
      return {
        label: "Please explain",
        placeholder: "e.g. a conference, a vendor demo, an internal hackathon",
        helper: "What \"Other\" means here",
      };
  }
}

// The "+ New entry" form. Mirrors the field set the Chat App's own Dialog
// presents (Who / Where / What) so the two entry points feel like the same
// product — see the backend's openapi.yaml for the shared contract.
export default function SubmitEntryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const userInfo = useTilUserInfo();
  const [where, setWhere] = useState<TilWhere | "">("");
  const [whereDetail, setWhereDetail] = useState("");
  const [what, setWhat] = useState("");
  const [touched, setTouched] = useState(false);
  const create = useCreateTilSubmission();
  const { showSuccess, showError } = useNotifications();

  // The byline is the signed-in user's own name — never typed, so it can't
  // be used to credit (or blame) someone else. submittedByEmail is this same
  // identity on the backend side, independently; this is just how it reads.
  const who = userInfo.data ? `${userInfo.data.displayName} (${userInfo.data.email})` : "";
  const whoInvalid = !userInfo.data;
  const whereInvalid = where === "";
  const needsWhereDetail = where !== "" && WHERE_OPTIONS_NEEDING_DETAIL.includes(where);
  const whereDetailInvalid = needsWhereDetail && whereDetail.trim().length === 0;
  const whatLength = tilPlainTextLength(what);
  const whatInvalid = isEmptyTilHtml(what) || whatLength > TIL_WHAT_MAX_LENGTH;
  const invalid = whoInvalid || whereInvalid || whereDetailInvalid || whatInvalid;

  const reset = () => {
    setWhere("");
    setWhereDetail("");
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
      {
        who,
        where: where as TilWhere,
        what,
        ...(needsWhereDetail ? { whereDetail: whereDetail.trim() } : {}),
      },
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
    <Dialog
      open={open}
      onClose={create.isPending ? undefined : close}
      maxWidth="lg"
      fullWidth
      slotProps={{
        paper: { sx: dialogPaperSx },
        backdrop: { sx: { bgcolor: "rgba(10,10,11,.4)", backdropFilter: "blur(3px)" } },
      }}
    >
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>Today I Learned</DialogTitle>
      <DialogContent dividers sx={{ display: "flex", gap: 3, minHeight: 420 }}>
        {/* Left quarter: who's submitting it and where it came from.
            Every field here is labeled with a plain Typography above it,
            not MUI's floating notched label — a short label ("Who") and a
            longer one ("Customer name") produce different-width gaps in
            the border otherwise, which reads as misaligned even though
            each one is individually correct. Same pattern "What did you
            learn?" already uses on the right. */}
        <Stack spacing={2} sx={{ width: "25%", minWidth: 220 }}>
          <Typography variant="body2" color="text.secondary">
            Your name is recorded along with your entry.
          </Typography>
          <Stack spacing={0.5}>
            <Typography variant="subtitle2">Who</Typography>
            <TextField
              value={userInfo.isLoading ? "Loading your name…" : who || "Couldn't load your name"}
              error={touched && whoInvalid}
              helperText="Your name, shown on this entry"
              fullWidth
              disabled
            />
          </Stack>
          <Stack spacing={0.5}>
            <Typography variant="subtitle2" color={touched && whereInvalid ? "error" : "text.primary"}>
              Where
            </Typography>
            <TextField
              select
              value={where}
              onChange={(e) => {
                setWhere(e.target.value as TilWhere);
                setWhereDetail("");
              }}
              error={touched && whereInvalid}
              helperText={touched && whereInvalid ? "Required" : "Who this learning came from"}
              fullWidth
              autoFocus
            >
              {TIL_WHERE_OPTIONS.map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {opt}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          {needsWhereDetail && (
            <Stack spacing={0.5}>
              <Typography variant="subtitle2" color={touched && whereDetailInvalid ? "error" : "text.primary"}>
                {whereDetailCopy(where).label}
              </Typography>
              <TextField
                placeholder={whereDetailCopy(where).placeholder}
                value={whereDetail}
                onChange={(e) => setWhereDetail(e.target.value)}
                error={touched && whereDetailInvalid}
                helperText={touched && whereDetailInvalid ? "Required" : whereDetailCopy(where).helper}
                fullWidth
              />
            </Stack>
          )}
        </Stack>

        {/* Right three-quarters: the actual learning. */}
        <Box sx={{ width: "75%", display: "flex", flexDirection: "column", gap: 1 }}>
          <Typography variant="subtitle2" color={touched && whatInvalid ? "error" : "text.primary"}>
            What did you learn?
          </Typography>
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <TilRichTextField
              value={what}
              onChange={setWhat}
              placeholder="What did you learn? Explain it so others can learn from it too."
            />
          </Box>
          <Typography variant="caption" color={touched && whatInvalid ? "error" : "text.secondary"}>
            {whatLength}/{TIL_WHAT_MAX_LENGTH}
          </Typography>
        </Box>
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
