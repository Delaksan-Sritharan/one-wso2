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
import { Box } from "@wso2/oxygen-ui";
import { n0 } from "../../../model/format";
import { HBars, Kpi, KpiRow, MonthColumns } from "../../dashboardParts";
import { Block } from "../parts";
import type { WidgetCtx } from "../types";

/** Travel: trips in progress, starting soon, and how travel has moved over the year. */
export default function TravelWidget({ ctx }: { ctx: WidgetCtx }): JSX.Element | null {
  const t = ctx.dashboard?.travel;
  if (!t) return null;
  return (
    <>
      <KpiRow>
        <Kpi label="Travels In Progress" value={n0(t.inProgress)} note="Travelling today" />
        <Kpi label="Starting in 30 Days" value={n0(t.startingIn30Days)} />
        <Kpi label="Completed This Month" value={n0(t.completedThisMonth)} />
        <Kpi label="Travels in 12 Months" value={n0(t.tripsIn12Months)} />
      </KpiRow>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 3, mt: 2.5 }}>
        <Block title="Top Destinations">
          <HBars rows={t.topDestinations} max={6} />
        </Block>
        <Block title="Travels by Travel Agent">
          <HBars rows={t.byTravelAgent} percent />
        </Block>
      </Box>
      <Box sx={{ mt: 2.5 }}>
        <Block title="Travels by Month">
          <MonthColumns rows={t.byMonth} name="Travels" />
        </Block>
      </Box>
    </>
  );
}
