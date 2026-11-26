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
import { Typography } from "@wso2/oxygen-ui";
import type { CostBucket } from "../../../api/dashboardTypes";
import EaTable, { type Column } from "../../../components/EaTable";
import { n0, usdShort } from "../../../model/format";
import { Change, HBars } from "../../dashboardParts";
import type { WidgetCtx } from "../../widgets/types";
import { costBuckets, type CostDimension } from "../../widgets/rules";
import { deltaCell, deltaText, deltaTone, usd2 } from "../costFormat";
import { DRILL_KEY } from "../costView";

/** The bars, or their Tables twin; a click on a bar or a row filters every cost widget by it. */
export function CostBars({ ctx, dimension, firstColumn, withTrips = false }: { ctx: WidgetCtx; dimension: CostDimension & keyof typeof DRILL_KEY; firstColumn: string; withTrips?: boolean }): JSX.Element | null {
  const data = ctx.cost.query.data;
  if (!data) return null;
  const compared = Boolean(data.compare);
  const buckets = costBuckets(dimension, data);
  const filterKey = DRILL_KEY[dimension];
  const pick = (key: string) => ctx.cost.drill(filterKey, key);

  if (ctx.cost.view.mode === "tables") {
    const columns: Column<CostBucket>[] = [
      { key: "label", label: firstColumn, render: (b) => b.label },
      { key: "value", label: "This Period", align: "right", render: (b) => usd2(b.value) },
      ...(compared
        ? [
            { key: "previous", label: "Last Year", align: "right", render: (b: CostBucket) => (b.previous === undefined ? "—" : usd2(b.previous)) } as Column<CostBucket>,
            { key: "change", label: "Change", align: "right", render: (b: CostBucket) => <Change text={deltaCell(b, true)} tone={deltaTone(b, true, "spend")} /> } as Column<CostBucket>,
          ]
        : []),
      ...(withTrips
        ? [
            { key: "trips", label: "Travels", align: "right", render: (b: CostBucket) => (b.trips === undefined ? "—" : n0(b.trips)) } as Column<CostBucket>,
            { key: "avg", label: "Average per Trip", align: "right", render: (b: CostBucket) => (b.averagePerTrip === undefined ? "—" : usd2(b.averagePerTrip)) } as Column<CostBucket>,
          ]
        : []),
      { key: "share", label: "Share", align: "right", render: (b) => `${n0(b.percent)}%` },
    ];
    return (
      <EaTable
        ariaLabel={`Travel cost by ${firstColumn.toLowerCase()}`}
        columns={columns}
        rows={buckets}
        rowKey={(b) => b.key || b.label}
        onRowClick={(b) => pick(b.key)}
        canOpen={(b) => Boolean(b.key)}
        empty={null}
        bare

      />
    );
  }

  const rows = buckets.map((b) => ({
    label: b.label,
    count: b.value,
    key: b.key || undefined,
    hint: [b.previous !== undefined ? `Last year ${usd2(b.previous)}` : undefined, deltaText(b, compared), withTrips && b.trips !== undefined ? `${n0(b.trips)} trips, ${usd2(b.averagePerTrip ?? 0)} per trip` : undefined]
      .filter(Boolean)
      .join(". "),
  }));
  return <HBars rows={rows} format={usdShort} percent max={12} sort={false} onSelect={pick} />;
}

export const SourceBars = ({ ctx }: { ctx: WidgetCtx }): JSX.Element | null => <CostBars ctx={ctx} dimension="source" firstColumn="Source" />;
export const CountryBars = ({ ctx }: { ctx: WidgetCtx }): JSX.Element | null => <CostBars ctx={ctx} dimension="country" firstColumn="Destination Country" />;
export const CustomerBars = ({ ctx }: { ctx: WidgetCtx }): JSX.Element | null => <CostBars ctx={ctx} dimension="customer" firstColumn="Customer" withTrips />;

/** Spend by Travel App cost type. Card and Claim have no category yet, and the widget says so. */
export function CostTypeBars({ ctx }: { ctx: WidgetCtx }): JSX.Element {
  return (
    <>
      <CostBars ctx={ctx} dimension="costType" firstColumn="Cost Type" />
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
        Card and Claim are not categorised yet.
      </Typography>
    </>
  );
}

/** Paid and Non-Paid engagements, with the Paid share and what Unknown means. */
export function PaidBars({ ctx }: { ctx: WidgetCtx }): JSX.Element {
  const share = ctx.cost.query.data?.paidSharePercent;
  return (
    <>
      {share !== undefined ? (
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          <b>{share.toLocaleString("en-US", { maximumFractionDigits: 1 })}%</b> of the spend on Paid and Non-Paid engagements is Paid
        </Typography>
      ) : null}
      <CostBars ctx={ctx} dimension="paid" firstColumn="Engagement" />
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
        Unknown: lines without a trip.
      </Typography>
    </>
  );
}

/** Travel Agent Comparison: spend, trips and the average per trip, by agent. */
export function AgentBars({ ctx }: { ctx: WidgetCtx }): JSX.Element {
  return <CostBars ctx={ctx} dimension="travelAgent" firstColumn="Travel Agent" withTrips />;
}
