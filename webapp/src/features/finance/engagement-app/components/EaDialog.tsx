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

import { useCallback, useState, type FormEvent, type JSX, type ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
} from "@wso2/oxygen-ui";
import { describeError } from "@api/errors";
import { EA_SCOPE_SX } from "./eaStyles";
import { eaError } from "../api/engagementHttp";
import { dialogPaperSx } from "@components/confirmation-dialog/dialogPaperSx";

/** The first field a person can type in, so a form dialog opens ready for input. */
const FIRST_FIELD = "input:not([type=hidden]):not([aria-hidden=true]):not(:disabled), textarea:not(:disabled), [role=combobox]";

/**
 * A dialog for one form or one decision: title (and a line under it), body, Cancel on the left of the actions and the confirming action on the right.
 * A dialog with `onConfirm` is a form: Enter submits it (except in a multiline field) and the first field has focus when it opens.
 * Once something is typed, a click outside no longer closes it, and Escape or Cancel asks before discarding.
 */
export default function EaDialog({
  title,
  subtitle,
  children,
  confirmLabel = "Confirm",
  busyLabel = "Saving…",
  confirmColor = "primary",
  cancelLabel = "Cancel",
  onConfirm,
  onClose,
  busy = false,
  error,
  extraActions,
  maxWidth = "sm",
  confirmDisabled = false,
  dirty,
  edited = false,
}: {
  readonly title: string;
  readonly subtitle?: ReactNode;
  readonly children?: ReactNode;
  /** The action's own verb ("Delete", "Approve"), never "Yes" or "OK". */
  readonly confirmLabel?: string;
  /** The confirm button's label while the request runs. */
  readonly busyLabel?: string;
  readonly confirmColor?: "primary" | "error";
  readonly cancelLabel?: string;
  /** Omit for a read-only dialog: Close is then the only action. */
  readonly onConfirm?: () => void;
  readonly onClose: () => void;
  readonly busy?: boolean;
  /** A validation message (string) or a failed request (shown via describeError). */
  readonly error?: unknown;
  /** More actions beside the confirming one, e.g. "Confirm and Approve". In a read-only dialog they sit on the left, opposite Close. */
  readonly extraActions?: ReactNode;
  readonly maxWidth?: "xs" | "sm" | "md";
  readonly confirmDisabled?: boolean;
  /** Whether closing would lose edits. Defaults to "something was typed or ticked in the form". */
  readonly dirty?: boolean;
  /** Set when the dialog reopens with edits already in the form (e.g. after Go Back from a confirm step), so Cancel still asks before discarding. */
  readonly edited?: boolean;
}): JSX.Element {
  const message = error === undefined || error === null || error === "" ? "" : typeof error === "string" ? error : describeError(eaError(error));
  const [touched, setTouched] = useState(edited);
  const [discarding, setDiscarding] = useState(false);
  const unsaved = Boolean(onConfirm) && (dirty ?? touched);
  // The dialog renders its content in a portal, so the form is not mounted when this component's effects run.
  const focusFirstField = useCallback((form: HTMLFormElement | null) => {
    form?.querySelector<HTMLElement>(FIRST_FIELD)?.focus();
  }, []);
  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    if (!busy && !confirmDisabled) onConfirm?.();
  };
  const requestClose = () => (unsaved ? setDiscarding(true) : onClose());
  const actions = onConfirm ? (
    <>
      <Button size="small" onClick={requestClose} disabled={busy}>
        {cancelLabel}
      </Button>
      <Box sx={{ flex: 1 }} />
      {extraActions}
      <Button size="small" variant="contained" color={confirmColor} type="submit" disabled={busy || confirmDisabled}>
        {busy ? busyLabel : confirmLabel}
      </Button>
    </>
  ) : (
    <>
      {extraActions ? (
        <>
          {extraActions}
          <Box sx={{ flex: 1 }} />
        </>
      ) : null}
      <Button size="small" variant="contained" onClick={onClose}>
        Close
      </Button>
    </>
  );
  return (
    <>
      <Dialog
        open
        fullWidth
        maxWidth={maxWidth}
        // A click outside never closes a form with edits in it; Escape and Cancel still do, after a check.
        onClose={(_, reason) => {
          if (busy || (unsaved && reason === "backdropClick")) return;
          requestClose();
        }}
        sx={EA_SCOPE_SX}
        slotProps={{ paper: { sx: dialogPaperSx } }}
      >
        <DialogTitle sx={{ pb: subtitle ? 0.5 : undefined }}>
          {title}
          {subtitle ? (
            <Typography variant="body2" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
              {subtitle}
            </Typography>
          ) : null}
        </DialogTitle>
        <Box
          component="form"
          ref={focusFirstField}
          noValidate
          onSubmit={submit}
          onChange={() => setTouched(true)}
          sx={{ display: "flex", flexDirection: "column", minHeight: 0, flex: "1 1 auto", overflow: "hidden" }}
        >
          <DialogContent>
            {typeof children === "string" ? <DialogContentText>{children}</DialogContentText> : children}
            {message ? (
              <Alert severity="error" sx={{ mt: 2 }}>
                {message}
              </Alert>
            ) : null}
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>{actions}</DialogActions>
        </Box>
      </Dialog>
      {discarding ? (
        <EaDialog
          title="Discard Changes"
          confirmLabel="Discard"
          cancelLabel="Keep Editing"
          confirmColor="error"
          maxWidth="xs"
          onConfirm={onClose}
          onClose={() => setDiscarding(false)}
        >
          Your changes have not been saved. Discard them and close this window?
        </EaDialog>
      ) : null}
    </>
  );
}

/** A decision before anything irreversible or externally visible. The confirm button names the action ("Delete", "Approve"); Cancel goes back. */
export function ConfirmDialog({
  title,
  text,
  confirmLabel = "Confirm",
  busyLabel = "Working…",
  cancelLabel = "Cancel",
  danger = false,
  run,
  onClose,
  onDone,
}: {
  readonly title: string;
  readonly text: ReactNode;
  readonly confirmLabel?: string;
  readonly busyLabel?: string;
  readonly cancelLabel?: string;
  readonly danger?: boolean;
  readonly run: () => Promise<unknown>;
  readonly onClose: () => void;
  readonly onDone?: () => void;
}): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  return (
    <EaDialog
      title={title}
      confirmLabel={confirmLabel}
      busyLabel={busyLabel}
      cancelLabel={cancelLabel}
      confirmColor={danger ? "error" : "primary"}
      busy={busy}
      error={error}
      onClose={onClose}
      onConfirm={() => {
        setBusy(true);
        setError(undefined);
        run().then(
          () => {
            setBusy(false);
            onDone?.();
            onClose();
          },
          (e: unknown) => {
            setBusy(false);
            setError(e);
          },
        );
      }}
    >
      {typeof text === "string" ? <DialogContentText>{text}</DialogContentText> : text}
    </EaDialog>
  );
}
