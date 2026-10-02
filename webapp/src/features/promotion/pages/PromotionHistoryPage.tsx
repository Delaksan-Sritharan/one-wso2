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

// Standalone /me/promotion — an employee's own full promotion history,
// restricted to the EMPLOYEE role.
//
// Promotion History shows a page title, summary statistics, and a timeline.
// A tab strip is unnecessary because this page has no sibling views.
//
// This is the fuller, dedicated view of an employee's promotion record. It
// reads the same two endpoints as the My-page profile card's "Last
// promotion" line + history dialog (features/my/components/
// ConnectedServices.tsx, PromotionHistoryDialog.tsx), which stays as its
// own, separately-designed summary widget rather than being replaced by
// this page.
import type { ReactNode } from "react";
import { Alert, Box, Paper, Skeleton, Stack, Typography } from "@wso2/oxygen-ui";
import { useUserInfo } from "@api/useUserInfo";
import { useAsgardeoUser } from "@hooks/useAsgardeoUser";
import { humanizeHttpError } from "@api/http";
import { isPromotionBackendConfigured, usePromotionEmployeeInfo } from "../api/usePromotionEmployeeInfo";
import { usePromotionHistory } from "../api/usePromotionHistory";
import PromotionTimeline from "../components/PromotionTimeline";
import { formatDate, latestPromotion, sortPromotionsByBand } from "../util/promotionHistory";
import type { PromotionEmployeeInfoWithLead, PromotionHistoryEntry } from "../api/types";

// Whole months between a plain "YYYY-MM-DD"-ish date and today — enough
// precision for "time in band", not a general-purpose duration util.
function monthsSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const then = new Date(dateStr);
  if (Number.isNaN(then.getTime())) return null;
  const now = new Date();
  let months = (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth());
  if (now.getDate() < then.getDate()) months -= 1;
  return Math.max(0, months);
}

function formatDuration(months: number): ReactNode {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return <>{months}<Typography component="span" variant="body2" sx={{ ml: 0.5 }}>mo</Typography></>;
  return (
    <>
      {years}<Typography component="span" variant="body2" sx={{ ml: 0.5, mr: rest ? 1 : 0 }}>yr</Typography>
      {rest > 0 && <>{rest}<Typography component="span" variant="body2" sx={{ ml: 0.5 }}>mo</Typography></>}
    </>
  );
}

// A small stat row above the timeline — without it, someone with only one
// or two entries (or none at all) sees a single lonely row on an otherwise
// empty page. Gives every record, however short, something substantial at
// the top regardless of how many promotions it holds.
function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  accent?: string;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2.25, flex: 1, minWidth: { xs: 140, sm: 160 } }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}
      >
        {label}
      </Typography>
      <Typography variant="h4" fontWeight={700} sx={{ mt: 0.25, color: accent ?? "text.primary" }}>
        {value}
      </Typography>
      {sub && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
          {sub}
        </Typography>
      )}
    </Paper>
  );
}

function PromotionStats({
  employeeInfo,
  requests,
}: {
  employeeInfo: PromotionEmployeeInfoWithLead;
  requests: PromotionHistoryEntry[];
}) {
  const sorted = sortPromotionsByBand(requests);
  const latest = latestPromotion(requests);
  const specialCount = requests.filter((r) => r.promotionType === "SPECIAL").length;
  // The band held before any promotion on record — same fallback
  // PromotionTimeline's own "Joined" node uses.
  const joinedBand = sorted.length > 0 ? sorted[sorted.length - 1].currentJobBand : employeeInfo.jobBand;
  const monthsInBand = monthsSince(latest ? employeeInfo.lastPromotedDate : employeeInfo.startDate);

  return (
    <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
      <StatCard
        label="Current Band"
        value={`JB${employeeInfo.jobBand ?? "—"}`}
        sub={latest ? `since ${latest.promotionCycle}` : "since joining"}
        accent="primary.main"
      />
      <StatCard
        label="Promotions"
        value={requests.length}
        sub={specialCount > 0 ? `${specialCount} special` : undefined}
      />
      <StatCard
        label="Time in Band"
        value={monthsInBand !== null ? formatDuration(monthsInBand) : "—"}
        sub={latest ? "since last move" : "since joining"}
      />
      <StatCard label="Joined At" value={`JB${joinedBand ?? "—"}`} sub={formatDate(employeeInfo.startDate)} />
    </Stack>
  );
}

export default function PromotionHistoryPage() {
  const userInfo = useUserInfo();
  const asgardeoUser = useAsgardeoUser();
  // Same email-resolution order as the profile card: /user-info's workEmail
  // is canonical, falling back to the id_token email claim while it loads.
  const workEmail = userInfo.data?.workEmail ?? asgardeoUser.email;

  const configured = isPromotionBackendConfigured();
  const info = usePromotionEmployeeInfo(workEmail);
  const history = usePromotionHistory(workEmail, true);

  return (
    <Box>
      <Typography component="h1" variant="h5" sx={{ mb: 0.5 }}>
        Promotion History
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Every promotion you've been approved for, from the job band you joined at to where you are today.
      </Typography>

      {!configured ? (
        <Alert severity="info">
          This app isn&apos;t connected yet. Set <code>ONE_WSO2_PROMOTION_BACKEND_URL</code> in{" "}
          <code>public/config.js</code> and reload.
        </Alert>
      ) : info.isPending || history.isPending ? (
        // isPending, not isLoading: both queries stay `enabled: false` until
        // workEmail resolves, and isLoading (isPending && isFetching) reads
        // false during that window — see OrgChartPage.tsx's own comment on
        // this exact gap. Without this the page would render blank for a
        // beat on load instead of the skeleton below.
        <Box>
          <Skeleton variant="rectangular" height={72} sx={{ borderRadius: 1, mb: 2 }} />
          <Skeleton variant="rectangular" height={72} sx={{ borderRadius: 1 }} />
        </Box>
      ) : info.isError ? (
        <Alert severity="error">Couldn&apos;t load your employee record. {humanizeHttpError(info.error)}</Alert>
      ) : history.isError ? (
        <Alert severity="error">Couldn&apos;t load your promotion history. {humanizeHttpError(history.error)}</Alert>
      ) : info.data ? (
        <>
          <PromotionStats
            employeeInfo={info.data.employeeInfo}
            requests={history.data?.promotionRequests ?? []}
          />
          <PromotionTimeline
            employeeInfo={info.data.employeeInfo}
            requests={history.data?.promotionRequests ?? []}
          />
        </>
      ) : null}
    </Box>
  );
}
