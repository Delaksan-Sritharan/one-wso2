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

// Where each kind of search hit leads, and where its group's "View All" goes.

import type { SearchItem, SearchKind, WorkQueues } from "../api/engagementTypes";
import { engagementPaths, type EngagementSegment, type InvoicesTab } from "../engagementPaths";
import type { EngagementAccess } from "./engagementAccess";
import { engagementSegments, invoiceTabs } from "./landing";

/** The backend searches from this many characters. */
export const SEARCH_MIN_CHARS = 2;

export const SEARCH_LABEL: Readonly<Record<SearchKind, string>> = {
  travelRequests: "Travels",
  invoices: "Invoices",
  perDiemPayments: "Per Diem Payments",
  engagements: "Engagements",
  allocations: "Allocations",
};

/** Whether the caller may search at all: any list a group belongs to. */
export const canSearch = (a: EngagementAccess): boolean => a.travelRequests || a.invoices || a.engagements || a.allocations;

const firstTab = (tabs: readonly InvoicesTab[], wanted: readonly InvoicesTab[]): InvoicesTab | undefined => wanted.find((t) => tabs.includes(t));

// A whole job number typed without its separators or prefix ("2026110003", "trv 2026 11 0003"), as the Backend's search reads it.
const JOB_FULL = /^(?:trv[- ]?)?(\d{4})[- ]?(\d{2})[- ]?(\d{4})$/i;
const JOB_PREFIX = /^trv[- ]/i;

/** The query as the list pages' job number search needs it: "2026110003" is TRV-2026-11-0003, and "trv-2026" is TRV-2026. */
export function jobQuery(q: string): string {
  const t = q.trim();
  const m = JOB_FULL.exec(t);
  if (m) return `TRV-${m[1]}-${m[2]}-${m[3]}`;
  return JOB_PREFIX.test(t) ? `TRV-${t.slice(4).trim()}` : t;
}

/** The list a group's hits come from, with the search typed into it. There is no list per hit for an invoice or a payment, so the tab is the broadest one the caller holds. */
export function listPath(kind: SearchKind, q: string, access: EngagementAccess, queues?: WorkQueues): string {
  const jobKind = kind === "travelRequests" || kind === "invoices" || kind === "perDiemPayments";
  const query = { q: (jobKind ? jobQuery(q) : q.trim()) || undefined };
  const tabs = invoiceTabs(access, queues);
  switch (kind) {
    case "travelRequests":
      return engagementPaths.travelRequests("all", query);
    case "invoices":
      return engagementPaths.invoices(firstTab(tabs, ["all-invoices", "finance", "po", "push"]) ?? "all-invoices", query);
    case "perDiemPayments":
      return engagementPaths.invoices(firstTab(tabs, ["all-payments", "payments-push"]) ?? "all-payments", query);
    case "engagements":
      return engagementPaths.engagements(engagementSegments(access)[0], query);
    case "allocations":
      return engagementPaths.allocations(access.engagementAllocations ? "engagement" : "team", query);
  }
}

/** The page of one hit. An invoice, a payment and an allocation have no page of their own: they open their list with the search typed in (an invoice or payment by its travel request's job number, when it has one). */
export function itemPath(kind: SearchKind, item: SearchItem, access: EngagementAccess, queues?: WorkQueues): string {
  switch (kind) {
    case "travelRequests":
      return engagementPaths.travelRequest(item.id);
    case "engagements":
      return engagementPaths.engagement(item.id);
    case "invoices":
      return listPath(kind, item.jobNumber ?? item.title, access, queues);
    case "perDiemPayments":
      return listPath(kind, item.jobNumber ?? item.id, access, queues);
    case "allocations":
      return listPath(kind, item.id, access, queues);
  }
}

const SEGMENT_LABEL: Readonly<Record<EngagementSegment, string>> = { customer: "Customer", internal: "Internal", marketing: "Marketing" };

/** One "View All" per engagement list the person can open (Customer, Internal, Marketing), each with the search typed in. */
export function engagementListLinks(q: string, access: EngagementAccess): { label: string; to: string }[] {
  const query = { q: q.trim() || undefined };
  return engagementSegments(access).map((s) => ({ label: SEGMENT_LABEL[s], to: engagementPaths.engagements(s, query) }));
}
