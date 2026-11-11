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

import { Box, Chip, Stack } from "@wso2/oxygen-ui";
import { FilterLabel } from "../../ad-campaigns/campaign-tracker/components/FilterControls";
import { CALENDAR_CATEGORIES, categoryChipColor } from "../calendarCategories";
import type { CalendarCategory } from "../marketingCalendarTypes";

// The All view's category filter, which doubles as the colour legend: one toggle
// chip per category, filled with its colour while on and outlined while off.
// Several can be on at once, and the last one on stays on, so the grid never
// shows nothing because of the legend alone.
export default function CategoryLegendFilter({
  shown,
  onChange,
}: {
  shown: readonly CalendarCategory[];
  onChange: (next: CalendarCategory[]) => void;
}) {
  const toggle = (category: CalendarCategory) => {
    if (!shown.includes(category)) onChange([...shown, category]);
    else if (shown.length > 1) onChange(shown.filter((key) => key !== category));
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, mb: 2 }}>
      <FilterLabel>Show</FilterLabel>
      <Stack direction="row" role="group" aria-label="Categories shown" sx={{ flexWrap: "wrap", gap: 1 }}>
        {CALENDAR_CATEGORIES.map((style) => {
          const on = shown.includes(style.key);
          const variant = on ? "filled" : "outlined";
          const paint = categoryChipColor(style, variant);
          return (
            <Chip
              key={style.key}
              label={style.pluralLabel}
              color={paint.color}
              sx={paint.sx}
              variant={variant}
              size="small"
              aria-pressed={on}
              onClick={() => toggle(style.key)}
            />
          );
        })}
      </Stack>
    </Box>
  );
}
