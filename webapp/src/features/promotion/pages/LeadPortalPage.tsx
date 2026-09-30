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

// The Lead Portal — ports promotion-app's own lead.tsx ("Time Based
// Promotions", route.ts: allowRoles: [Role.LEAD]). Two tabs, matching
// source's own tab bar exactly: Pending Requests (panels/recommendationList.tsx)
// and History (panels/recommendationHistory.tsx). Lives under People Ops —
// reviewing/deciding on other people's promotions is People-Ops-team work,
// the same split PAR's own Lead Portal already applies.
import { Navigate, Outlet } from "react-router";
import { Box, Typography } from "@wso2/oxygen-ui";
import RoutedTabs, { type RoutedTabDef } from "@components/routed-tabs/RoutedTabs";

const BASE_PATH = "/people-ops/promotion/lead";

const TABS: RoutedTabDef[] = [
  { segment: "pending", label: "Pending Requests" },
  { segment: "history", label: "History" },
];

export default function LeadPortalPage() {
  return (
    <Box>
      <Typography component="h1" variant="h5" sx={{ mb: 0.5 }}>
        Time Based Promotions
      </Typography>
      <RoutedTabs basePath={BASE_PATH} tabs={TABS} ariaLabel="Time based promotions" />
      <Outlet />
    </Box>
  );
}

/** The group's index route — sends straight to Pending Requests, source's
 * own first/default tab. */
export function LeadPortalIndex() {
  return <Navigate to={`${BASE_PATH}/pending`} replace />;
}
