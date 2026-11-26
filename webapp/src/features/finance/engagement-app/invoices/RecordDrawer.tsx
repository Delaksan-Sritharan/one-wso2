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

import type { JSX, ReactNode } from "react";
import { Box } from "@wso2/oxygen-ui";
import type { Invoice, PerDiemPayment } from "../api/engagementTypes";
import { FactsGrid } from "../components/Facts";
import { PersonTwo } from "../components/PersonChip";
import { FinanceApprovalChip, NsStatusChip, PoApprovalChip, Two } from "../components/StatusChips";
import { fmtDate, money } from "../model/format";
import RecordDrawer from "../components/RecordDrawer";
import { SectionTitle } from "../components/ListCard";
import JobLink from "./JobLink";

export function InvoiceDrawer({ invoice: i, actions, onClose, agent = false, jobBase }: { invoice: Invoice; actions?: ReactNode; onClose: () => void; agent?: boolean; jobBase?: (job: string) => string }): JSX.Element {
  return (
    <RecordDrawer title={`Invoice ${i.number}`} subtitle={agent ? i.traveller?.name : i.travelAgent} actions={actions} onClose={onClose}>
      <FactsGrid
        columns={2}
        facts={[
          { label: "Job Number", value: <JobLink job={i.jobNumber} to={jobBase} /> },
          i.traveller && { label: "Traveller", value: <PersonTwo name={i.traveller.name} email={i.traveller.email} sub={i.traveller.email} /> },
          i.campaign && { label: "Campaign", value: <Two main={i.campaign.name} sub={i.campaign.id} /> },
          { label: "Cost Type", value: i.costType },
          { label: "Month", value: i.month },
          { label: "Invoice Amount", value: money(i.amount, i.currency) },
          { label: "Paid Amount", value: i.paidAmount !== undefined ? money(i.paidAmount, i.paidCurrency) : undefined },
          { label: "Added", value: <Two main={fmtDate(i.addedDate)} sub={i.addedBy} /> },
        ]}
      />
      <Box sx={{ mt: 3 }}>
        <SectionTitle>Approval</SectionTitle>
      </Box>
      <FactsGrid
        columns={2}
        facts={[
          { label: "PO Approval", value: <PoApprovalChip invoice={i} /> },
          { label: "Finance Approval", value: <FinanceApprovalChip invoice={i} /> },
          { label: "NetSuite Status", value: <NsStatusChip record={i} /> },
        ]}
      />
    </RecordDrawer>
  );
}

export function PaymentDrawer({ payment: x, actions, onClose, jobBase }: { payment: PerDiemPayment; actions?: ReactNode; onClose: () => void; jobBase?: (job: string) => string }): JSX.Element {
  return (
    <RecordDrawer title={`Per Diem Payment ${x.id}`} subtitle="Paid to the traveller" actions={actions} onClose={onClose}>
      <FactsGrid
        columns={2}
        facts={[
          { label: "Job Number", value: <JobLink job={x.jobNumber} to={jobBase} /> },
          x.traveller && { label: "Traveller", value: <PersonTwo name={x.traveller.name} email={x.traveller.email} sub={x.traveller.email} /> },
          x.campaign && { label: "Campaign", value: <Two main={x.campaign.name} sub={x.campaign.id} /> },
          { label: "Payment Amount", value: money(x.amount, x.currency) },
          { label: "Converted Amount", value: money(x.convertedAmount, x.convertedCurrency) },
          { label: "Added", value: <Two main={fmtDate(x.addedDate)} sub={x.addedBy} /> },
          { label: "NetSuite Status", value: <NsStatusChip record={x} /> },
        ]}
      />
    </RecordDrawer>
  );
}
