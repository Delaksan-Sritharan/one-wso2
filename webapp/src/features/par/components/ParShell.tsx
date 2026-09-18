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
import { ClipboardCheckIcon } from "@wso2/oxygen-ui-icons-react";
import { isParBackendConfigured } from "../api/useParData";

const TITLE = "Performance Appraisal Review";
const SUBTITLE =
  "Complete your own feedback, request and give 360° feedback, and see your record from past cycles.";

export default function ParShell({ children }: { children: ReactNode }) {
  const configured = isParBackendConfigured();
  return (
    <Box>
      <Chip
        icon={<ClipboardCheckIcon size={14} />}
        label="PAR App"
        color="primary"
        size="small"
        variant="outlined"
        sx={{ mb: 0.5 }}
      />
      <Typography component="h1" variant="h5" sx={{ mb: 0.5 }}>
        {TITLE}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.25, maxWidth: "70ch" }}>
        {SUBTITLE}
      </Typography>

      {configured ? (
        children
      ) : (
        <Alert severity="info" sx={{ mt: 1.5 }}>
          PAR isn't connected yet. Set <code>ONE_WSO2_PAR_BACKEND_URL</code> in{" "}
          <code>public/config.js</code> (the par-app backend URL) and reload.
        </Alert>
      )}
    </Box>
  );
}
