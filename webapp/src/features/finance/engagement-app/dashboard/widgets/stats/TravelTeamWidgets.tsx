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

import type { JSX } from "react";
import { n0, plural } from "../../../model/format";
import { HBars, Kpi, KpiRow } from "../../dashboardParts";
import type { WidgetCtx } from "../types";

const team = (ctx: WidgetCtx) => ctx.dashboard?.travelTeam;


/** Travel Team at a Glance: who is away, trips that ended without being completed, and the PO queue. */
export function TravelTeamGlanceWidget({ ctx }: { ctx: WidgetCtx }): JSX.Element | null {
  const t = team(ctx);
  if (!t?.awayThisWeek || t.endedNotCompleted === undefined || !t.poQueue) return null;
  return (
    <KpiRow>
      <Kpi label="Away This Week" value={n0(t.awayThisWeek.travellers)} note={`${plural(t.awayThisWeek.countries, "country", "countries")}`} />
      <Kpi label="Ended, Not Completed" value={n0(t.endedNotCompleted)} note="Ended 3 to 90 days ago" />
      <Kpi label="Invoices Awaiting PO Approval" value={n0(t.poQueue.count)} note={t.poQueue.count ? `Oldest ${plural(t.poQueue.oldestDays, "day")}` : "Nothing waiting"} />
    </KpiRow>
  );
}

/** Invoices awaiting PO approval, by how long they have waited. The order is the age order, not the size. */
export function PoAgeWidget({ ctx }: { ctx: WidgetCtx }): JSX.Element | null {
  const t = team(ctx);
  if (!t?.poQueue?.byAge) return null;
  return <HBars rows={t.poQueue?.byAge ?? []} sort={false} max={4} />;
}

/** Frequent travellers: trips started in the last 12 months. */
export function FrequentTravellersWidget({ ctx }: { ctx: WidgetCtx }): JSX.Element | null {
  const t = team(ctx);
  if (!t?.frequentTravellers) return null;
  return <HBars rows={t.frequentTravellers.map((f) => ({ label: f.traveller.name, count: f.trips }))} format={(n) => plural(n, "travel")} />;
}

/** Trips under way or starting within 60 days, by travel agent. */
export function AgentWorkloadWidget({ ctx }: { ctx: WidgetCtx }): JSX.Element | null {
  const t = team(ctx);
  if (!t?.agentWorkload) return null;
  return <HBars rows={t.agentWorkload} max={5} />;
}

