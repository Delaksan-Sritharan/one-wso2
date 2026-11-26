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

import { Autocomplete, Button, Chip, Grid, IconButton, TextField, Tooltip, Typography } from "@wso2/oxygen-ui";
import { PlusIcon, Trash2Icon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import ParDateField from "./ParDateField";
import { useParDepartments } from "../api/useParAdmin";
import type { DepartmentDeadline } from "../api/types";
import { cleanDepartments, isDepartmentIn } from "../util/parDepartments";

// The departments PAR admins pick, from HR's list, for Create PAR Cycle, Cycle
// settings and Configurations: those that share the rating that needs evidence
// without it and, for a cycle, those with a self-review deadline of their own.
export default function ParDepartmentSettingsFields({
  evidenceRating,
  noEvidence,
  onNoEvidenceChange,
  deadlines,
  onDeadlinesChange,
  dates,
  disabled = false,
}: {
  /** The rating that needs evidence, to name it. */
  evidenceRating: string;
  noEvidence: string[];
  onNoEvidenceChange: (departments: string[]) => void;
  /** Left out for the global configurations, which have no deadlines. */
  deadlines?: DepartmentDeadline[];
  onDeadlinesChange?: (deadlines: DepartmentDeadline[]) => void;
  /** The bounds of a department's own deadline, as the cycle's. */
  dates?: { min: string; max?: string };
  disabled?: boolean;
}) {
  const departments = useParDepartments();
  const options = departments.data ?? [];

  const setDeadline = (index: number, change: Partial<DepartmentDeadline>) =>
    onDeadlinesChange?.((deadlines ?? []).map((d, i) => (i === index ? { ...d, ...change } : d)));

  return (
    <Grid container spacing={2}>
      <Grid size={12}>
        <Typography variant="subtitle2">Departments</Typography>
      </Grid>
      {departments.isError && (
        <Grid size={12}>
          <ErrorNotice error={departments.error} onRetry={() => departments.refetch()} retrying={departments.isFetching}>
            Couldn't load the departments.
          </ErrorNotice>
        </Grid>
      )}
      <Grid size={12}>
        <Autocomplete
          multiple
          disabled={disabled}
          loading={departments.isLoading}
          options={options.filter((o) => !isDepartmentIn(noEvidence, o))}
          value={noEvidence}
          onChange={(_e, next) => onNoEvidenceChange(cleanDepartments(next as string[]))}
          renderTags={(tagValue, getTagProps) =>
            tagValue.map((option, index) => {
              const { key, ...tagProps } = getTagProps({ index });
              return <Chip key={key} variant="outlined" label={option} {...tagProps} />;
            })
          }
          renderInput={(params) => (
            <TextField
              {...params}
              label="No evidence needed"
              size="small"
              aria-label="No evidence needed"
              helperText={
                evidenceRating
                  ? `For employees in these departments, leads share "${evidenceRating}" without the confirmation or a file.`
                  : "For employees in these departments, leads share the rating that needs evidence without it."
              }
            />
          )}
        />
      </Grid>

      {deadlines && (
        <>
          <Grid size={12}>
            <Typography variant="body2" color="text.secondary">
              A department's own self-review deadline. Every other deadline stays the same for it.
            </Typography>
          </Grid>
          {deadlines.map((d, index) => (
            <Grid key={index} size={12} container spacing={2} sx={{ alignItems: "flex-start" }}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Autocomplete
                  disabled={disabled}
                  loading={departments.isLoading}
                  options={options.filter(
                    (o) => !deadlines.some((other, i) => i !== index && isDepartmentIn([other.department], o)),
                  )}
                  value={d.department || null}
                  onChange={(_e, next) => setDeadline(index, { department: (next as string | null) ?? "" })}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Department"
                      size="small"
                      inputProps={{ ...params.inputProps, "aria-label": `Department ${index + 1}` }}
                    />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 10, sm: 5 }}>
                <ParDateField
                  label="Self-review deadline"
                  fullWidth
                  ariaLabel={`Self-review deadline ${index + 1}`}
                  value={d.deadline}
                  min={dates?.min}
                  max={dates?.max}
                  disabled={disabled}
                  onChange={(deadline) => setDeadline(index, { deadline })}
                />
              </Grid>
              <Grid size={{ xs: 2, sm: 1 }}>
                <Tooltip title="Remove">
                  <IconButton
                    aria-label={`Remove self-review deadline ${index + 1}`}
                    disabled={disabled}
                    onClick={() => onDeadlinesChange?.(deadlines.filter((_d, i) => i !== index))}
                  >
                    <Trash2Icon size={18} />
                  </IconButton>
                </Tooltip>
              </Grid>
            </Grid>
          ))}
          <Grid size={12}>
            <Button
              size="small"
              startIcon={<PlusIcon size={16} />}
              disabled={disabled}
              onClick={() => onDeadlinesChange?.([...deadlines, { department: "", deadline: "" }])}
            >
              Add a department's deadline
            </Button>
          </Grid>
        </>
      )}
    </Grid>
  );
}
