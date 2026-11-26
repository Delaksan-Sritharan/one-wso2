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
import { localIsoDate } from "@utils/localDate";
import type { Dashboard } from "../api/engagementTypes";
import EaPage from "../components/EaPage";
import { TravelStatusChip, Mono } from "../components/StatusChips";
import { engagementPaths } from "../engagementPaths";
import { fmtDate, fmtRange, place } from "../model/format";
import { DateRow, HBars, Mini, MonthColumns, QueueTiles, Section, ViewAll } from "./dashboardParts";

/** Two-column panels; an odd last one spans the row. */
function Panels({ children }: { children: ReactNode[] }): JSX.Element | null {
  if (!children.length) return null;
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 2, alignItems: "stretch", "& > :last-of-type:nth-of-type(odd)": { gridColumn: "1 / -1" } }}>
      {children}
    </Box>
  );
}

/** The travel agent's dashboard: only the agency's own travel requests, and invoices. */
export default function AgentDashboard({ d }: { d: Dashboard }): JSX.Element {
  const a = d.agency!;
  const tiles = [
    { key: "open", count: a.inProgress, label: "Assigned and In Progress", to: engagementPaths.travelRequests("in-progress"), hot: false, hint: "Your agency's requests that are In Progress, Extended or On Hold" },
    { key: "7", count: a.startingIn7Days, label: "Starting in 7 Days", to: engagementPaths.travelRequests("in-progress"), hot: a.startingIn7Days > 0, hint: "Travels that start this week" },
    {
      key: "noinv",
      count: a.completedWithoutInvoice,
      label: "Completed Without an Invoice",
      to: engagementPaths.travelRequests("completed"),
      hot: a.completedWithoutInvoice > 0,
      hint: "Completed travels with no invoice from your agency yet",
    },
    { key: "rej", count: a.invoicesRejected, label: "Invoices Rejected", to: engagementPaths.travelRequests("all"), hot: a.invoicesRejected > 0, hint: "Rejected by travel or finance" },
  ];
  const panels = [
    a.upcoming.length ? (
      <Mini key="upcoming" title="Upcoming Travels" aside={a.upcomingTotal > 5 ? <ViewAll to={engagementPaths.travelRequests("in-progress")} /> : undefined}>
        {a.upcoming.slice(0, 5).map((x) => (
          <DateRow
            key={x.jobNumber}
            date={x.start}
            title={x.traveller.name}
            lines={[`${place(x.country, x.city)}, ${fmtRange(x.start, x.end)}`]}
            right={
              <>
                {x.status ? <TravelStatusChip status={x.status} /> : null}
                <Mono>{x.jobNumber}</Mono>
              </>
            }
            to={engagementPaths.travelRequest(x.jobNumber)}
          />
        ))}
      </Mini>
    ) : null,
    a.invoicesByStatus.length ? (
      <Mini key="invoices" title="Invoices by Status">
        <HBars rows={a.invoicesByStatus} />
      </Mini>
    ) : null,
    a.tripsByMonth.some((m) => m.value) ? (
      <Mini key="months" title="Travels by Month">
        <MonthColumns rows={a.tripsByMonth} name="Travels" />
      </Mini>
    ) : null,
  ].filter(Boolean);
  return (
    <EaPage title="Dashboard" subtitle={`Travels handled by ${a.name} on ${fmtDate(d.date ?? localIsoDate())}.`}>
      <Section title="At a Glance">
        <QueueTiles tiles={tiles} />
      </Section>
      <Panels>{panels}</Panels>
    </EaPage>
  );
}
