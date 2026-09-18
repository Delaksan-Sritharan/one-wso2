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


import { useMemo, useState } from "react";
import { Alert, Box, Skeleton, Stack, Typography } from "@wso2/oxygen-ui";
import { isOpdBackendConfigured } from "@config/apiConfig";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { FINANCE_EYEBROW } from "@constants/financeApps";
import FinanceShell from "../../components/FinanceShell";
import { OpdHistoryFilters } from "./OpdHistoryFilters";
import { OpdHistoryTable } from "./OpdHistoryTable";
import { OpdHistoryClaimDetails } from "./OpdHistoryClaimDetails";
import { OpdClaimActivityDrawer } from "./OpdClaimActivityDrawer";
import { useOpdClaims, useOpdUserInfo } from "../useOpd";
import { OPD_ROLE, opdHasRole, type OpdClaim } from "../opdTypes";
import {
  emptyOpdHistoryFilters,
  hasActiveOpdFilters,
  toOpdSearchPayload,
  type OpdHistoryFilters as Filters,
} from "./opdHistoryTypes";

export default function OpdClaimHistoryScreen() {
  return (
    <FinanceShell
      eyebrow={FINANCE_EYEBROW.opd}
      title="Claim history"
      subtitle="OPD claims you have submitted, and where each one has got to."
      configured={isOpdBackendConfigured()}
      configKey="ONE_WSO2_OPD_BACKEND_URL"
      // The details panel pins its total to the bottom of the page, which it
      // can only do if the screen is given the height that is left rather than
      // growing to fit its content.
      fill
    >
      <HistoryBody />
    </FinanceShell>
  );
}

function HistoryBody() {
  const userInfo = useOpdUserInfo();
  const [filters, setFilters] = useState<Filters>(() => emptyOpdHistoryFilters());
  // The claim being read in full — the details take over the page, the way the
  // source slides them over the list.
  const [selected, setSelected] = useState<OpdClaim | null>(null);
  // Independent of `selected`: the trail opens straight from a row's status
  // chip without going through the details first.
  const [activityClaim, setActivityClaim] = useState<OpdClaim | null>(null);

  const email = userInfo.data?.workEmail;
  const payload = useMemo(() => toOpdSearchPayload(filters, email), [filters, email]);
  // Gated on the role as well as the email. `useOpdClaims` checks sign-in,
  // config and identity but knows nothing about OPD's roles, so once user-info
  // landed a non-submitter's visit fired a POST /search-claims the backend was
  // always going to refuse — before the alert below had a chance to render.
  const canViewClaims =
    !userInfo.isLoading &&
    !userInfo.isError &&
    Boolean(email) &&
    opdHasRole(userInfo.data, OPD_ROLE.CLAIM_SUBMITTER);
  const claims = useOpdClaims(payload, canViewClaims);

  // The OPD backend refuses the whole app to anyone holding neither of its
  // roles, so the submitter check is what tells an ineligible account why the
  // screen is empty rather than leaving them with a bare "no claims".
  //
  // `isError` is excluded deliberately. A failed lookup leaves `data`
  // undefined, and `opdHasRole` reads that as "no role" — so without this the
  // screen would tell someone their account is ineligible when all that
  // happened is a request failed, and offer them no way to retry. A confirmed
  // refusal still lands here, because a successful load is not an error.
  if (!userInfo.isLoading && !userInfo.isError && !opdHasRole(userInfo.data, OPD_ROLE.CLAIM_SUBMITTER)) {
    return (
      <Alert severity="info">
        OPD claims aren&apos;t available for your account (they&apos;re limited to permanent
        employees at eligible locations).
      </Alert>
    );
  }

  if (selected) {
    return (
      <>
        <OpdHistoryClaimDetails
          claim={selected}
          onBack={() => setSelected(null)}
          onShowActivity={() => setActivityClaim(selected)}
        />
        <OpdClaimActivityDrawer claim={activityClaim} onClose={() => setActivityClaim(null)} />
      </>
    );
  }

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <OpdHistoryFilters filters={filters} onChange={setFilters} />

      {userInfo.isLoading || claims.isLoading ? (
        <Stack spacing={1}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rectangular" height={48} sx={{ borderRadius: 1 }} />
          ))}
        </Stack>
      ) : userInfo.isError || claims.isError ? (
        <ErrorNotice
          error={userInfo.error ?? claims.error}
          // Retry whichever query actually failed: the claims search is
          // disabled until an email arrives, so retrying it alone would leave
          // a user-info failure permanently on screen with nothing to re-run.
          onRetry={() => {
            if (userInfo.isError) void userInfo.refetch();
            if (claims.isError) void claims.refetch();
          }}
          retrying={userInfo.isFetching || claims.isFetching}
        >
          Couldn&apos;t load your claims.
        </ErrorNotice>
      ) : (claims.data?.length ?? 0) === 0 ? (
        <Typography sx={{ fontSize: 13, color: "text.secondary", py: 3 }}>
          {hasActiveOpdFilters(filters)
            ? "No claims match these filters."
            : "You haven't submitted an OPD claim yet."}
        </Typography>
      ) : (
        <OpdHistoryTable
          claims={claims.data!}
          onView={setSelected}
          onShowActivity={setActivityClaim}
        />
      )}

      <OpdClaimActivityDrawer claim={activityClaim} onClose={() => setActivityClaim(null)} />
    </Box>
  );
}
