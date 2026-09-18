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

import { useState, type FormEvent } from "react";
import {
  Box,
  FormControl,
  FormControlLabel,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  TextField,
} from "@wso2/oxygen-ui";
import { SearchIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import type { MeetingScope } from "../api/revOpsTypes";

const ALL_REGIONS = "__all__";

/**
 * The three filters above the list: scope, region and title search.
 *
 * Search is a FORM rather than a text field with a keydown handler. Submitting
 * on Enter then comes for free and works the same as clicking the button, and
 * screen readers announce the field as a search rather than as a lone input —
 * the standalone app wired Enter by hand and the button separately, which is
 * two code paths for one behaviour.
 *
 * The typed query is deliberately NOT applied on every keystroke. Each change
 * is a round trip with server-side paging behind it, so searching as you type
 * would fire a request per character and race their responses.
 *
 * One box, several columns: the backend matches the term against title, account
 * owner, account name, call type and the opportunity's customer name. The label
 * names them rather than saying "search", because a box that silently searches
 * more than it claims leaves people not trying the thing that would have worked.
 *
 * Call type matches the STORED value (`monthly_weekly`), not the label shown in
 * the table ("Monthly / weekly sync") — so "monthly" finds those rows and "sync"
 * does not.
 */
export default function MeetingFilters({
  scope,
  onScopeChange,
  region,
  onRegionChange,
  regions,
  regionsLoading,
  search,
  onSearchChange,
  disabled,
}: {
  scope: MeetingScope;
  onScopeChange: (scope: MeetingScope) => void;
  region: string | null;
  onRegionChange: (region: string | null) => void;
  regions: string[];
  regionsLoading: boolean;
  /** The APPLIED search, not the draft. */
  search: string | null;
  onSearchChange: (search: string | null) => void;
  disabled?: boolean;
}) {
  // Draft lives here; only submitting lifts it to the page.
  const [draft, setDraft] = useState(search ?? "");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = draft.trim();
    onSearchChange(trimmed ? trimmed : null);
  };

  const clear = () => {
    setDraft("");
    onSearchChange(null);
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        gap: 2,
        alignItems: "center",
        mb: 2,
      }}
    >
      <RadioGroup
        row
        value={scope}
        onChange={(event) => onScopeChange(event.target.value as MeetingScope)}
        aria-label="Which meetings to show"
      >
        <FormControlLabel
          value="past"
          control={<Radio size="small" disabled={disabled} />}
          label="Past meetings"
        />
        <FormControlLabel
          value="all"
          control={<Radio size="small" disabled={disabled} />}
          label="All meetings"
        />
      </RadioGroup>

      <FormControl size="small" sx={{ minWidth: 180 }} disabled={disabled || regionsLoading}>
        <InputLabel id="revops-region-label">Region</InputLabel>
        <Select
          labelId="revops-region-label"
          label="Region"
          value={region ?? ALL_REGIONS}
          onChange={(event) => {
            const value = event.target.value as string;
            onRegionChange(value === ALL_REGIONS ? null : value);
          }}
        >
          {/* "All" is a sentinel rather than an empty string: an empty value
              would render the Select as unset and float its label oddly. */}
          <MenuItem value={ALL_REGIONS}>All regions</MenuItem>
          {regions.map((name) => (
            <MenuItem key={name} value={name}>
              {name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box component="form" role="search" onSubmit={submit} sx={{ flex: 1, minWidth: 240 }}>
        <TextField
          fullWidth
          size="small"
          type="search"
          label="Search"
          placeholder="Title, account, call type or owner"
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  {draft && (
                    <IconButton size="small" onClick={clear} aria-label="Clear search">
                      <XIcon size={16} />
                    </IconButton>
                  )}
                  <IconButton size="small" type="submit" aria-label="Search meetings">
                    <SearchIcon size={16} />
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>
    </Box>
  );
}
