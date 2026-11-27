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

// The invoice and per diem payment columns, shared by Invoices & Payments, the travel request page and Reports.

import type { Column } from "../components/EaTable";
import type { Invoice, PerDiemPayment } from "../api/engagementTypes";
import { FinanceApprovalChip, InvoiceStatusChip, NsStatusChip, PoApprovalChip, Two, Mono } from "../components/StatusChips";
import { fmtDate, money } from "../model/format";
import JobLink from "./JobLink";

export function invoiceColumns({
  job = true,
  traveller = false,
  approvals = true,
  status = false,
  added = false,
  agent = false,
  jobBase,
}: {
  /** The Job Number column (left out on the travel request's own page). */
  job?: boolean;
  /** The traveller beside the job number, for the work queues. */
  traveller?: boolean;
  /** PO Approval, Finance Approval and NetSuite Status: left out on a queue, where every row reads the same. */
  approvals?: boolean;
  /** The single Invoice Status column, as the Reports page shows it. */
  status?: boolean;
  added?: boolean;
  /** A travel agent sees its own invoices: no agent column under the number. */
  agent?: boolean;
  jobBase?: (job: string) => string;
} = {}): Column<Invoice>[] {
  return [
    { key: "no", label: "Invoice Number", sortKey: "invoiceNumber", sortValue: (i) => i.number, render: (i) => <Two main={<Mono bold>{i.number}</Mono>} sub={agent ? undefined : i.travelAgent} /> },
    ...(traveller ? [{ key: "who", label: "Traveller", render: (i: Invoice) => (i.traveller ? <Two main={i.traveller.name} sub={i.traveller.email} /> : "—") }] : []),
    ...(job
      ? [
          {
            key: "job",
            label: "Job Number",
            sortKey: "jobNumber",
            sortValue: (i: Invoice) => i.jobNumber,
            render: (i: Invoice) => (
              <Two
                main={<JobLink job={i.jobNumber} to={jobBase} />}
                sub={[!traveller && i.traveller?.email, i.campaign && `Campaign: ${i.campaign.name}`].filter(Boolean).join("\n") || undefined}
              />
            ),
          },
        ]
      : []),
    { key: "type", label: "Cost Type", sortKey: "costType", sortValue: (i) => i.costType, render: (i) => <Two main={i.costType} sub={i.month} /> },
    {
      key: "amount",
      align: "right",
      label: "Amount",
      sortKey: "amount",
      sortValue: (i) => i.amount,
      render: (i) => <Two main={money(i.amount, i.currency)} sub={i.paidAmount !== undefined && i.paidAmount !== null ? `Paid ${money(i.paidAmount, i.paidCurrency)}` : undefined} />,
    },
    ...(approvals
      ? [
          { key: "po", label: "PO Approval", render: (i: Invoice) => <PoApprovalChip invoice={i} /> },
          { key: "fin", label: "Finance Approval", render: (i: Invoice) => <FinanceApprovalChip invoice={i} /> },
          { key: "ns", label: "NetSuite Status", render: (i: Invoice) => <NsStatusChip record={i} /> },
        ]
      : []),
    ...(status ? [{ key: "status", label: "Invoice Status", sortKey: "status", sortValue: (i: Invoice) => i.status, render: (i: Invoice) => <InvoiceStatusChip invoice={i} /> }] : []),
    ...(added ? [{ key: "added", label: "Added Date", sortKey: "addedDate", sortValue: (i: Invoice) => i.addedDate, render: (i: Invoice) => fmtDate(i.addedDate) }] : []),
  ];
}

export function paymentColumns({
  traveller = true,
  job = true,
  ns = true,
  added = true,
  jobBase,
}: { traveller?: boolean; job?: boolean; ns?: boolean; added?: boolean; jobBase?: (job: string) => string } = {}): Column<PerDiemPayment>[] {
  return [
    { key: "id", label: "Per Diem Payment Number", sortKey: "number", sortValue: (x) => x.id, render: (x) => <Mono>{x.id}</Mono> },
    ...(traveller ? [{ key: "who", label: "Traveller", render: (x: PerDiemPayment) => (x.traveller ? <Two main={x.traveller.name} sub={x.traveller.email} /> : "—") }] : []),
    ...(job
      ? [
          {
            key: "job",
            label: "Job Number",
            sortKey: "jobNumber",
            sortValue: (x: PerDiemPayment) => x.jobNumber,
            render: (x: PerDiemPayment) => <Two main={<JobLink job={x.jobNumber} to={jobBase} />} sub={x.campaign ? `Campaign: ${x.campaign.name}` : undefined} />,
          },
        ]
      : []),
    ...(added ? [{ key: "added", label: "Payment Added Date", sortKey: "addedDate", sortValue: (x: PerDiemPayment) => x.addedDate, render: (x: PerDiemPayment) => <Two main={fmtDate(x.addedDate)} sub={x.addedBy} /> }] : []),
    { key: "amount", label: "Amount", align: "right", sortKey: "amount", sortValue: (x) => x.convertedAmount ?? x.amount, render: (x) => <Two main={money(x.amount, x.currency)} sub={money(x.convertedAmount, x.convertedCurrency)} /> },
    ...(ns ? [{ key: "ns", label: "NetSuite Status", render: (x: PerDiemPayment) => <NsStatusChip record={x} /> }] : []),
  ];
}
