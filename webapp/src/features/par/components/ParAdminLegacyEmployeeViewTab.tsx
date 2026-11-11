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

import { useMemo } from "react";
import { Avatar, Box, DataGrid, IconButton, InputAdornment, Stack, TextField, Tooltip, Typography } from "@wso2/oxygen-ui";
import { EyeIcon, SearchIcon } from "@wso2/oxygen-ui-icons-react";
import { isLegacyEmployeeParDone, isLegacyLeadFeedbackDone, legacyEmployeeName, legacyOverallRating, rankSearchMatches } from "../util/parAdminHistory";
import ParStatusChip from "./ParStatusChip";
import { ParGridToolbar } from "./parGridToolbar";
import type { ParLegacyHistory } from "../api/types";

// Same chip as the team roster, so both legacy grids label it alike.
function DoneChip({ done }: { done: boolean }) {
  return <ParStatusChip content={done ? "COMPLETED" : "Not Done"} />;
}

// Legacy counterpart of ParOrgEmployeeViewTab: every participant in the
// legacy cycle, org-wide. Rows are the cycle's summary-mode records, so the
// eye action opens the full record through the parent's drill-down.
export default function ParAdminLegacyEmployeeViewTab({
  records,
  searchText,
  onSearchTextChange,
  paginationModel,
  onPaginationModelChange,
  sortModel,
  onSortModelChange,
  thumbnailFor,
  onOpenRecord,
}: {
  records: ParLegacyHistory[];
  // Owned by ParAdminLegacyCycleView: this tab unmounts while a record is
  // open, so local state would lose the search, page and sort on the way back.
  searchText: string;
  onSearchTextChange: (value: string) => void;
  paginationModel: DataGrid.GridPaginationModel;
  onPaginationModelChange: (model: DataGrid.GridPaginationModel) => void;
  sortModel: DataGrid.GridSortModel;
  onSortModelChange: (model: DataGrid.GridSortModel) => void;
  thumbnailFor: (email: string) => string | undefined;
  onOpenRecord: (record: ParLegacyHistory) => void;
}) {
  // Searching a name also matches every row that person leads, so matches
  // are ranked: employee name, then email, then lead, then department. The
  // sort is stable, so the cycle's own order holds within each rank, and a
  // column sort the admin picks still takes over.
  const filteredRows = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    if (!term) return records;
    // The raw name, not legacyEmployeeName: that falls back to the email, so
    // a nameless row (shown as "-") would rank its email match as a name match.
    return rankSearchMatches(records, term, (row) => [
      row.employeeName?.trim() ?? "",
      row.employeeEmail,
      row.reviewerName ?? "",
      row.department ?? "",
    ]);
  }, [records, searchText]);

  const columns = useMemo<DataGrid.GridColDef<ParLegacyHistory>[]>(
    () => [
      {
        field: "employeeName",
        headerName: "Employee Name",
        flex: 1.8,
        valueGetter: (_v, row) => legacyEmployeeName(row),
        renderCell: (params) => (
          <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
            <Avatar
              src={thumbnailFor(params.row.employeeEmail) || undefined}
              slotProps={{ img: { referrerPolicy: "no-referrer" } }}
              sx={{ mr: 2, height: "2.2rem", width: "2.2rem" }}
            />
            {/* No migrated name: the email is already in the next column. */}
            <Typography variant="body2" sx={{ fontSize: 13, fontWeight: 600 }}>
              {params.value === params.row.employeeEmail ? "-" : params.value}
            </Typography>
          </Box>
        ),
      },
      {
        field: "employeeEmail",
        headerName: "Employee Email",
        flex: 1.8,
        renderCell: (params) => (
          <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
            <Typography variant="body2" sx={{ fontSize: 13 }} color="text.secondary" noWrap>
              {params.row.employeeEmail}
            </Typography>
          </Box>
        ),
      },
      { field: "department", headerName: "Department", flex: 1.2, valueGetter: (_v, row) => row.department ?? "-" },
      { field: "reviewerName", headerName: "Lead", flex: 1.2, valueGetter: (_v, row) => row.reviewerName ?? "-" },
      {
        field: "employeePar",
        headerName: "Employee PAR",
        flex: 0.8,
        valueGetter: (_v, row) => isLegacyEmployeeParDone(row),
        renderCell: (params) => <DoneChip done={Boolean(params.value)} />,
      },
      {
        field: "leadFeedback",
        headerName: "Lead's Feedback",
        flex: 0.8,
        valueGetter: (_v, row) => isLegacyLeadFeedbackDone(row),
        renderCell: (params) => <DoneChip done={Boolean(params.value)} />,
      },
      {
        field: "overallRating",
        headerName: "Overall Rating",
        flex: 1,
        valueGetter: (_v, row) => legacyOverallRating(row),
      },
      {
        field: "actions",
        headerName: "",
        sortable: false,
        flex: 0.4,
        renderCell: (params) => (
          <Tooltip title="View" arrow>
            <IconButton
              onClick={(e) => {
                // The row's own onRowClick would open it a second time.
                e.stopPropagation();
                onOpenRecord(params.row);
              }}
            >
              <EyeIcon size={18} />
            </IconButton>
          </Tooltip>
        ),
      },
    ],
    [thumbnailFor, onOpenRecord],
  );

  return (
    <Stack spacing={1.5}>
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <TextField
          size="small"
          placeholder="Search Employee"
          value={searchText}
          onChange={(e) => onSearchTextChange(e.target.value)}
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
      </Box>
      <DataGrid.DataGrid
        rows={filteredRows}
        columns={columns}
        getRowId={(row) => row.legacyHeaderId}
        rowHeight={56}
        disableRowSelectionOnClick
        onRowClick={(params) => onOpenRecord(params.row)}
        showToolbar
        slots={{ toolbar: ParGridToolbar }}
        sx={{ border: "none", "& .MuiDataGrid-row": { cursor: "pointer" } }}
        // The parent never mounts this tab for an empty cycle, so the only
        // empty grid here is a search that matched nobody.
        localeText={{ noRowsLabel: "No employees match your search." }}
        paginationModel={paginationModel}
        onPaginationModelChange={onPaginationModelChange}
        sortModel={sortModel}
        onSortModelChange={onSortModelChange}
        pageSizeOptions={[10, 20, 25]}
      />
    </Stack>
  );
}
