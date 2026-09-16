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

import type { ReactNode } from "react";
import { Navigate, Outlet } from "react-router";
import { Stack, Typography } from "@wso2/oxygen-ui";
import { UsersIcon } from "@wso2/oxygen-ui-icons-react";
import RoutedTabs, { type RoutedTabDef } from "@components/routed-tabs/RoutedTabs";
import { useMeProfile } from "@features/my/api/useMeProfile";
import ParShell from "../components/ParShell";
import { useParIsTeamLead } from "../api/useParData";

// Tab labels match par-app's own LeadPortal.tsx tab bar, in Title Case rather
// than its literal ALL-CAPS label strings — same normalization ParGroupPage
// already applies to the Employee Portal's tabs. Only tabs with a real route
// in App.tsx are listed here — ported one at a time, same as the Employee
// Portal — so the bar never links to a screen that isn't built yet.
const TABS: RoutedTabDef[] = [
  { segment: "direct-reports", label: "Direct Reports" },
  { segment: "allocation", label: "Top 5%20% Allocation" },
];

// One page frame for everything a lead does for their reports — mirrors
// ParGroupPage.tsx, one level down at /people-ops/performance/lead.
export default function ParLeadGroupPage() {
  return (
    <ParShell>
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.5 }}>
        <UsersIcon size={32} />
        <Typography variant="h4">Lead Portal</Typography>
      </Stack>
      <RoutedTabs basePath="/people-ops/performance/lead" tabs={TABS} ariaLabel="Lead Portal sections" />
      <Outlet />
    </ParShell>
  );
}

/** The index route of the group: sends a lead straight to Direct Reports. */
export function ParLeadGroupIndex() {
  return <Navigate to="/people-ops/performance/lead/direct-reports" replace />;
}

/** Guards the whole /people-ops/performance/lead subtree — par-app's own
 * Role.TEAM_LEAD gate on /lead-portal (route.ts). Hiding the nav item is not
 * access control; the route is what actually enforces it, same reasoning as
 * ParRequiresLeadRoute. */
export function ParRequiresTeamLeadRoute({ children }: { children: ReactNode }) {
  const profile = useMeProfile();
  const { isTeamLead, isLoading } = useParIsTeamLead(profile.data?.userInfo.workEmail);
  if (profile.isLoading || isLoading) return null;
  if (!isTeamLead) return <Navigate to="/people-ops/performance" replace />;
  return <>{children}</>;
}
