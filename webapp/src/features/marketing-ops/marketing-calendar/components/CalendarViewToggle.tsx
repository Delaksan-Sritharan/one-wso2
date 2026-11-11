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

import { Box, ToggleButton, ToggleButtonGroup } from "@wso2/oxygen-ui";
import { CalendarDaysIcon, ListIcon } from "@wso2/oxygen-ui-icons-react";
import type { CalendarDisplay } from "../calendarOutlet";

// Calendar | List: whether every tab draws the month grid or lists its items by
// day over a date range. One is always on.
export default function CalendarViewToggle({
  view,
  onChange,
}: {
  view: CalendarDisplay;
  onChange: (next: CalendarDisplay) => void;
}) {
  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={view}
      aria-label="Show as"
      // Clicking the one already on reports null; it stays on.
      onChange={(_, next: CalendarDisplay | null) => {
        if (next) onChange(next);
      }}
      sx={{ "& .MuiToggleButton-root": { py: 0.25, px: 1.25, textTransform: "none", fontSize: 13 } }}
    >
      <ToggleButton value="calendar">
        <Box component="span" sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <CalendarDaysIcon size={15} />
          Calendar
        </Box>
      </ToggleButton>
      <ToggleButton value="list">
        <Box component="span" sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <ListIcon size={15} />
          List
        </Box>
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
