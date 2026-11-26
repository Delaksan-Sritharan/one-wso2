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

import { useState, type JSX, type ReactNode } from "react";
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  FormLabel,
} from "@wso2/oxygen-ui";
import { LockIcon, PlusIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import { useDebouncedValue } from "@hooks/useDebouncedValue";
import type { Campaign, ReferenceData, SalesforceAccount } from "../api/engagementTypes";
import { useAccounts, useCampaigns } from "../api/useEngagementApi";
import { TABLE_HEAD_SX } from "../components/eaStyles";
import SearchSelect from "../components/SearchSelect";
import { emptyFunding, type FundingRow } from "../model/engagementForm";

/** A lock beside a label: the value came from Salesforce, or cannot change after creation. */
export function Locked({ title = "Filled from Salesforce" }: { title?: string }): JSX.Element {
  return (
    <Tooltip title={title}>
      <Box component="span" tabIndex={0} role="img" aria-label={title} sx={{ display: "inline-flex", verticalAlign: "middle", ml: 0.5, color: "text.disabled" }}>
        <LockIcon size={12} />
      </Box>
    </Tooltip>
  );
}

export function LabelWithLock({ label, lock, title }: { label: string; lock?: boolean; title?: string }): ReactNode {
  return (
    <>
      {label}
      {lock ? <Locked title={title} /> : null}
    </>
  );
}

/** A plain select over string options. */
export function SelectField({
  label,
  value,
  options,
  onChange,
  required,
  disabled,
  error,
  lock,
  lockTitle,
  placeholder,
  searchable,
}: {
  label: string;
  value: string;
  options: readonly (string | readonly [string, string])[];
  onChange: (v: string) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  lock?: boolean;
  lockTitle?: string;
  placeholder?: string;
  /** Type to find an option, for a long list (countries, sub regions). */
  searchable?: boolean;
}): JSX.Element {
  if (searchable) {
    return <SearchSelect label={<LabelWithLock label={label} lock={lock} title={lockTitle} />} value={value} options={options} onChange={onChange} required={required} disabled={disabled} error={error} />;
  }
  return (
    <TextField
      select
      fullWidth
      size="small"
      label={<LabelWithLock label={label} lock={lock} title={lockTitle} />}
      value={value}
      required={required}
      disabled={disabled}
      error={Boolean(error)}
      helperText={error}
      onChange={(e) => onChange(e.target.value)}
      slotProps={{ select: { displayEmpty: Boolean(placeholder) }, inputLabel: placeholder ? { shrink: true } : undefined }}
    >
      {placeholder ? (
        <MenuItem value="" disabled>
          <em>{placeholder}</em>
        </MenuItem>
      ) : null}
      {options.map((o) => {
        const [v, l] = typeof o === "string" ? [o, o] : o;
        return (
          <MenuItem key={v} value={v}>
            {l}
          </MenuItem>
        );
      })}
    </TextField>
  );
}

/** The Salesforce account, searched as you type (from two letters) against the synced accounts, instead of loading every account before the list shows. */
export function AccountSearchField({
  value,
  onPick,
  error,
}: {
  value: { id: string; name: string } | null;
  onPick: (a: SalesforceAccount | null) => void;
  error?: string;
}): JSX.Element {
  const [text, setText] = useState(value?.name ?? "");
  const q = useDebouncedValue(text, 250);
  const accounts = useAccounts(q);
  const options = q.trim().length >= 2 ? (accounts.data ?? []) : [];
  return (
    <Autocomplete
      size="small"
      options={options}
      value={value ? { id: value.id, name: value.name } : null}
      inputValue={text}
      onInputChange={(_, v) => setText(v)}
      onChange={(_, v) => onPick(v as SalesforceAccount | null)}
      getOptionLabel={(o) => o.name}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      filterOptions={(x) => x}
      loading={accounts.isFetching}
      noOptionsText={
        q.trim().length < 2 ? "Type at least 2 letters to search" : accounts.isError ? "Couldn't search Salesforce accounts" : `No account matches “${q.trim()}”`
      }
      renderOption={(props, o) => (
        <li {...props} key={o.id}>
          <Box sx={{ display: "flex", justifyContent: "space-between", width: "100%", gap: 2 }}>
            <span>{o.name}</span>
            <Typography variant="caption" color="text.secondary">
              {o.country}
            </Typography>
          </Box>
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          required
          label="Account"
          placeholder="Type at least 2 letters to search"
          error={Boolean(error)}
          helperText={error}
          slotProps={{
            input: {
              ...params.InputProps,
              endAdornment: (
                <>
                  {accounts.isFetching ? (
                    <InputAdornment position="end">
                      <CircularProgress size={14} />
                    </InputAdornment>
                  ) : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            },
          }}
        />
      )}
    />
  );
}

/** Marketing Event: the Salesforce campaign (active campaigns, searched as you type). */
export function CampaignField({
  value,
  onPick,
  error,
  disabled,
  required = true,
}: {
  value: Campaign | null;
  onPick: (c: Campaign | null) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
}): JSX.Element {
  const [text, setText] = useState("");
  const q = useDebouncedValue(text, 250);
  const campaigns = useCampaigns(q, !disabled);
  const options = campaigns.data ?? [];
  return (
    <Autocomplete
      size="small"
      disabled={disabled}
      options={value && !options.some((c) => c.id === value.id) ? [value, ...options] : options}
      value={value}
      onInputChange={(_, v, reason) => (reason === "input" ? setText(v) : undefined)}
      onChange={(_, v) => onPick(v)}
      getOptionLabel={(o) => o.name}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      filterOptions={(x) => x}
      loading={campaigns.isFetching}
      noOptionsText={campaigns.isError ? "Couldn't load the Salesforce campaigns" : "No active campaign matches"}
      renderOption={(props, o) => (
        <li {...props} key={o.id}>
          <Box>
            <Box sx={{ fontSize: 13.5 }}>{o.name}</Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
              Campaign ID {o.id}
            </Typography>
          </Box>
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          required={required}
          label={<LabelWithLock label="Campaign" lock={disabled} title="Cannot be changed after approval" />}
          placeholder="Select Campaign"
          error={Boolean(error)}
          helperText={error ?? (value ? `Campaign ID ${value.id}` : undefined)}
        />
      )}
    />
  );
}

/** Marketing events: funding sources must total 100%, with no 0% row. */
export function FundingSourcesField({
  rows,
  onChange,
  reference,
  error,
}: {
  rows: FundingRow[];
  onChange: (rows: FundingRow[]) => void;
  reference: ReferenceData | undefined;
  error?: string;
}): JSX.Element {
  const total = rows.reduce((s, r) => s + Number(r.percentage || 0), 0);
  const set = (i: number, patch: Partial<FundingRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const subRegions = (region: string) => reference?.regions.find((r) => r.name === region)?.subRegions ?? [];
  const productUnits = (bu: string) =>
    (reference?.productUnits ?? []).filter((p) => p.marketing && (!p.businessUnit || p.businessUnit === bu)).map((p) => p.name);
  const cell = (node: ReactNode) => <TableCell sx={{ px: 0.75, py: 0.75, minWidth: 130 }}>{node}</TableCell>;
  return (
    <Box>
      <FormLabel required sx={{ display: "block", fontSize: 13, fontWeight: 600, color: "text.primary", mb: 0.75 }}>
        Funding Sources
      </FormLabel>
      <Box sx={{ border: 1, borderColor: error ? "error.main" : "divider", borderRadius: 1.5, overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={TABLE_HEAD_SX}>
              <TableCell>Business Unit</TableCell>
              <TableCell>Product Unit</TableCell>
              <TableCell>Region</TableCell>
              <TableCell>Sub Region</TableCell>
              <TableCell align="right">Percentage</TableCell>
              <TableCell sx={{ width: 40 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                {cell(
                  <SelectField
                    label="Business Unit"
                    value={r.businessUnit}
                    options={reference?.businessUnits ?? []}
                    onChange={(v) => set(i, { businessUnit: v, productUnit: "" })}
                  />,
                )}
                {cell(<SelectField label="Product Unit" value={r.productUnit} options={productUnits(r.businessUnit)} onChange={(v) => set(i, { productUnit: v })} />)}
                {cell(
                  <SelectField label="Region" value={r.region} options={(reference?.regions ?? []).map((x) => x.name)} onChange={(v) => set(i, { region: v, subRegion: "" })} />,
                )}
                {cell(<SelectField searchable label="Sub Region" value={r.subRegion} options={subRegions(r.region)} onChange={(v) => set(i, { subRegion: v })} />)}
                <TableCell align="right" sx={{ px: 0.75, width: 96 }}>
                  <TextField
                    size="small"
                    type="number"
                    value={r.percentage}
                    onChange={(e) => set(i, { percentage: e.target.value })}
                    slotProps={{ htmlInput: { min: 1, max: 100, "aria-label": "Percentage", style: { textAlign: "right" } } }}
                  />
                </TableCell>
                <TableCell sx={{ px: 0.5 }}>
                  {rows.length > 1 ? (
                    <IconButton size="small" aria-label="Remove funding source" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                      <XIcon size={14} />
                    </IconButton>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", mt: 1 }}>
        <Button size="small" variant="outlined" startIcon={<PlusIcon size={14} />} onClick={() => onChange([...rows, emptyFunding("0")])}>
          Add Funding Source
        </Button>
        <Box sx={{ flex: 1 }} />
        <Typography variant="body2" sx={{ color: total === 100 ? "text.secondary" : "error.main" }}>
          Total {total}%
        </Typography>
      </Box>
      {error ? (
        <Typography variant="caption" color="error" component="div" sx={{ mt: 0.5 }}>
          {error}
        </Typography>
      ) : null}
    </Box>
  );
}
