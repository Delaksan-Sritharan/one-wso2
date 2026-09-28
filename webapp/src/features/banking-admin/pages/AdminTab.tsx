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
  Autocomplete,
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import ConfirmationDialog, { type ConfirmationContent } from "@components/confirmation-dialog/ConfirmationDialog";
import { dialogPaperSx } from "@components/confirmation-dialog/dialogPaperSx";
import { useSingleFlight } from "@components/confirmation-dialog/useSingleFlight";
import { useBanks } from "@features/my/api/useBanks";
import { useBankingConfig } from "@features/my/api/useBankingConfig";
import { useCreateBank } from "@features/my/api/useCreateBank";
import { useUpdateThreshold } from "@features/my/api/useUpdateThreshold";
import type { Bank, ThresholdKey } from "@features/my/api/types";
import { useBankingAdminFlags } from "../useBankingAdminFlags";

const BLANK_BANK = { bankName: "", bankCode: "", swiftCode: "", bankLocation: "" };
const normalize = (value: string) => value.trim().toLowerCase();

// The Admin tab — bank list + Add Bank, and the two monthly-cutoff Threshold
// fields, each owned by a different admin (Salary: People Ops, Consultancy:
// Finance), matching the backend's own per-field role split exactly.
export default function AdminTab() {
  const banksQuery = useBanks(true);
  const configQuery = useBankingConfig();
  const { isPeopleOperationsAdmin, isFinanceAdmin } = useBankingAdminFlags();
  const createBank = useCreateBank();
  const updateThreshold = useUpdateThreshold();

  // One request at a time: ConfirmationDialog closes synchronously on click
  // and doesn't wait for anything, so a quick second press on Confirm would
  // otherwise fire a second create-bank or threshold-update request.
  const run = useSingleFlight();

  const [confirmation, setConfirmation] = useState<ConfirmationContent | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [addBankOpen, setAddBankOpen] = useState(false);
  const [newBank, setNewBank] = useState(BLANK_BANK);

  const banks = banksQuery.data?.banks ?? [];
  const config = configQuery.data;

  const filteredBanks = banks.filter((b) =>
    `${b.bankName} ${b.bankCode} ${b.swiftCode} ${b.bankLocation}`.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const isCodeDuplicate =
    Boolean(newBank.bankCode) && banks.some((b) => normalize(b.bankCode) === normalize(newBank.bankCode));
  const isSwiftDuplicate =
    Boolean(newBank.swiftCode) && banks.some((b) => normalize(b.swiftCode) === normalize(newBank.swiftCode));
  const isNewBankValid =
    newBank.bankName.trim() !== "" &&
    newBank.bankCode.trim() !== "" &&
    newBank.swiftCode.trim() !== "" &&
    newBank.bankLocation !== "" &&
    !isCodeDuplicate &&
    !isSwiftDuplicate;

  function closeAddBank() {
    setAddBankOpen(false);
    setNewBank(BLANK_BANK);
  }

  function submitNewBank() {
    const payload: Bank = { ...newBank };
    setConfirmation({
      title: "Confirm Acceptance",
      text: "Are you sure you want to accept these changes?",
      confirmAction: () =>
        run(async () => {
          await createBank.mutateAsync(payload);
          closeAddBank();
        }),
    });
  }

  function requestThresholdUpdate(key: ThresholdKey, value: number, label: string) {
    setConfirmation({
      title: "Confirm Acceptance",
      text: `Are you sure you want to set the ${label} to ${value}?`,
      confirmAction: () =>
        run(async () => {
          await updateThreshold.mutateAsync({ key, value });
        }),
    });
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Stack direction="row" spacing={4} flexWrap="wrap">
        <ThresholdField
          label="Salary Threshold Day (1-31)"
          buttonLabel="Update Salary Threshold"
          currentValue={config?.salaryThreshold}
          canEdit={isPeopleOperationsAdmin}
          onUpdate={(value) => requestThresholdUpdate("SALARY_THRESHOLD", value, "Salary Threshold Date")}
        />
        <ThresholdField
          label="Consultancy Threshold Day (1-31)"
          buttonLabel="Update Consultancy Threshold"
          currentValue={config?.consultancyThreshold}
          canEdit={isFinanceAdmin}
          onUpdate={(value) => requestThresholdUpdate("CONSULTANCY_THRESHOLD", value, "Consultancy Threshold Date")}
        />
      </Stack>

      <Box>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
          <Typography variant="h6">Banks</Typography>
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              size="small"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Button variant="contained" onClick={() => setAddBankOpen(true)}>
              Add Bank
            </Button>
          </Box>
        </Box>

        {filteredBanks.length === 0 ? (
          <Typography color="text.secondary">No banks found.</Typography>
        ) : (
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
            {filteredBanks.map((b) => (
              <Card key={b.bankCode} sx={{ p: 2 }}>
                <Typography sx={{ fontWeight: 600 }}>{b.bankName}</Typography>
                <Typography variant="body2">Bank Code: {b.bankCode}</Typography>
                <Typography variant="body2">SWIFT: {b.swiftCode}</Typography>
                {b.bankLocation && <Typography variant="body2">Location: {b.bankLocation}</Typography>}
              </Card>
            ))}
          </Box>
        )}
      </Box>

      <Dialog
        open={addBankOpen}
        onClose={closeAddBank}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: dialogPaperSx } }}
      >
        <DialogTitle>Add New Bank</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              label="Bank Name"
              fullWidth
              value={newBank.bankName}
              onChange={(e) => setNewBank((v) => ({ ...v, bankName: e.target.value }))}
            />
            <TextField
              label="Bank Code"
              fullWidth
              value={newBank.bankCode}
              onChange={(e) => setNewBank((v) => ({ ...v, bankCode: e.target.value }))}
              error={isCodeDuplicate}
              helperText={isCodeDuplicate ? "Bank code already exists" : ""}
            />
            <TextField
              label="SWIFT Code"
              fullWidth
              value={newBank.swiftCode}
              onChange={(e) => setNewBank((v) => ({ ...v, swiftCode: e.target.value }))}
              error={isSwiftDuplicate}
              helperText={isSwiftDuplicate ? "SWIFT code already exists" : ""}
            />
            <Autocomplete
              options={config?.allCountries ?? []}
              value={newBank.bankLocation || null}
              onChange={(_, next) => setNewBank((v) => ({ ...v, bankLocation: next ?? "" }))}
              renderInput={(params) => <TextField {...params} label="Location" />}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAddBank}>Cancel</Button>
          <Button variant="contained" disabled={!isNewBankValid} onClick={submitNewBank}>
            Submit
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmationDialog content={confirmation} onClose={() => setConfirmation(null)} />
    </Box>
  );
}

function ThresholdField({
  label,
  buttonLabel,
  currentValue,
  canEdit,
  onUpdate,
}: {
  label: string;
  buttonLabel: string;
  currentValue: number | undefined;
  canEdit: boolean;
  onUpdate: (value: number) => void;
}) {
  // `undefined` means "not yet touched by the admin" — the displayed value
  // then tracks the fetched threshold directly, with no effect needed to
  // keep the two in sync (that pattern — copying a prop into state — is
  // exactly what causes an extra render on every fetch). Once they type,
  // their edit takes over until the field resets.
  const [draft, setDraft] = useState<number | "" | undefined>(undefined);
  const value = draft !== undefined ? draft : (currentValue ?? "");
  const isUnchanged = value === currentValue;

  return (
    <Stack direction="row" spacing={2} alignItems="center">
      <TextField
        label={label}
        type="number"
        size="small"
        // A number input has no intrinsic width of its own, so without one
        // set here it sizes to the browser's narrow default — too narrow for
        // this field's own label, which then renders truncated ("Salary...")
        // in the outline's notch instead of clipping into it as a whole.
        sx={{ minWidth: 260 }}
        value={value}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return setDraft("");
          if (!/^\d+$/.test(raw)) return;
          setDraft(Math.max(1, Math.min(31, Number(raw))));
        }}
        slotProps={{ htmlInput: { min: 1, max: 31 } }}
      />
      <Button
        variant="contained"
        aria-label={buttonLabel}
        disabled={value === "" || isUnchanged || !canEdit}
        onClick={() => value !== "" && onUpdate(value)}
      >
        Update
      </Button>
    </Stack>
  );
}
