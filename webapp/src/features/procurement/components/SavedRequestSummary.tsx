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

import type { ReactNode } from "react";
import { Alert, Button, Stack } from "@wso2/oxygen-ui";
import { describeError } from "@api/errors";
import { budgetForDisplay } from "../request-form/requestFormModel";
import { canDownload, scanNote } from "../request-form/attachmentRules";
import { useAttachments, useDownloadAttachment, useEngagementCodes, useProcurementLookups } from "../api/useProcurement";
import type { PurchaseRequest } from "../types";
import RequestSummary, { type AttachmentRow } from "./RequestSummary";

/**
 * A saved request as the summary cards, with budget codes shown as the names the lists give them.
 *
 * @param budgetAction - Shown at the top of the Budget card, for a control that changes the budget details
 * @param requesterAction - Shown at the top of the Requester card, for a control that changes the team lead
 */
export default function SavedRequestSummary({
  request,
  budgetAction,
  requesterAction,
}: {
  request: PurchaseRequest;
  budgetAction?: ReactNode;
  requesterAction?: ReactNode;
}) {
  const lookups = useProcurementLookups();
  const unitName = lookups.data?.businessUnits.find((u) => u.value === request.budget.businessUnit)?.label ?? "";
  const engagementCodes = useEngagementCodes(unitName);
  const attachments = useAttachments(request.id);
  const download = useDownloadAttachment(request.id);
  const rows: AttachmentRow[] = (attachments.data ?? []).map((a) => ({
    key: a.id,
    name: a.name,
    sizeBytes: a.sizeBytes,
    note: scanNote(a),
    onDownload: canDownload(a) ? () => download.mutate(a) : undefined,
    downloading: download.isPending && download.variables?.id === a.id,
  }));
  return (
    <Stack spacing={2}>
      {attachments.isError && (
        <Alert
          severity="warning"
          action={
            <Button color="inherit" size="small" onClick={() => void attachments.refetch()}>
              Retry
            </Button>
          }
        >
          The attachments could not be loaded. {describeError(attachments.error)}
        </Alert>
      )}
      {download.isError && <Alert severity="error">The file could not be downloaded. {describeError(download.error)}</Alert>}
      {(lookups.isError || engagementCodes.isError) && (
        <Alert
          severity="warning"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                if (lookups.isError) void lookups.refetch();
                if (engagementCodes.isError) void engagementCodes.refetch();
              }}
            >
              Retry
            </Button>
          }
        >
          Some names could not be loaded, so budget values show as codes.{" "}
          {describeError(lookups.isError ? lookups.error : engagementCodes.error)}
        </Alert>
      )}
      <RequestSummary
        view={{
          category: request.category,
          requester: request.requester,
          teamLead: request.teamLead,
          additionalApprovers: request.additionalApprovers,
          details: request.details,
          event: request.event,
          vendors: request.vendors,
          budget: lookups.data ? budgetForDisplay(request.budget, lookups.data, engagementCodes.data ?? []) : request.budget,
          budgetApprover: request.budgetApproverName,
          notes: request.notes,
          attachments: rows,
          date: request.submittedAt ? { label: "Raised", iso: request.submittedAt } : undefined,
        }}
        budgetAction={budgetAction}
        requesterAction={requesterAction}
      />
    </Stack>
  );
}
