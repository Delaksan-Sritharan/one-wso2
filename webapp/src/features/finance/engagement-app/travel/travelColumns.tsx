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

import type { Column } from "../components/EaTable";
import type { TravelRequestSummary } from "../api/engagementTypes";
import { TravelStatusChip, Two, Mono } from "../components/StatusChips";
import { engagementName, fmtRange, place } from "../model/format";

/** The travel request columns: the engagement under the job number, the base location under the destination. */
export function travelColumns({ agent = false, traveller = true }: { agent?: boolean; traveller?: boolean } = {}): Column<TravelRequestSummary>[] {
  return [
    {
      key: "job",
      label: "Job Number",
      sortKey: "jobNumber",
      sortValue: (t) => t.jobNumber,
      width: "17%",
      render: (t) => (
        <Two
          main={<Mono>{t.jobNumber}</Mono>}
          sub={t.engagement ? engagementName(t.engagement) : t.campaign ? `Campaign: ${t.campaign.name}` : undefined}
        />
      ),
    },
    ...(traveller ? [{ key: "who", label: "Traveller", render: (t: TravelRequestSummary) => <Two main={t.traveller.name} sub={t.traveller.email} /> }] : []),
    { key: "dest", label: "Destination", sortKey: "destination", sortValue: (t) => place(t.country, t.city), render: (t) => <Two main={place(t.country, t.city)} sub={t.location} /> },
    { key: "dates", label: "Dates", sortKey: "startDate", sortValue: (t) => t.start, render: (t) => <span style={{ whiteSpace: "nowrap" }}>{fmtRange(t.start, t.end)}</span> },
    ...(agent ? [] : [{ key: "agent", label: "Travel Agent", sortKey: "agency", sortValue: (t: TravelRequestSummary) => t.travelAgent, render: (t: TravelRequestSummary) => t.travelAgent || "—" }]),
    { key: "visa", label: "Visa", render: (t) => t.visa || "—" },
    { key: "status", label: "Travel Status", sortKey: "status", sortValue: (t) => t.status, render: (t) => <TravelStatusChip status={t.status} /> },
  ];
}
