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
import {
  Avatar,
  Box,
  Breadcrumbs,
  Card,
  Chip,
  DataGrid,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  Link,
  Skeleton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  EyeIcon,
  SearchIcon,
  UsersRoundIcon,
} from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { describeError } from "@api/errors";
import { useMeProfile } from "@features/my/api/useMeProfile";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useParLeadEmployees } from "../api/useLeadHistory";
import { filterHistoryChainEmployees } from "../util/parHistoryChain";
import ParEmployeeHistoryView from "../components/ParEmployeeHistoryView";
import type { ParEmployee } from "../api/types";

interface BreadcrumbEntry {
  email: string;
  name: string;
}

interface HistoryEmployee extends BreadcrumbEntry {
  thumbnail?: string;
}

// People Ops → Performance → Lead Portal → History Chain: par-app's
// ChainViewTab.tsx (see docs/ported-apps/par-app.md §8.6). Browses the
// caller's own org chart (GET /employees?leadEmail=, not cycle-scoped),
// unlike Report Chain's own cycle-scoped drill-down. "View Subordinates"
// simplifies source's isLead + manager-set check to just isLead, same as
// Report Chain's own gate. "View PAR History" swaps in
// ParEmployeeHistoryView inline, matching source exactly (no modal, unlike
// Review.tsx's own "PAR HISTORY" button — see ParLeadHistoryModal.tsx).
export default function ParLeadHistoryChainTab() {
  const profile = useMeProfile();
  const workEmail = profile.data?.userInfo.workEmail;
  const myName = profile.data
    ? `${profile.data.userInfo.firstName} ${profile.data.userInfo.lastName}`
    : "My Team";

  const [history, setHistory] = useState<BreadcrumbEntry[]>([]);
  const currentEmail = history.length > 0 ? history[history.length - 1].email : workEmail;
  const reports = useParLeadEmployees(currentEmail);
  const { showSuccess, showError } = useNotifications();

  const [searchQuery, setSearchQuery] = useState("");
  const [showLeadsOnly, setShowLeadsOnly] = useState(false);
  const [historyEmployee, setHistoryEmployee] = useState<HistoryEmployee | undefined>(undefined);

  if (profile.isLoading || reports.isLoading) {
    return <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 1.5 }} />;
  }
  if (profile.isError) {
    return (
      <ErrorNotice error={profile.error} onRetry={() => profile.refetch()} retrying={profile.isFetching}>
        Couldn't load your profile.
      </ErrorNotice>
    );
  }
  if (reports.isError) {
    return (
      <ErrorNotice error={reports.error} onRetry={() => reports.refetch()} retrying={reports.isFetching}>
        Couldn't load this level of your org chart.
      </ErrorNotice>
    );
  }

  if (historyEmployee) {
    return (
      <Stack spacing={1.5}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={1}>
            <IconButton aria-label="back" color="primary" onClick={() => setHistoryEmployee(undefined)}>
              <ArrowLeftIcon size={18} />
            </IconButton>
            <Chip
              label={historyEmployee.name}
              avatar={
                <Avatar src={historyEmployee.thumbnail} slotProps={{ img: { referrerPolicy: "no-referrer" } }} />
              }
            />
          </Stack>
          <Divider sx={{ mt: 1.5 }} />
        </Box>
        <ParEmployeeHistoryView employeeEmail={historyEmployee.email} employeeName={historyEmployee.name} />
      </Stack>
    );
  }

  const openSubordinates = (row: ParEmployee) => {
    setHistory((prev) => [...prev, { email: row.workEmail, name: row.employeeName }]);
    setShowLeadsOnly(false);
    setSearchQuery("");
  };

  const navigateTo = (index: number) => {
    // index === -1 is the caller's own root, back to their own name.
    setHistory((prev) => (index < 0 ? [] : prev.slice(0, index + 1)));
  };

  const rows = filterHistoryChainEmployees(reports.data ?? [], searchQuery, showLeadsOnly);

  const columns: DataGrid.GridColDef<ParEmployee>[] = [
    {
      field: "employeeName",
      headerName: "Team Member",
      flex: 1.5,
      renderCell: (params) => (
        <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
          <Avatar
            src={params.row.employeeThumbnail || undefined}
            slotProps={{ img: { referrerPolicy: "no-referrer" } }}
            sx={{ mr: 1.5, height: "2.2rem", width: "2.2rem" }}
          />
          <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {params.row.employeeName}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                {params.row.workEmail}
              </Typography>
              <Tooltip title="Copy Email" arrow>
                <IconButton
                  size="small"
                  aria-label="Copy Email"
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      await navigator.clipboard.writeText(params.row.workEmail);
                      showSuccess("Email copied");
                    } catch (err) {
                      showError(describeError(err));
                    }
                  }}
                >
                  <CopyIcon size={13} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Box>
      ),
    },
    {
      field: "actions",
      headerName: "",
      sortable: false,
      flex: 0.6,
      renderCell: (params) => (
        <Stack direction="row">
          <Tooltip title="View PAR History" arrow>
            <IconButton
              onClick={() =>
                setHistoryEmployee({
                  email: params.row.workEmail,
                  name: params.row.employeeName,
                  thumbnail: params.row.employeeThumbnail,
                })
              }
            >
              <EyeIcon size={18} />
            </IconButton>
          </Tooltip>
          {params.row.isLead === true && (
            <Tooltip title={`View ${params.row.employeeName}'s Subordinates`} arrow>
              <IconButton onClick={() => openSubordinates(params.row)}>
                <UsersRoundIcon size={18} />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      ),
    },
  ];

  return (
    <Stack spacing={2}>
      <Box sx={{ display: "flex", alignItems: "center" }}>
        {history.length > 0 && (
          <Tooltip title="Go Back" arrow>
            <IconButton onClick={() => navigateTo(history.length - 2)} sx={{ mr: 1 }} aria-label="Go Back">
              <ArrowLeftIcon size={18} />
            </IconButton>
          </Tooltip>
        )}
        <Breadcrumbs separator={<ChevronRightIcon size={14} />}>
          <Link
            component="button"
            underline={history.length === 0 ? "none" : "hover"}
            color={history.length === 0 ? "text.primary" : "primary"}
            onClick={() => navigateTo(-1)}
          >
            {myName}
          </Link>
          {history.map((entry, index) => (
            <Link
              key={entry.email}
              component="button"
              underline={index === history.length - 1 ? "none" : "hover"}
              color={index === history.length - 1 ? "text.primary" : "primary"}
              onClick={() => navigateTo(index)}
            >
              {entry.name}
            </Link>
          ))}
        </Breadcrumbs>
      </Box>

      <Grid container spacing={2} sx={{ alignItems: "center" }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search by name or email..."
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
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <FormControlLabel
              control={<Switch checked={showLeadsOnly} onChange={(e) => setShowLeadsOnly(e.target.checked)} />}
              label="Show Leads Only"
            />
          </Box>
        </Grid>
      </Grid>

      <Card variant="outlined" sx={{ p: 2 }}>
        <DataGrid.DataGrid
          rows={rows}
          columns={columns}
          getRowId={(row) => row.workEmail}
          rowHeight={56}
          disableRowSelectionOnClick
          sx={{ border: "none" }}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          pageSizeOptions={[10, 20, 25]}
        />
      </Card>
    </Stack>
  );
}
