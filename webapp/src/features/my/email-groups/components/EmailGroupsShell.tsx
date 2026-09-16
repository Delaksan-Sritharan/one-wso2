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
import type { ReactNode } from "react";
import { Alert, Box, Chip, Typography } from "@wso2/oxygen-ui";
import type { LucideIcon } from "@wso2/oxygen-ui-icons-react";

// Shrinks an element to a 1x1px clipped box instead of hiding it outright —
// unlike display:none/visibility:hidden, this keeps it in the accessibility
// tree, so assistive tech still sees it while sighted users don't. Same
// pattern as OrgChartShell.
const visuallyHidden = {
  border: 0,
  clip: "rect(0 0 0 0)",
  height: "1px",
  margin: "-1px",
  overflow: "hidden",
  padding: 0,
  position: "absolute",
  width: "1px",
} as const;

// Page frame: eyebrow chip, title, subtitle, and the one place the "backend
// not connected" state is rendered. Same shape as MenuShell/FinanceShell —
// see MenuShell's comment for why each feature carries its own copy rather
// than sharing one: small enough that a shared abstraction would cost more
// to thread props through than it saves.
export default function EmailGroupsShell({
  eyebrow,
  title,
  subtitle,
  configured,
  configKey,
  children,
}: {
  eyebrow: { icon: LucideIcon; label: string };
  title: string;
  subtitle?: string;
  configured: boolean;
  configKey: string;
  children: ReactNode;
}) {
  return (
    <Box>
      <Chip
        icon={<eyebrow.icon size={14} />}
        label={eyebrow.label}
        color="primary"
        // Outlined, not filled: white-on-orange at chip text sizes is ~3.6:1 and
        // fails WCAG AA. Outlined routes through the a11y overlay, which shifts
        // the label and border to primary.dark in light mode.
        variant="outlined"
        size="small"
        sx={{ mb: 0.5 }}
      />
      {/* Visually hidden rather than dropped: the eyebrow Chip above already
          shows the page's name, so a second, visible heading directly under
          it read as a duplicate — but removing the h1 outright would leave
          the page with no heading at all for assistive tech, since the Chip
          (a div) contributes none. */}
      <Typography component="h1" variant="h5" sx={visuallyHidden}>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.25, maxWidth: "70ch" }}>
          {subtitle}
        </Typography>
      )}

      {configured ? (
        children
      ) : (
        <Alert severity="info" sx={{ mt: 1.5 }}>
          This app isn&apos;t connected yet. Set <code>{configKey}</code> in{" "}
          <code>public/config.js</code> (the backend URL) and reload.
        </Alert>
      )}
    </Box>
  );
}
