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

import { useState } from "react";
import { Alert, Box, ToggleButton, ToggleButtonGroup } from "@wso2/oxygen-ui";
import { isCcBackendConfigured } from "@config/apiConfig";
import { ApproveBody, type ApproveRole } from "./CcApproveBody";
import { useCcUserInfo } from "../useCc";
import { ccHasAccess } from "../ccTypes";

// The CC Expenses tab of Claim approval — now the only place to approve
// credit card submissions; the standalone Approve Submissions screen under Me
// was retired once this tab covered the same queue. The "As lead / As
// finance" toggle here matches the Expense and OPD tabs.
export default function CcApprovalsTab() {
  // Its own backend's connectivity, as the Expense and OPD tabs report their
  // own: Claim approval spans three backends and any of them may be missing.
  if (!isCcBackendConfigured()) {
    return (
      <Alert severity="info">
        Credit card expenses aren&apos;t connected yet. Set{" "}
        <code>ONE_WSO2_CC_EXPENSES_BACKEND_URL</code> in <code>public/config.js</code> and reload.
      </Alert>
    );
  }
  return <CcApprovals />;
}

function CcApprovals() {
  const userInfo = useCcUserInfo();
  const isFinance = ccHasAccess(userInfo.data, "finance");
  const isLead = ccHasAccess(userInfo.data, "lead");
  const [picked, setPicked] = useState<ApproveRole | null>(null);
  const role: ApproveRole | null = picked ?? (isFinance ? "finance" : isLead ? "lead" : null);
  // Owned here rather than inside ApproveBody: the row ticked a moment ago
  // may not even be actionable in the mode being switched to, so a role
  // change has to clear it at this same point, not react to it afterwards.
  const [checked, setChecked] = useState<Set<number>>(new Set());

  // ApproveBody carries its own loading, error and no-access states — the
  // same ones the standalone screen shows — so nothing here duplicates them.
  // isLead/isFinance are both false while userInfo is still loading, which
  // keeps the toggle off screen until access is actually known.
  return (
    <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      {isLead && isFinance && (
        <ToggleButtonGroup
          size="small"
          exclusive
          value={role}
          onChange={(_e, v) => {
            if (!v) return;
            setChecked(new Set());
            setPicked(v as ApproveRole);
          }}
          sx={{ mb: 2, alignSelf: "flex-start" }}
        >
          <ToggleButton value="lead" sx={{ textTransform: "none" }}>
            As lead
          </ToggleButton>
          <ToggleButton value="finance" sx={{ textTransform: "none" }}>
            As finance
          </ToggleButton>
        </ToggleButtonGroup>
      )}
      <ApproveBody
        userInfo={userInfo}
        isLead={isLead}
        isFinance={isFinance}
        role={role}
        checked={checked}
        setChecked={setChecked}
      />
    </Box>
  );
}
