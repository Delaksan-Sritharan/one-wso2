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

import { Box, Card, Skeleton, Typography } from "@wso2/oxygen-ui";
import { ArrowRightIcon, FileTextIcon } from "@wso2/oxygen-ui-icons-react";
import { NavLink } from "react-router";
import PerspectiveHeader from "@components/perspective-header/PerspectiveHeader";
import { useDueDiligenceGate } from "@features/due-diligence/api/useDueDiligenceGate";
import { DUE_DILIGENCE_APPS, DUE_DILIGENCE_EYEBROW } from "@constants/dueDiligenceApps";

// The Legal overview — currently just a way in to Due Diligence, the one app
// that lives here so far. Same pattern as FinancePage: a card per app,
// gated by the same id the rail uses for it, so the two can't disagree.
export default function LegalPage() {
  const gate = useDueDiligenceGate();
  const show = gate.canSee("dd-partners");

  return (
    <Box>
      <PerspectiveHeader
        title="Legal"
        subtitle="Legal review tools — non-disclosure agreements, reseller and trade-reference due diligence."
      />

      <Box sx={{ display: "flex", flexDirection: "column", gap: 2, maxWidth: 480 }}>
        {/* NDA — always visible */}
        <Card
          variant="outlined"
          component={NavLink}
          to="/legal/nda"
          sx={{
            p: 2.5,
            display: "block",
            textDecoration: "none",
            color: "inherit",
            transition: "border-color .12s, background-color .12s",
            "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
            <FileTextIcon size={16} />
            <Typography sx={{ fontSize: 15, fontWeight: 700, flex: 1 }}>NDA</Typography>
            <ArrowRightIcon size={15} />
          </Box>
          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
            Generate and download mutual non-disclosure agreements for WSO2 entities.
          </Typography>
        </Card>

        {/* Due Diligence — gated */}
        {gate.isResolving ? (
          <Skeleton variant="rectangular" height={88} sx={{ borderRadius: 1.5 }} />
        ) : show && (
          <Card
            variant="outlined"
            component={NavLink}
            to="/due-diligence/partners"
            state={{ fromPerspective: "legal" }}
            sx={{
              p: 2.5,
              display: "block",
              textDecoration: "none",
              color: "inherit",
              transition: "border-color .12s, background-color .12s",
              "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
              <DUE_DILIGENCE_EYEBROW.icon size={16} />
              <Typography sx={{ fontSize: 15, fontWeight: 700, flex: 1 }}>{DUE_DILIGENCE_EYEBROW.label}</Typography>
              <ArrowRightIcon size={15} />
            </Box>
            <Typography sx={{ fontSize: 13, color: "text.secondary" }}>{DUE_DILIGENCE_APPS[0].purpose}</Typography>
          </Card>
        )}
      </Box>
    </Box>
  );
}
