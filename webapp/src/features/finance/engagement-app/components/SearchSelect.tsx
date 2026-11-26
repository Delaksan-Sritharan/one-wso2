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

import type { JSX, ReactNode } from "react";
import { Autocomplete, TextField } from "@wso2/oxygen-ui";

type Option = string | readonly [string, string];

/** A select you can type into: for long lists (countries, time zones, sub regions), where scrolling a menu is slow. Options are values or [value, label] pairs. */
export default function SearchSelect({
  label,
  value,
  options,
  onChange,
  required,
  disabled,
  error,
  helperText,
}: {
  readonly label: ReactNode;
  readonly value: string;
  readonly options: readonly Option[];
  readonly onChange: (value: string) => void;
  readonly required?: boolean;
  readonly disabled?: boolean;
  /** A message under the field, shown as an error. */
  readonly error?: string;
  readonly helperText?: string;
}): JSX.Element {
  const pairs = options.map((o) => (typeof o === "string" ? ([o, o] as const) : o));
  return (
    <Autocomplete
      size="small"
      autoHighlight
      disabled={disabled}
      options={pairs}
      value={pairs.find((p) => p[0] === value) ?? null}
      getOptionLabel={(o) => o[1]}
      isOptionEqualToValue={(a, b) => a[0] === b[0]}
      onChange={(_, v) => onChange(v?.[0] ?? "")}
      renderInput={(params) => <TextField {...params} label={label} required={required} error={Boolean(error)} helperText={error ?? helperText} />}
    />
  );
}
