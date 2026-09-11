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

import { Card, Typography } from "@wso2/oxygen-ui";

// Placeholder body for a Due Diligence screen not yet ported. Every route is
// wired and gated (see DueDiligenceShell) ahead of its content landing, so
// the app's shape — what's reachable from Finance and Legal, and who can see
// it — doesn't have to wait on the full port finishing.
export default function ComingSoonNotice({ what }: { what: string }) {
  return (
    <Card variant="outlined" sx={{ p: 2.5, maxWidth: 480 }}>
      <Typography sx={{ fontSize: 15, fontWeight: 700, mb: 0.75 }}>Not ported yet</Typography>
      <Typography sx={{ fontSize: 13, color: "text.secondary" }}>{what}</Typography>
    </Card>
  );
}
