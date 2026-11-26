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

// Every Engagement App write, as openapi.yaml defines it.

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authedDelete, authedPatch, authedPost, authedPut } from "@api/http";
import { engagementServiceUrls as urls } from "@config/apiConfig";
import { ENGAGEMENT_KEY_ROOT, useEngagementBasis } from "./engagementBasis";
import { engagementUpload } from "./engagementHttp";
import * as M from "./engagementMappers";
import type { AllocationTypeDef, BatchOutcome, ClearanceStatus, DocumentKind, EngagementStatus, TravelStatus } from "./engagementTypes";
import type * as W from "./engagementWire";

type Parts = readonly unknown[];

function newKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** One idempotency key per user action: the same across retries of that action, a fresh one once it succeeded (`renew`). */
export function useIdempotencyKey(): { key: string; renew: () => void; keyFor: (scope: string) => string } {
  const [key, setKey] = useState(newKey);
  // keyFor: one key per action and record set, reused on a retry of the same scope.
  const scoped = useRef<{ scope: string; key: string } | null>(null);
  return {
    key,
    renew: () => {
      scoped.current = null;
      setKey(newKey());
    },
    keyFor: (scope) => {
      if (scoped.current?.scope !== scope) scoped.current = { scope, key: newKey() };
      return scoped.current.key;
    },
  };
}

const idem = (key: string | undefined): Record<string, string> | undefined => (key ? { "Idempotency-Key": key } : undefined);

/** Reports and search read the same records every write changes, so every write refreshes them too. */
const EVERYWHERE: readonly Parts[] = [["reports"], ["search"]];

function useEngagementMutation<V, R = unknown>(run: (vars: V, token: string) => Promise<R>, affects: (vars: V) => readonly Parts[]) {
  const { getToken, key } = useEngagementBasis();
  const queryClient = useQueryClient();
  return useMutation<R, Error, V>({
    mutationKey: [ENGAGEMENT_KEY_ROOT, "mutation"],
    mutationFn: async (vars) => run(vars, await getToken()),
    onSuccess: (_result, vars) =>
      Promise.all([...affects(vars), ...EVERYWHERE].map((parts) => queryClient.invalidateQueries({ queryKey: key(...parts) }))).then(() => undefined),
  });
}

// ---------------------------------------------------------------- engagements

/** The Create / Edit form's fields, as EngagementCreate names them. */
export interface EngagementInput {
  readonly engagementTypeId: number;
  readonly accountId?: string;
  readonly opportunityId?: string;
  readonly opportunityLineItemId?: string;
  readonly campaignId?: string;
  readonly title?: string;
  readonly description?: string;
  readonly allocationTypeId?: number;
  readonly nature: string;
  readonly country: string;
  readonly address: string;
  readonly businessUnit?: string;
  readonly productUnit?: string;
  readonly salesSubRegion?: string;
  readonly fundingSources?: readonly { region: string; subRegion: string; businessUnit: string; productUnit: string; percentage: number }[];
  readonly startDate: string;
  readonly endDate: string;
  readonly customerContact?: string;
  readonly businessDomain?: string;
  readonly engagementScope?: string;
  readonly comments?: string;
  readonly tentativeDates?: boolean;
}

const ENGAGEMENT_AFFECTS: readonly Parts[] = [["engagements"], ["approvals"], ["dashboard"]];

export const useCreateEngagement = () =>
  useEngagementMutation(
    async ({ body, idempotencyKey }: { body: EngagementInput; idempotencyKey: string }, token) => {
      const created = await authedPost<W.WEngagementDetail>(urls.engagements(), token, body, idem(idempotencyKey));
      return created ? M.engagementDetail(created) : null;
    },
    () => ENGAGEMENT_AFFECTS,
  );

export interface EngagementChange {
  readonly id: string;
  readonly fields?: Partial<EngagementInput> & { readonly refreshDatesFromSalesforce?: boolean };
  /** Confirm and Approve from the edit form. */
  readonly approve?: boolean;
}

const ENGAGEMENT_ALL: readonly Parts[] = [...ENGAGEMENT_AFFECTS, ["allocations"], ["team-allocations"], ["travel-requests"], ["me"]];

export const useUpdateEngagement = () =>
  useEngagementMutation(
    ({ id, fields, approve }: EngagementChange, token) => authedPatch<W.WEngagementDetail>(urls.engagement(id), token, { ...fields, ...(approve ? { approve } : {}) }),
    () => ENGAGEMENT_ALL,
  );

/** Mark as Completed or Reopen. */
export const useSetRequestStatus = () =>
  useEngagementMutation(
    ({ id, status }: { id: string; status: "Completed" | "In Progress" }, token) => authedPost<unknown>(urls.engagementRequestStatus(id), token, { status }),
    () => ENGAGEMENT_ALL,
  );

/** Change Engagement Status; Cancelled cascades on the backend. */
export const useSetEngagementStatus = () =>
  useEngagementMutation(
    ({ id, status }: { id: string; status: EngagementStatus }, token) => authedPost<unknown>(urls.engagementStatus(id), token, { status }),
    () => ENGAGEMENT_ALL,
  );

export const useApproveEngagement = () =>
  useEngagementMutation(({ id }: { id: string }, token) => authedPost<unknown>(urls.engagementApprove(id), token, {}), () => ENGAGEMENT_AFFECTS);

// ---------------------------------------------------------------- allocations

export interface AllocationInput {
  readonly consultantEmail: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly hourly?: { timeZone: string; startTime: string; endTime: string };
  readonly clearanceStatus?: ClearanceStatus;
  readonly tentative?: boolean;
  readonly travelRequired: boolean;
  readonly comment?: string;
  readonly preparationStart?: string;
  readonly postEngagementEnd?: string;
  /** Confirms trimming or splitting the default allocations a 409 named. */
  readonly trimDefaultAllocations?: boolean;
}

const ALLOCATION_AFFECTS: readonly Parts[] = [["engagements"], ["allocations"], ["team-allocations"], ["travel-requests"], ["dashboard"], ["me"]];

export const useCreateAllocation = () =>
  useEngagementMutation(
    ({ engagementId, body, idempotencyKey }: { engagementId: string; body: AllocationInput; idempotencyKey: string }, token) =>
      authedPost<unknown>(urls.engagementAllocations(engagementId), token, body, idem(idempotencyKey)),
    () => ALLOCATION_AFFECTS,
  );

export const useSetAllocationStatus = () =>
  useEngagementMutation(
    ({ id, status, comment }: { id: string; status: ClearanceStatus; comment?: string }, token) =>
      authedPatch<unknown>(urls.allocationStatus(id), token, { clearanceStatus: status, comment }),
    () => ALLOCATION_AFFECTS,
  );

export interface TeamAllocationInput {
  readonly email: string;
  readonly allocationTypeId: number;
  readonly engagementCode?: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly comment?: string;
}

const TEAM_AFFECTS: readonly Parts[] = [["team-allocations"], ["allocations"], ["dashboard"], ["me"]];

export const useCreateTeamAllocation = () =>
  useEngagementMutation(
    ({ body, idempotencyKey }: { body: TeamAllocationInput; idempotencyKey: string }, token) =>
      authedPost<unknown>(urls.teamAllocations(), token, body, idem(idempotencyKey)),
    () => TEAM_AFFECTS,
  );

export const useUpdateTeamAllocation = () =>
  useEngagementMutation(
    ({ id, ...body }: { id: string; startDate?: string; endDate?: string; comment?: string }, token) => authedPatch<unknown>(urls.teamAllocation(id), token, body),
    () => TEAM_AFFECTS,
  );

export const useDeleteTeamAllocation = () =>
  useEngagementMutation(({ id }: { id: string }, token) => authedDelete(urls.teamAllocation(id), token), () => TEAM_AFFECTS);

/** Bulk Upload, step one: what is wrong and what is ready. Nothing is saved. */
export const useValidateTeamUpload = () =>
  useEngagementMutation(
    async ({ csv }: { csv: string }, token) => {
      const res = await authedPost<W.WBulkValidation>(urls.teamAllocationsBulkValidate, token, { csv });
      return res ? M.bulkValidation(res) : null;
    },
    () => [],
  );

/** Bulk Upload, step two: the valid rows are saved. */
export const useUploadTeamAllocations = () =>
  useEngagementMutation(
    async ({ csv, idempotencyKey }: { csv: string; idempotencyKey: string }, token) => {
      const res = await authedPost<W.WBulkValidation>(urls.teamAllocationsBulk, token, { csv }, idem(idempotencyKey));
      return res ? M.bulkValidation(res) : null;
    },
    () => TEAM_AFFECTS,
  );

// ---------------------------------------------------------------- travel

export interface TravelRequestChange {
  readonly jobNumber: string;
  readonly status?: TravelStatus;
  /** The travel agency's name. */
  readonly agency?: string;
  /** A visa id from visa-options, or one of the two legacy sentinels. */
  readonly visa?: string;
}

const TRAVEL_AFFECTS: readonly Parts[] = [["travel-requests"], ["invoices"], ["per-diem-payments"], ["ns-sync-failures"], ["engagements"], ["allocations"], ["dashboard"], ["me"]];

export const useUpdateTravelRequest = () =>
  useEngagementMutation(
    ({ jobNumber, ...body }: TravelRequestChange, token) => authedPatch<unknown>(urls.travelRequest(jobNumber), token, body),
    () => TRAVEL_AFFECTS,
  );

export const useAddPerDiem = () =>
  useEngagementMutation(
    (
      {
        jobNumber,
        idempotencyKey,
        ...body
      }: { jobNumber: string; idempotencyKey: string; startDate: string; startTime: string; endDate: string; endTime: string; currency: string; rate: number },
      token,
    ) => authedPost<unknown>(urls.perDiems(jobNumber), token, body, idem(idempotencyKey)),
    () => TRAVEL_AFFECTS,
  );

export const useDeletePerDiem = () =>
  useEngagementMutation(({ jobNumber, id }: { jobNumber: string; id: string }, token) => authedDelete(urls.perDiem(jobNumber, id), token), () => TRAVEL_AFFECTS);

export interface InvoiceInput {
  readonly invoiceNumber: string;
  readonly month: string;
  readonly costType: string;
  readonly amount: number;
  readonly currency: string;
  readonly paidAmount?: number | null;
  readonly paidCurrency?: string | null;
}

export const useAddInvoice = () =>
  useEngagementMutation(
    ({ jobNumber, invoice, idempotencyKey }: { jobNumber: string; invoice: InvoiceInput; idempotencyKey: string }, token) =>
      authedPost<unknown>(urls.tripInvoices(jobNumber), token, { invoices: [invoice] }, idem(idempotencyKey)),
    () => TRAVEL_AFFECTS,
  );

export const useAddTravelCard = () =>
  useEngagementMutation(
    ({ jobNumber, idempotencyKey, ...body }: { jobNumber: string; idempotencyKey: string; currency: string; amount: number }, token) =>
      authedPost<unknown>(urls.travelCards(jobNumber), token, body, idem(idempotencyKey)),
    () => TRAVEL_AFFECTS,
  );

/** Add a per diem payment (with a key), or edit one (by id). */
export const useSavePayment = () =>
  useEngagementMutation(
    ({ jobNumber, id, amount, idempotencyKey }: { jobNumber: string; id?: string; amount: number; idempotencyKey?: string }, token) =>
      id ? authedPatch<unknown>(urls.perDiemPayment(id), token, { amount }) : authedPost<unknown>(urls.tripPayments(jobNumber), token, { amount }, idem(idempotencyKey)),
    () => TRAVEL_AFFECTS,
  );

/** Invoice and payment bulk actions: one request for the selection, a result per record. */
export type BulkAction = "approve" | "reject" | "push" | "resync";

export const useInvoiceBatch = () =>
  useEngagementMutation(
    async ({ action, ids, reason, idempotencyKey }: { action: BulkAction; ids: readonly string[]; reason?: string; idempotencyKey?: string }, token): Promise<BatchOutcome> => {
      const url = { approve: urls.invoicesApprove, reject: urls.invoicesReject, push: urls.invoicesPush, resync: urls.invoicesResync }[action];
      const body = { invoiceIds: ids.map(Number), ...(action === "reject" ? { reason } : {}) };
      const res = await authedPost<W.WBatchResult>(url, token, body, action === "push" ? idem(idempotencyKey) : undefined);
      return M.batchOutcome(res);
    },
    () => TRAVEL_AFFECTS,
  );

export const usePaymentBatch = () =>
  useEngagementMutation(
    async ({ action, ids, idempotencyKey }: { action: "push" | "resync"; ids: readonly string[]; idempotencyKey?: string }, token): Promise<BatchOutcome> => {
      const res = await authedPost<W.WBatchResult>(
        action === "push" ? urls.paymentsPush : urls.paymentsResync,
        token,
        { paymentIds: ids },
        action === "push" ? idem(idempotencyKey) : undefined,
      );
      return M.batchOutcome(res);
    },
    () => TRAVEL_AFFECTS,
  );

// ---------------------------------------------------------------- visas and documents

export interface TravelDocumentInput {
  readonly kind: DocumentKind;
  /** Absent for the person's own records. */
  readonly travellerEmail?: string;
  /** VisaForm / TravelDocumentForm fields, by their spec names. */
  readonly fields: Readonly<Record<string, string>>;
  readonly image?: File;
}

function documentForm({ travellerEmail, fields, image }: TravelDocumentInput): FormData {
  const form = new FormData();
  if (travellerEmail) form.set("travellerEmail", travellerEmail);
  for (const [k, v] of Object.entries(fields)) if (v) form.set(k, v);
  if (image) form.set("image", image);
  return form;
}

export const useSaveTravelDocument = (own: boolean) =>
  useEngagementMutation(
    ({ id, idempotencyKey, ...input }: TravelDocumentInput & { id?: string; idempotencyKey?: string }, token) => {
      const visa = input.kind === "visa";
      if (id) return engagementUpload<unknown>(visa ? urls.visa(id) : urls.travelDocument(id), token, documentForm(input), "PUT");
      const url = own ? (visa ? urls.myVisas() : urls.myTravelDocuments) : visa ? urls.visas() : urls.travelDocuments();
      return engagementUpload<unknown>(url, token, documentForm(input), "POST", idempotencyKey);
    },
    () => [["visas"], ["travel-documents"], ["me", "visas"], ["me", "travel-documents"], ["me", "overview"], ["dashboard"], ["passports"], ["travel-requests"]],
  );

// ---------------------------------------------------------------- settings

export const useSaveAllocationType = () =>
  useEngagementMutation(
    ({ id, idempotencyKey, ...t }: Omit<AllocationTypeDef, "id"> & { id?: string; idempotencyKey?: string }, token) => {
      const body = {
        engagementTypeId: t.engagementTypeId,
        allocationTypeName: t.name,
        defaultEngagementCode: t.code ?? "",
        engagementCodeSuffix: t.suffix,
        department: t.department,
        emailToAllocations: t.notifyToAllocations,
        color: t.color,
      };
      return id ? authedPut<unknown>(urls.allocationType(id), token, body) : authedPost<unknown>(urls.allocationTypes(), token, body, idem(idempotencyKey));
    },
    () => [["settings", "allocation-types"], ["reference-data"]],
  );

export const useDeleteAllocationType = () =>
  useEngagementMutation(({ id }: { id: string }, token) => authedDelete(urls.allocationType(id), token), () => [["settings", "allocation-types"], ["reference-data"]]);

export const useSaveRolePrivileges = () =>
  useEngagementMutation(
    ({ app, roleId, privileges }: { app: "allocations" | "travel"; roleId: string; privileges: readonly number[] }, token) =>
      authedPut<unknown>(urls.rolePrivileges(app, roleId), token, { privilegeIds: privileges }),
    // A role change can change the caller's own access.
    ({ app }) => [["settings", "roles", app], ["user-info"]],
  );

