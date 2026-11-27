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

// The legacy status values, their chip colours, and the transitions the
// legacy screens offered. Values are the apps' own spellings: never renamed.

import type {
  AllocationStatus,
  EngagementStatus,
  Invoice,
  InvoiceStatus,
  RequestStatus,
  TravelStatus,
} from "../api/engagementTypes";

/** A status colour: the theme's success / error / warning, or a fixed in-progress blue (info) or extended violet. */
export type ChipTone = "success" | "error" | "warning" | "info" | "violet" | "default";

const EXPENSE_TONE: Readonly<Record<string, ChipTone>> = {
  New: "default",
  "Pending Lead": "warning",
  "Pending Finance": "warning",
  Submitted: "success",
  "Pending Approval": "warning",
  "Lead Approved": "info",
  Approved: "success",
  Rejected: "error",
};
/** A credit card expense's or an expense claim's status (as the mapper words it). */
export const expenseTone = (status: string): ChipTone => EXPENSE_TONE[status] ?? "default";

export const REQUEST_STATUSES: readonly RequestStatus[] = [
  "Pending Approval",
  "New",
  "Updated",
  "Approved",
  "In Progress",
  "Completed",
  "Cancelled",
];

export const ENGAGEMENT_STATUSES: readonly EngagementStatus[] = ["Confirmed", "Pending", "In Progress", "Completed", "Cancelled"];

export const ALLOCATION_STATUSES: readonly AllocationStatus[] = [
  "Tentative",
  "Ready for Clearance",
  "Clearance In Progress",
  "Accepted by Consultant",
  "Rejected by Consultant",
  "Rejected - Visa Issues",
  "Rejected - Other",
  "Confirmed",
  "Confirmed - Visa Pending",
  "Allocation Cancelled",
];

/** travelStatusArray order. */
export const TRAVEL_STATUSES: readonly TravelStatus[] = ["New", "In Progress", "Completed", "On Hold", "Cancelled", "Extended"];

const REQUEST_TONE: Record<RequestStatus, ChipTone> = {
  "Pending Approval": "warning",
  Approved: "success",
  New: "warning",
  Updated: "info",
  "In Progress": "info",
  Completed: "success",
  Cancelled: "default",
};

const ENGAGEMENT_TONE: Record<EngagementStatus, ChipTone> = {
  Confirmed: "success",
  Pending: "warning",
  "In Progress": "info",
  Completed: "success",
  Cancelled: "default",
};

const ALLOCATION_TONE: Record<AllocationStatus, ChipTone> = {
  Tentative: "default",
  "Ready for Clearance": "info",
  "Clearance In Progress": "warning",
  "Accepted by Consultant": "info",
  "Rejected by Consultant": "error",
  "Rejected - Visa Issues": "error",
  "Rejected - Other": "error",
  Confirmed: "success",
  "Confirmed - Visa Pending": "success",
  "Allocation Cancelled": "default",
};

const TRAVEL_TONE: Record<TravelStatus, ChipTone> = {
  New: "warning",
  "In Progress": "info",
  "On Hold": "default",
  Extended: "violet",
  Completed: "success",
  Cancelled: "default",
};

export const requestTone = (s: RequestStatus): ChipTone => REQUEST_TONE[s] ?? "default";
export const engagementTone = (s: EngagementStatus): ChipTone => ENGAGEMENT_TONE[s] ?? "default";
export const allocationTone = (s: AllocationStatus): ChipTone => ALLOCATION_TONE[s] ?? "default";
export const travelTone = (s: TravelStatus): ChipTone => TRAVEL_TONE[s] ?? "default";

/** Not rejected and not cancelled: the allocations that count. */
export const isActiveAllocation = (s: AllocationStatus): boolean => !/Rejected|Cancelled/.test(s);

/** Allowed Update Allocation Status transitions (EngagementAllocations.js getStatusList). */
const ALLOCATION_NEXT: Partial<Record<AllocationStatus, readonly AllocationStatus[]>> = {
  Tentative: ["Ready for Clearance", "Clearance In Progress", "Confirmed", "Confirmed - Visa Pending", "Allocation Cancelled"],
  "Ready for Clearance": ["Clearance In Progress", "Confirmed", "Confirmed - Visa Pending", "Allocation Cancelled"],
  "Clearance In Progress": ["Accepted by Consultant", "Rejected by Consultant", "Allocation Cancelled"],
  "Accepted by Consultant": ["Confirmed", "Confirmed - Visa Pending", "Rejected by Consultant", "Allocation Cancelled"],
  Confirmed: ["Rejected by Consultant", "Rejected - Visa Issues", "Rejected - Other", "Allocation Cancelled"],
  "Confirmed - Visa Pending": ["Confirmed", "Rejected - Visa Issues", "Rejected by Consultant", "Allocation Cancelled"],
};
const ALLOCATION_REOPEN: readonly AllocationStatus[] = ["Clearance In Progress", "Confirmed", "Confirmed - Visa Pending", "Allocation Cancelled"];

export const nextAllocationStatuses = (s: AllocationStatus): readonly AllocationStatus[] => ALLOCATION_NEXT[s] ?? ALLOCATION_REOPEN;

/** The Allocation Status choices when allocating on an internal engagement or event. */
export const INTERNAL_START_STATUSES: readonly AllocationStatus[] = ["Tentative", "Clearance In Progress", "Confirmed", "Confirmed - Visa Pending"];

/** Legacy Travel Status transitions (TravelInformation.js), the current status first. */
const TRAVEL_NEXT: Record<TravelStatus, readonly TravelStatus[]> = {
  New: ["New", "In Progress", "On Hold", "Cancelled"],
  "In Progress": ["In Progress", "Completed", "On Hold", "Cancelled", "Extended"],
  Completed: ["Completed", "Extended", "Cancelled"],
  "On Hold": ["In Progress", "On Hold", "Cancelled", "Extended"],
  Cancelled: ["In Progress", "On Hold", "Cancelled", "Extended"],
  Extended: ["On Hold", "Cancelled", "Extended", "Completed"],
};

export const nextTravelStatuses = (s: TravelStatus): readonly TravelStatus[] => TRAVEL_NEXT[s] ?? [s];

/** Per diems, travel cards, payments, pushes and edits: while In Progress or Extended. */
export const isOpenTrip = (s: TravelStatus): boolean => s === "In Progress" || s === "Extended";

/** The legacy Add Invoice rule also allows a Cancelled request. */
export const canAddInvoiceTo = (s: TravelStatus): boolean => isOpenTrip(s) || s === "Cancelled";

/** In Progress, Completed and Extended need a travel agent and a visa. */
export const needsAgentAndVisa = (s: TravelStatus): boolean => s === "In Progress" || s === "Completed" || s === "Extended";

export const NO_VALID_VISA = "No Valid Visa Available";
export const VISA_NOT_APPLICABLE = "Visa Not Applicable";

// ---------------------------------------------------------------- invoices

/** The invoice's legacy status chip. */
export function invoiceTone(s: InvoiceStatus): ChipTone {
  if (s === "Pending") return "warning";
  if (s === "Complete") return "success";
  if (s.startsWith("Rejected")) return "error";
  return "info";
}

/** PO Approval column (status-colors.js): Pending, Approved or Rejected. */
export function poApproval(i: Pick<Invoice, "status">): { label: string; tone: ChipTone } {
  if (i.status === "Pending") return { label: "Pending", tone: "warning" };
  if (i.status === "Rejected by travel") return { label: "Rejected", tone: "error" };
  return { label: "Approved", tone: "success" };
}

/** Finance Approval column. */
export function financeApproval(i: Pick<Invoice, "status">): { label: string; tone: ChipTone } {
  if (i.status === "Rejected by finance") return { label: "Rejected", tone: "error" };
  if (i.status === "Accepted by finance" || i.status === "Complete") return { label: "Approved", tone: "success" };
  return { label: "Pending", tone: "warning" };
}

/** Which approval step an invoice is waiting at, for selection rules. */
export type InvoiceStage = "po" | "finance" | "push" | "failed" | "done";

export function invoiceStage(i: Pick<Invoice, "status" | "nsError">): InvoiceStage {
  if (i.status === "Pending") return "po";
  if (i.status === "Accepted by travel") return "finance";
  if (i.status === "Accepted by finance") return i.nsError ? "failed" : "push";
  return "done";
}

/** The Travel app's cost types, the Invoice Currency and the Travel Card Currency lists. */
export const INVOICE_CURRENCIES = ["LKR", "USD"] as const;
export const TRAVEL_CARD_CURRENCIES = ["USD", "GBP"] as const;
export const VISA_TYPES = ["Business/Visit", "Work Permit", "Permanent Residence", "Other"] as const;
export const ENTRY_TYPES = ["Single", "Double", "Multiple"] as const;
export const DOCUMENT_TYPES = ["Passport", "Driver License", "Other ID Document"] as const;
export const NATURES = ["On-site", "Off-site"] as const;
export const EVENT_NATURES = ["Physical", "Virtual", "Hybrid"] as const;
