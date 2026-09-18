/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { Box, LinearProgress, Stack, Typography } from "@wso2/oxygen-ui";
import { money } from "../../util/financeFormat";
import { spentPercent } from "./opdNewClaim";
import type { OpdClaimSummary } from "../opdTypes";

/**
 * How much of the year's allowance is left.
 *
 * `components/top-sticky-bars/ClaimOverviewer.tsx:113-170` — the figures on one
 * line over a bar that says how full the year is. The source pins it to the
 * bottom of the viewport; here it sits under the claim, because One WSO2's
 * shell already owns the bottom edge (the app footer lives there) and a second
 * fixed bar would stack on it.
 */
export function OpdBalanceBar({ summary }: { summary: OpdClaimSummary }) {
  const percent = spentPercent(summary.totalClaimedAmount, summary.totalClaimLimit);
  const spentLabel = `Spent ${money(summary.totalClaimedAmount)} of ${money(
    summary.totalClaimLimit,
  )}`;

  return (
    // `flexShrink: 0` — the screen is a flex column, and the bar must keep its
    // height while the bill list above it absorbs the change.
    <Box sx={{ mt: 2, flexShrink: 0 }}>
      <Stack
        direction="row"
        spacing={1}
        justifyContent="center"
        flexWrap="wrap"
        sx={{ rowGap: 0.5 }}
      >
        <Figure label="Remaining:" value={money(summary.totalRemaining)} tone="success.main" />
        <Typography sx={{ fontSize: 13, color: "text.secondary" }}>|</Typography>
        <Figure label="Claimed:" value={money(summary.totalClaimedAmount)} tone="error.main" />
      </Stack>

      <LinearProgress
        variant="determinate"
        value={percent}
        // The bar repeats what the figures above already say, so it is hidden
        // from screen readers rather than announced as a second, vaguer copy
        // of them. The caption below carries the same fact in words.
        aria-hidden="true"
        sx={{ mt: 1, height: 6, borderRadius: 3 }}
      />

      <Typography sx={{ fontSize: 12, color: "text.secondary", textAlign: "center", mt: 0.75 }}>
        {spentLabel}
      </Typography>
    </Box>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="baseline">
      <Typography sx={{ fontSize: 13, color: "text.secondary" }}>{label}</Typography>
      <Typography
        sx={{ fontSize: 13.5, fontWeight: 700, color: tone, fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </Typography>
    </Stack>
  );
}
