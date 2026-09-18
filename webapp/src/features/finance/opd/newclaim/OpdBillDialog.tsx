/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { OpdReceiptDropZone } from "./OpdReceiptDropZone";
import {
  COMMENT_MAX,
  OPD_COPY,
  amountCapMessage,
  breaksSameYearRule,
} from "./opdNewClaim";
import type { OpdTransaction } from "../opdTypes";

export interface OpdBillDraft {
  date: string;
  /** Kept as the raw field text so a half-typed number is not coerced to 0. */
  amount: string;
  comment: string;
  receiptUrl: string | null;
}

const EMPTY: OpdBillDraft = { date: "", amount: "", comment: "", receiptUrl: null };

function toDraft(bill: OpdTransaction | undefined): OpdBillDraft {
  if (!bill) return EMPTY;
  return {
    date: bill.date,
    amount: String(bill.amount),
    comment: bill.comment ?? "",
    receiptUrl: bill.receiptUrl ?? null,
  };
}

/**
 * Add or correct one bill.
 *
 * `components/form/ExpenseForm.tsx`. Four fields, all of them required — the
 * receipt included (`:107`), which the existing OPD form does not enforce, so
 * a bill could be submitted with nothing backing it.
 *
 * Validation runs on submit rather than on every keystroke: the amount rule
 * depends on the other bills already listed, and complaining about an over-cap
 * figure while someone is still typing the first digit of it is noise.
 */
export function OpdBillDialog({
  open,
  editing,
  items,
  maxAmount,
  minDate,
  maxDate,
  uploading,
  onUpload,
  onSubmit,
  onClose,
}: {
  open: boolean;
  /** The bill being corrected, or undefined when adding a new one. */
  editing: OpdTransaction | undefined;
  /** Bills already in the claim — the single-year rule reads the first one. */
  items: OpdTransaction[];
  maxAmount: number;
  minDate: string;
  maxDate: string;
  uploading: boolean;
  onUpload: (file: File) => Promise<string | null>;
  onSubmit: (bill: OpdTransaction) => void;
  onClose: () => void;
}) {
  // Remounted per bill by the caller's `key`, so the fields reset without an
  // effect watching `editing` — the pattern CcEditDialog uses.
  const [draft, setDraft] = useState<OpdBillDraft>(() => toDraft(editing));
  const [errors, setErrors] = useState<Partial<Record<keyof OpdBillDraft, string>>>({});

  const isEdit = editing !== undefined;
  const set = <K extends keyof OpdBillDraft>(key: K, value: OpdBillDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = (): OpdTransaction | null => {
    const next: Partial<Record<keyof OpdBillDraft, string>> = {};
    const amount = Number(draft.amount);

    if (!draft.date) next.date = OPD_COPY.required;
    // Checked even though the picker is bounded: the field is typeable.
    else if (breaksSameYearRule(isEdit ? items.filter((i) => i !== editing) : items, draft.date)) {
      next.date = OPD_COPY.sameYear;
    }

    if (!draft.amount.trim()) next.amount = OPD_COPY.required;
    else if (!Number.isFinite(amount) || amount <= 0) next.amount = OPD_COPY.amountPositive;
    else if (amount > maxAmount) next.amount = amountCapMessage(maxAmount);

    if (!draft.comment.trim()) next.comment = OPD_COPY.required;
    if (!draft.receiptUrl) next.receiptUrl = OPD_COPY.required;

    setErrors(next);
    if (Object.values(next).some(Boolean)) return null;

    return {
      date: draft.date,
      amount,
      comment: draft.comment.trim(),
      receiptUrl: draft.receiptUrl,
    };
  };

  const handleSubmit = () => {
    const bill = validate();
    if (bill) onSubmit(bill);
  };

  const titleId = "opd-bill-dialog-title";

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!uploading) onClose();
      }}
      maxWidth="sm"
      fullWidth
      aria-labelledby={titleId}
    >
      <DialogTitle id={titleId} sx={{ fontSize: 17, fontWeight: 700 }}>
        {isEdit ? OPD_COPY.editDialogTitle : OPD_COPY.addDialogTitle}
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField
            label="Bill Date"
            type="date"
            required
            size="small"
            value={draft.date}
            // The bounds follow the year being claimed against: the current
            // year stops at today, a past year runs to 31 December
            // (`CustomDatePicker.tsx:93-101`).
            inputProps={{ min: minDate, max: maxDate }}
            InputLabelProps={{ shrink: true }}
            error={Boolean(errors.date)}
            helperText={errors.date}
            onChange={(e) => set("date", e.target.value)}
            fullWidth
          />

          <TextField
            label="Claim Amount"
            required
            size="small"
            // `type="text"` with a numeric mode, not `type="number"`: a number
            // input silently discards what it cannot parse, so a typo becomes
            // an empty field with no complaint, and its scroll-wheel stepping
            // changes amounts by accident.
            inputProps={{ inputMode: "decimal" }}
            InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }}
            value={draft.amount}
            error={Boolean(errors.amount)}
            helperText={errors.amount}
            onChange={(e) => set("amount", e.target.value)}
            fullWidth
          />

          <TextField
            label="Description"
            required
            size="small"
            multiline
            minRows={2}
            value={draft.comment}
            error={Boolean(errors.comment)}
            helperText={errors.comment}
            // Enforced by the field rather than reported after the fact; the
            // counter below says where the limit is.
            inputProps={{ maxLength: COMMENT_MAX }}
            onChange={(e) => set("comment", e.target.value)}
            fullWidth
          />
          <Typography sx={{ fontSize: 11.5, color: "text.secondary", textAlign: "right", mt: -1.5 }}>
            {draft.comment.length}/{COMMENT_MAX}
          </Typography>

          <div>
            <OpdReceiptDropZone
              fileName={draft.receiptUrl}
              uploading={uploading}
              onPick={async (file) => {
                const stored = await onUpload(file);
                if (stored) set("receiptUrl", stored);
              }}
              onClear={() => set("receiptUrl", null)}
            />
            {errors.receiptUrl && (
              <Typography sx={{ fontSize: 12.5, color: "error.main", mt: 0.5 }}>
                A receipt is required.
              </Typography>
            )}
          </div>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button size="small" onClick={onClose} disabled={uploading}>
          Cancel
        </Button>
        <Button size="small" variant="contained" onClick={handleSubmit} disabled={uploading}>
          {isEdit ? OPD_COPY.editConfirm : OPD_COPY.addConfirm}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
