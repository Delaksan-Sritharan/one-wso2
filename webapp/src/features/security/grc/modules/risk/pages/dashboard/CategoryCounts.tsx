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

import { Box, Chip, Stack, TableCell, Tooltip, Typography } from "@wso2/oxygen-ui";
import type { JSX, ReactNode } from "react";
import type { CategoryCounts } from "../../api/riskApi";
import type { ScopeRegister } from "./categoryViews";

// Open / Acc / Rem / Closed column definitions shared by the two category
// tables. Accept is amber rather than TREATMENT_COLORS' green so it never
// reads as Closed next to it.
const COUNT_COLUMNS: { key: keyof CategoryCounts; header: string; legend: string; color: string }[] = [
  { key: "open", header: "Open", legend: "Open", color: "#e34948" },
  { key: "accept", header: "Acc", legend: "Accept", color: "#b87700" },
  { key: "remediate", header: "Rem", legend: "Remediate", color: "#2a78d6" },
  { key: "closed", header: "Closed", legend: "Closed", color: "#008300" },
];

export function CountHeaderCells({ keys }: { keys: (keyof CategoryCounts)[] }): JSX.Element {
  return (
    <>
      {COUNT_COLUMNS.filter((c) => keys.includes(c.key)).map((c) => (
        <TableCell key={c.key} align="center" sx={{ color: c.color, fontWeight: 600, width: 72 }}>
          {c.header}
        </TableCell>
      ))}
    </>
  );
}

// One boxed number per column; zero renders as an em dash.
export function CountCells({ counts, keys }: { counts: CategoryCounts; keys: (keyof CategoryCounts)[] }): JSX.Element {
  return (
    <>
      {COUNT_COLUMNS.filter((c) => keys.includes(c.key)).map((c) => {
        const value = counts[c.key];
        return (
          <TableCell key={c.key} align="center">
            {value === 0 ? (
              <Typography variant="body2" color="text.secondary">
                —
              </Typography>
            ) : (
              <Box
                sx={{
                  display: "inline-block",
                  minWidth: 40,
                  px: 1,
                  py: 0.25,
                  borderRadius: 1,
                  border: `1px solid ${c.color}`,
                  bgcolor: `${c.color}1a`,
                  color: c.color,
                  fontWeight: 600,
                  fontSize: "0.875rem",
                }}
              >
                {value}
              </Box>
            )}
          </TableCell>
        );
      })}
    </>
  );
}

// A register chip in its stable palette colour; full name on hover.
export function RegisterChip({ register, color, full }: { register: ScopeRegister; color: string; full?: boolean }): JSX.Element {
  return (
    <Tooltip title={register.name}>
      <Chip
        size="small"
        label={full ? register.name : register.label}
        sx={{ bgcolor: `${color}26`, border: `1px solid ${color}`, fontWeight: 600 }}
      />
    </Tooltip>
  );
}

// Footer row: legend items on the left, an optional note on the right.
export function LegendRow({ items, note }: { items: ReactNode[]; note?: string | null }): JSX.Element {
  return (
    <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mt: 2 }}>
      {items}
      {note && (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic", ml: { md: 1 } }}>
          {note}
        </Typography>
      )}
    </Stack>
  );
}

export function CountLegend({ keys }: { keys: (keyof CategoryCounts)[] }): JSX.Element {
  return (
    <>
      {COUNT_COLUMNS.filter((c) => keys.includes(c.key)).map((c) => (
        <Chip
          key={c.key}
          size="small"
          variant="outlined"
          label={c.legend}
          sx={{ borderColor: c.color, color: c.color }}
        />
      ))}
    </>
  );
}
