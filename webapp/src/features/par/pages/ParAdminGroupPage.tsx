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
import { Box, Stack, Typography } from "@wso2/oxygen-ui";
import { ShieldIcon } from "@wso2/oxygen-ui-icons-react";
import RoutedTabs, { type RoutedTabDef } from "@components/routed-tabs/RoutedTabs";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import ParShell from "../components/ParShell";
import { useParIsAdmin } from "../api/useParIsAdmin";

// Only Ongoing has a route so far — History is a follow-up.
const TABS: RoutedTabDef[] = [{ segment: "ongoing", label: "Ongoing" }];

export default function ParAdminGroupPage() {
  return (
    <ParShell>
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.5 }}>
        <ShieldIcon size={32} />
        <Typography variant="h4">Admin Portal</Typography>
      </Stack>
      <RoutedTabs basePath="/people-ops/performance/admin" tabs={TABS} ariaLabel="Admin Portal sections" />
      <Outlet />
    </ParShell>
  );
}

/** The index route of the group: sends an admin straight to Ongoing. */
export function ParAdminGroupIndex() {
  return <Navigate to="/people-ops/performance/admin/ongoing" replace />;
}

/** Guards the whole /people-ops/performance/admin subtree, same reasoning
 * as ParRequiresLeadRoute/ParRequiresTeamLeadRoute. */
export function ParRequiresAdminRoute({ children }: { children: ReactNode }) {
  const admin = useParIsAdmin();
  if (admin.isLoading) return null;
  if (admin.isError) {
    return (
      <Box sx={{ p: 2 }}>
        <ErrorNotice error={admin.error} onRetry={admin.retry}>
          Couldn't check whether you're a PAR admin.
        </ErrorNotice>
      </Box>
    );
  }
  if (!admin.isAdmin) return <Navigate to="/people-ops/performance" replace />;
  return <>{children}</>;
}
