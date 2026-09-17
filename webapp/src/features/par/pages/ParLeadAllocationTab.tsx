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

import { useState } from "react";
import type { ReactNode } from "react";
import {
  Alert,
  Box,
  Card,
  Chip,
  InputAdornment,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TextField,
  Typography,
  alpha,
  useTheme,
} from "@wso2/oxygen-ui";
import { SearchIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useMeProfile } from "@features/my/api/useMeProfile";
import { useActiveParCycle } from "../api/useParData";
import { useParSpecialRatingAllocations } from "../api/useSpecialRatingAllocation";
import { groupSpecialRatingAllocations, type ParSpecialRatingAllocationGroup } from "../util/parSpecialRatingAllocation";
import ParEmptyState from "../components/ParEmptyState";

// Splits `text` on a case-insensitive match of `term` and wraps each match in
// a highlight span. Ports SpecialRatingAllocationView.tsx's own
// highlightText — a fixed yellow regardless of theme (matching a
// find-in-page highlight rather than the app's own palette), with an
// explicit dark foreground so it stays legible in dark mode too.
function highlightText(text: string, term: string): ReactNode {
  if (!term.trim()) return text;
  const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, index) =>
    regex.test(part) ? (
      <Box key={index} component="mark" sx={{ bgcolor: "#ffeb3b", color: "#000", fontWeight: 700 }}>
        {part}
      </Box>
    ) : (
      part
    ),
  );
}

function AllocationGroupCard({
  group,
  searchQuery,
}: {
  group: ParSpecialRatingAllocationGroup;
  searchQuery: string;
}) {
  const theme = useTheme();
  // top5Quota === 1 && top20Quota === 0 is a special case: the pair of
  // quotas represents one combined slot, so the Top 20% chip displays "1"
  // too even though the underlying value is 0 — source's own quirk, purely
  // a display adjustment (the warning banner below explains it).
  const smallTeam = group.top5Quota === 1 && group.top20Quota === 0;
  const top20Display = smallTeam ? 1 : group.top20Quota;

  return (
    <Card variant="outlined" sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" } }}>
      <Box
        sx={{
          p: 2,
          bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "light" ? 0.12 : 0.28),
          width: { sm: 250 },
          minWidth: { sm: 250 },
        }}
      >
        <Stack spacing={2} alignItems="center">
          <Typography variant="h6" sx={{ textTransform: "capitalize", textAlign: "center", wordBreak: "break-word" }}>
            {group.quotaName}
          </Typography>
          <Chip label={`Top 5%: ${group.top5Quota}`} size="small" sx={{ width: "90%" }} />
          <Chip label={`Top 20%: ${top20Display}`} size="small" sx={{ width: "90%" }} />
        </Stack>
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        {smallTeam && (
          <Alert severity="warning">
            The total allocation for the top 5% and top 20% categories is 1 due to the small team size. This
            means only one team member can be placed in <b>either</b> the top 5% or the top 20%. The allocation
            appears as &ldquo;1&rdquo; for each category solely for system purposes; it does not mean you can
            allocate one person to each category. Once a slot is used for any of the categories, the overall
            quota is considered utilised
          </Alert>
        )}
        <Table size="small">
          <TableBody>
            {group.departments.map((dept, index) => (
              <TableRow
                key={`${dept.parQuotaId}-${dept.parDepartment}-${dept.parTeam}-${index}`}
                sx={{
                  "&:last-child td": { border: 0 },
                  bgcolor: dept.highlight ? alpha(theme.palette.warning.light, 0.3) : "transparent",
                }}
              >
                <TableCell sx={{ width: "30%" }}>
                  <Typography variant="body2" noWrap title={dept.parBusinessUnit}>
                    {highlightText(dept.parBusinessUnit, searchQuery.trim())}
                  </Typography>
                </TableCell>
                <TableCell sx={{ width: "35%" }}>
                  <Typography variant="body2" noWrap title={dept.parDepartment}>
                    {highlightText(dept.parDepartment, searchQuery.trim())}
                  </Typography>
                </TableCell>
                <TableCell sx={{ width: "35%" }}>
                  <Typography variant="body2" noWrap title={dept.parTeam}>
                    {highlightText(dept.parTeam, searchQuery.trim())}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Card>
  );
}

// People Ops → Performance → Lead Portal → Top 5%/20% Allocation: par-app's
// SpecialRatingAllocationView.tsx, lead view (isAdminView=false — the
// admin-view branch, which omits leadEmail to see every quota group, belongs
// with the Admin Portal, not here).
export default function ParLeadAllocationTab() {
  const profile = useMeProfile();
  const workEmail = profile.data?.userInfo.workEmail;
  const activeCycles = useActiveParCycle(workEmail);
  const cycle = activeCycles.data?.[0];
  const allocations = useParSpecialRatingAllocations(cycle?.parCycleId, workEmail);
  const [searchQuery, setSearchQuery] = useState("");

  if (activeCycles.isLoading || profile.isLoading) {
    return <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5 }} />;
  }
  if (profile.isError) {
    return (
      <ErrorNotice error={profile.error} onRetry={() => profile.refetch()} retrying={profile.isFetching}>
        Couldn't load your profile.
      </ErrorNotice>
    );
  }
  if (activeCycles.isError) {
    return (
      <ErrorNotice error={activeCycles.error} onRetry={() => activeCycles.refetch()} retrying={activeCycles.isFetching}>
        Couldn't load the current PAR cycle.
      </ErrorNotice>
    );
  }
  if (!cycle) {
    return <Alert severity="info">Currently there is no ongoing PAR cycle</Alert>;
  }
  if (allocations.isLoading) {
    return <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5 }} />;
  }
  if (allocations.isError) {
    return (
      <ErrorNotice error={allocations.error} onRetry={() => allocations.refetch()} retrying={allocations.isFetching}>
        Error occurred while retrieving quota allocations
      </ErrorNotice>
    );
  }

  const rows = allocations.data ?? [];
  if (rows.length === 0) {
    return (
      <ParEmptyState text="No special rating allocations found. Please ensure you have the necessary permissions to view this data." />
    );
  }

  // groupSpecialRatingAllocations keeps every group regardless of match —
  // it only flags which departments highlight. Source's own equivalent
  // useMemo has the same shape: every group and every row always renders,
  // searching only changes which rows highlight, nothing is ever hidden.
  const groups = groupSpecialRatingAllocations(rows, searchQuery);

  return (
    <Stack spacing={2}>
      <TextField
        fullWidth
        size="small"
        placeholder="Search by business unit, department or team..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon size={16} />
              </InputAdornment>
            ),
          },
        }}
      />

      {groups.map((group) => (
        <AllocationGroupCard key={group.quotaId} group={group} searchQuery={searchQuery} />
      ))}
    </Stack>
  );
}
