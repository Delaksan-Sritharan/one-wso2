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

import type { JSX } from "react";
import { Box, Chip, Paper, Stack, Typography } from "@wso2/oxygen-ui";
import { ArrowRightIcon, CheckIcon } from "@wso2/oxygen-ui-icons-react";
import type { MyStep } from "@features/sales/cado2/approvals/model/myApprovals";

const COLOR = { done: "success", now: "primary", later: "default", stopped: "error" } as const;

/**
 * "Your approvals: CRO ✓ Approved → CFO Your turn → CEO Later", for someone
 * holding several of a quote's approval roles: each decision visibly moves
 * them along. Shown only when `showMyApprovals` says so.
 */
export default function MyApprovalSteps({ steps }: { readonly steps: readonly MyStep[] }): JSX.Element {
  return (
    <Paper component="section" variant="outlined" aria-label="Your approvals" sx={{ px: 2, py: 1.25, borderRadius: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" useFlexGap sx={{ flexWrap: "wrap" }}>
        <Typography variant="body2" sx={{ fontWeight: 600, mr: 0.5 }}>
          Your approvals
        </Typography>
        <Box component="ol" aria-label="Your approval steps" sx={{ display: "contents", listStyle: "none" }}>
          {steps.map((s, i) => (
            <Box component="li" key={s.role} aria-label={s.roleLabel} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {i > 0 ? <ArrowRightIcon size={14} aria-hidden /> : null}
              <Typography variant="body2" sx={{ fontWeight: s.state === "now" ? 600 : 400 }}>
                {s.roleLabel}
              </Typography>
              <Chip
                size="small"
                color={COLOR[s.state]}
                variant={s.state === "later" ? "outlined" : "filled"}
                icon={s.state === "done" ? <CheckIcon size={14} /> : undefined}
                label={s.label}
              />
            </Box>
          ))}
        </Box>
      </Stack>
    </Paper>
  );
}
