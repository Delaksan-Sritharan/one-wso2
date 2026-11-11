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

import { Stack, TextField } from "@wso2/oxygen-ui";
import type { CalendarRange, ResolvedRange } from "../calendarRange";

// The List view's From and To, in place of the month arrows. They show what the
// URL holds (or the default month) even when it doesn't apply, so a mistyped
// date stays in front of the reader beside the reason it was set aside.
export default function RangeInputs({
  value,
  errors,
  onChange,
}: {
  value: CalendarRange;
  errors: ResolvedRange["errors"];
  onChange: (next: CalendarRange) => void;
}) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
      <TextField
        type="date"
        size="small"
        label="From"
        value={value.from}
        error={Boolean(errors.from)}
        helperText={errors.from}
        onChange={(event) => onChange({ ...value, from: event.target.value })}
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <TextField
        type="date"
        size="small"
        label="To"
        value={value.to}
        error={Boolean(errors.to)}
        helperText={errors.to}
        onChange={(event) => onChange({ ...value, to: event.target.value })}
        slotProps={{ inputLabel: { shrink: true } }}
      />
    </Stack>
  );
}
