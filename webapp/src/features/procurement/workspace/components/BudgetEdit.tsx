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
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Skeleton, Stack, Typography } from "@wso2/oxygen-ui";
import { PencilIcon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useBudgetApprovers, useChangeBudget, useEngagementCodes, useProcurementLookups } from "../../api/useProcurement";
import { OptionField } from "../../request-form/formFields";
import type { BudgetDetails, PurchaseRequest } from "../../types";
import { raisedOrApproves } from "../handlingAccess";

const TWO_COLUMNS = { display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, pt: 1 } as const;

const sameBudget = (a: BudgetDetails, b: BudgetDetails): boolean =>
  a.category === b.category && a.businessUnit === b.businessUnit && a.product === b.product && a.region === b.region && a.engagementCode === b.engagementCode;

/** The budget details of a request in a pop-up, as they are now, that Procurement can change and save. It cannot be dismissed while a save runs. Saving sends the requester an email. */
function BudgetForm({ request, onClose }: { request: PurchaseRequest; onClose: () => void }) {
  const lookups = useProcurementLookups();
  const change = useChangeBudget(request.id);
  const { showSuccess } = useNotifications();
  const [budget, setBudget] = useState<BudgetDetails>(request.budget);
  const [approverId, setApproverId] = useState(request.budgetApproverId);
  // The engagement codes are asked for by the unit's name; the approvers by its code.
  const unitName = lookups.data?.businessUnits.find((u) => u.value === budget.businessUnit)?.label ?? "";
  const codes = useEngagementCodes(unitName);
  const approvers = useBudgetApprovers({ businessUnit: budget.businessUnit, region: budget.region });
  const approverChoices = (approvers.data ?? []).map((a) => ({ value: a.id, label: a.name }));
  if (approverId && !approverChoices.some((c) => c.value === approverId)) {
    approverChoices.push({ value: approverId, label: approverId === request.budgetApproverId && request.budgetApproverName ? request.budgetApproverName : approverId });
  }
  const changed = !sameBudget(budget, request.budget) || approverId !== request.budgetApproverId;
  // A Non-IT request keeps its engagement code, so a change that leaves it blank is not sent.
  const complete = request.category !== "NON-IT" || budget.engagementCode !== "";
  const saving = change.isPending;
  // Another unit or region means other codes and approvers apply, so a pick made under the old one is cleared.
  const changeUnit = (businessUnit: string) => {
    setBudget({ ...budget, businessUnit, engagementCode: "" });
    setApproverId("");
  };
  const changeRegion = (region: string) => {
    setBudget({ ...budget, region });
    setApproverId("");
  };
  const save = () =>
    change.mutate(
      { budget, budgetApproverId: approverId },
      {
        onSuccess: () => {
          showSuccess("Budget details have been updated. The requester has been notified by email.");
          onClose();
        },
      },
    );

  return (
    // Escape and a click outside do not close the pop-up while the save runs, or its result would be lost.
    <Dialog open fullWidth maxWidth="sm" onClose={() => !saving && onClose()}>
      <DialogTitle>Edit budget details</DialogTitle>
      <DialogContent>
        {lookups.isError && !lookups.data && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => void lookups.refetch()}>
                Retry
              </Button>
            }
          >
            {describeError(lookups.error)}
          </Alert>
        )}
        {!lookups.data && !lookups.isError && <Skeleton variant="rounded" height={160} />}
        {lookups.data && (
          <Stack spacing={2}>
            <Box sx={TWO_COLUMNS}>
              <OptionField label="Budget category" choices={lookups.data.budgetCategories} value={budget.category} disabled={saving} onChange={(category) => setBudget({ ...budget, category })} />
              <OptionField label="Business unit" choices={lookups.data.businessUnits} value={budget.businessUnit} disabled={saving} onChange={changeUnit} />
              <OptionField label="Product" choices={lookups.data.products} value={budget.product} disabled={saving} onChange={(product) => setBudget({ ...budget, product })} />
              <OptionField label="Region" choices={lookups.data.regions} value={budget.region} disabled={saving} onChange={changeRegion} />
              <OptionField
                label="Engagement code"
                required={request.category === "NON-IT"}
                choices={codes.data ?? []}
                value={budget.engagementCode}
                disabled={saving || !budget.businessUnit}
                placeholder={!budget.businessUnit ? "Select a business unit first" : codes.isFetching ? "Loading…" : undefined}
                emptyText="No engagement codes for this business unit"
                onChange={(engagementCode) => setBudget({ ...budget, engagementCode })}
              />
              <OptionField
                label="Budget approver"
                choices={approverChoices}
                value={approverId}
                disabled={saving || (!budget.businessUnit && !budget.region)}
                placeholder={!budget.businessUnit && !budget.region ? "Select a business unit or region first" : approvers.isFetching ? "Loading…" : undefined}
                emptyText="No budget approver covers this business unit or region"
                onChange={setApproverId}
              />
            </Box>
            {codes.isError && <Alert severity="error">{describeError(codes.error)}</Alert>}
            {approvers.isError && <Alert severity="error">{describeError(approvers.error)}</Alert>}
            <Typography variant="caption" color="text.secondary">
              The requester will be notified by email with the new details when you save.
            </Typography>
          </Stack>
        )}
        {change.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {describeError(change.error)}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button color="inherit" disabled={saving} onClick={onClose}>
          Cancel
        </Button>
        <Button variant="contained" disabled={saving || !changed || !complete} onClick={save}>
          {saving ? "Saving…" : "Save budget"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * A pencil on the summary's Budget card that opens a pop-up with the budget details as they are now, for Procurement
 * to change and save. It shows to nobody who raised or approves the request, whom the backend does not let change it.
 */
export default function BudgetEdit({ request, me }: { request: PurchaseRequest; me: string }) {
  const [open, setOpen] = useState(false);
  if (raisedOrApproves(request, me)) return null;
  return (
    <>
      <IconButton size="small" aria-label="Edit budget details" onClick={() => setOpen(true)}>
        <PencilIcon size={16} />
      </IconButton>
      {open && <BudgetForm request={request} onClose={() => setOpen(false)} />}
    </>
  );
}
