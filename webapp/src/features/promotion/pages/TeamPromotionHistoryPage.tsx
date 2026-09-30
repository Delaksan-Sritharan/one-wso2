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

// Team Promotion History — ports promotion-app's own
// view/leadEmployeeHistory/leadEmployeeHistory.tsx ("Team Promotion
// History", route.ts: allowRoles: [Role.LEAD]). A separate top-level screen
// from the Lead Portal (lead.tsx, "Time Based Promotions") in source, kept
// separate here too rather than folded into it as a third tab.
import { Navigate, Outlet } from "react-router";
import { Box, Typography } from "@wso2/oxygen-ui";
import RoutedTabs, { type RoutedTabDef } from "@components/routed-tabs/RoutedTabs";

const BASE_PATH = "/people-ops/promotion/team-history";

const TABS: RoutedTabDef[] = [
  { segment: "direct-reports", label: "Direct Reportings" },
  { segment: "indirect-reports", label: "Indirect Reportings" },
];

export default function TeamPromotionHistoryPage() {
  return (
    <Box>
      <Typography component="h1" variant="h5" sx={{ mb: 0.5 }}>
        Team Promotion History
      </Typography>
      <RoutedTabs basePath={BASE_PATH} tabs={TABS} ariaLabel="Team promotion history" />
      <Outlet />
    </Box>
  );
}

/** The group's index route — sends straight to Direct Reportings, source's
 * own first/default tab. */
export function TeamPromotionHistoryIndex() {
  return <Navigate to={`${BASE_PATH}/direct-reports`} replace />;
}
