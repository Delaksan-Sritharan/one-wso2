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

import { Box, LinearProgress, Typography } from "@wso2/oxygen-ui";

// Ports CompletionStatusCard.tsx. Source divides by `total` unguarded (NaN
// when it's 0); this port is reachable at zero both from an empty team and
// from a search that matches no team, so it's clamped here rather than
// reproduced.
export default function ParCompletionStatusCard({
  name,
  completed,
  total,
}: {
  name: string;
  completed: number;
  total: number;
}) {
  return (
    <Box sx={{ pt: 1.5 }}>
      <Typography sx={{ py: 1 }}>
        {name} : {total - completed} Pending
      </Typography>
      <LinearProgress
        variant="determinate"
        value={total <= 0 ? 0 : Math.min((completed * 100) / total, 100)}
        sx={{ height: 15, borderRadius: 2 }}
      />
    </Box>
  );
}
