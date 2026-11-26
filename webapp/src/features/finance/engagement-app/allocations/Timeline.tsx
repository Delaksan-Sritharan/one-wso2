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

import type { JSX, MouseEvent, ReactNode } from "react";
import { Box, ButtonBase, Stack, Tooltip, Typography } from "@wso2/oxygen-ui";
import { addDays, daysBetween, fmtShort, readableOn } from "../model/format";

export interface TimelineBar {
  readonly key: string;
  readonly start: string;
  readonly end: string;
  readonly label: string;
  readonly title: string;
  readonly color: string;
  /** What the colour stands for, listed in the legend under the timeline. */
  readonly type?: string;
  /** Hourly allocations are drawn thinner. */
  readonly thin?: boolean;
  /** Opens something for the bar; handed the bar, to anchor a menu on. */
  readonly onClick?: (anchor: HTMLElement) => void;
}

export interface TimelineRow {
  readonly key: string;
  readonly label: string;
  readonly sub?: string;
  readonly bars: readonly TimelineBar[];
  /** A control at the row's end, e.g. Allocate or Add. */
  readonly action?: ReactNode;
}

export interface TimelineMark {
  readonly date: string;
  readonly label: string;
  readonly tone: "today" | "engagement";
}

const LANE = 28;

/** Bars that overlap go on separate lanes. */
function lanes(bars: readonly TimelineBar[]): { bar: TimelineBar; lane: number }[] {
  const ends: string[] = [];
  return [...bars]
    .sort((a, b) => (a.start < b.start ? -1 : 1))
    .map((bar) => {
      let lane = ends.findIndex((e) => e < bar.start);
      if (lane < 0) lane = ends.length;
      ends[lane] = bar.end;
      return { bar, lane };
    });
}

/** The legacy allocation timeline: one row per person over a date window, bars coloured by allocation type, with today and the engagement's start and end marked. */
export default function Timeline({
  start,
  end,
  rows,
  marks = [],
  empty,
}: {
  readonly start: string;
  readonly end: string;
  readonly rows: readonly TimelineRow[];
  readonly marks?: readonly TimelineMark[];
  readonly empty: ReactNode;
}): JSX.Element {
  const span = Math.max(1, daysBetween(start, end) + 1);
  const pct = (d: string) => Math.min(100, Math.max(0, (daysBetween(start, d) / span) * 100));
  // Week ticks across the window.
  const ticks: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 7)) ticks.push(d);

  // One entry per allocation type on show, in the colour its bars use.
  const legend = [...new Map(rows.flatMap((r) => r.bars).flatMap((b) => (b.type ? [[b.type, b.color] as const] : []))).entries()];

  if (!rows.length) {
    return (
      <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, p: 3, textAlign: "center" }}>
        <Typography variant="body2" color="text.secondary">
          {empty}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, overflowX: "auto" }}>
      <Box sx={{ minWidth: 760 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: "220px 1fr 120px", borderBottom: 1, borderColor: "divider", bgcolor: "action.hover" }}>
          <Box />
          <Box sx={{ position: "relative", height: 26 }}>
            {ticks.map((t) => (
              <Typography
                key={t}
                variant="caption"
                color="text.secondary"
                sx={{ position: "absolute", left: `${pct(t)}%`, top: 4, pl: 0.5, whiteSpace: "nowrap" }}
              >
                {fmtShort(t)}
              </Typography>
            ))}
          </Box>
          <Box />
        </Box>
        {rows.map((row) => {
          const placed = lanes(row.bars.filter((b) => b.end >= start && b.start <= end));
          const height = Math.max(1, ...placed.map((p) => p.lane + 1)) * LANE + 12;
          return (
            <Box key={row.key} sx={{ display: "grid", gridTemplateColumns: "220px 1fr 120px", borderBottom: 1, borderColor: "divider", "&:last-of-type": { borderBottom: 0 } }}>
              <Box sx={{ px: 1.5, py: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600 }} noWrap title={row.label}>
                  {row.label}
                </Typography>
                {row.sub ? (
                  <Typography variant="caption" color="text.secondary" noWrap component="div">
                    {row.sub}
                  </Typography>
                ) : null}
              </Box>
              <Box sx={{ position: "relative", height, borderLeft: 1, borderColor: "divider" }}>
                {marks.map((m) =>
                  m.date >= start && m.date <= end ? (
                    <Tooltip key={`${m.label}${m.date}`} title={`${m.label}: ${fmtShort(m.date)}`}>
                      <Box
                        sx={{
                          position: "absolute",
                          top: 0,
                          bottom: 0,
                          left: `${pct(m.date)}%`,
                          borderLeft: 2,
                          borderColor: m.tone === "today" ? "primary.main" : "info.main",
                          borderLeftStyle: m.tone === "today" ? "solid" : "dashed",
                          opacity: 0.6,
                        }}
                      />
                    </Tooltip>
                  ) : null,
                )}
                {placed.map(({ bar, lane }) => {
                  const left = pct(bar.start < start ? start : bar.start);
                  const right = pct(addDays(bar.end > end ? end : bar.end, 1));
                  return (
                    <Tooltip key={bar.key} title={bar.title} enterTouchDelay={0} leaveTouchDelay={4000}>
                      <ButtonBase
                        onClick={bar.onClick ? (ev: MouseEvent<HTMLElement>) => bar.onClick?.(ev.currentTarget) : undefined}
                        // A bar that opens nothing still takes focus and a tap, so its tooltip reaches keyboard and touch users.
                        component={bar.onClick ? "button" : "div"}
                        tabIndex={0}
                        aria-label={bar.title}
                        sx={{
                          cursor: bar.onClick ? "pointer" : "default",
                          position: "absolute",
                          left: `${left}%`,
                          width: `${Math.max(0.8, right - left)}%`,
                          top: 6 + lane * LANE + (bar.thin ? 5 : 0),
                          height: bar.thin ? 12 : 22,
                          bgcolor: bar.color,
                          borderRadius: 1,
                          color: readableOn(bar.color),
                          fontSize: 11,
                          fontWeight: 600,
                          px: 0.75,
                          justifyContent: "flex-start",
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                          textOverflow: "ellipsis",
                          "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 1 },
                        }}
                      >
                        {bar.thin ? "" : bar.label}
                      </ButtonBase>
                    </Tooltip>
                  );
                })}
              </Box>
              <Stack sx={{ px: 1, py: 1, alignItems: "flex-end", justifyContent: "flex-start" }}>{row.action}</Stack>
            </Box>
          );
        })}
      </Box>
      {legend.length ? (
        <Stack direction="row" spacing={2} aria-label="Colour legend" role="list" sx={{ px: 1.5, py: 1, flexWrap: "wrap", rowGap: 0.75, borderTop: 1, borderColor: "divider" }}>
          {legend.map(([type, color]) => (
            <Stack key={type} direction="row" spacing={0.75} role="listitem" sx={{ alignItems: "center" }}>
              <Box aria-hidden sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: color }} />
              <Typography variant="caption" color="text.secondary">
                {type}
              </Typography>
            </Stack>
          ))}
        </Stack>
      ) : null}
    </Box>
  );
}
