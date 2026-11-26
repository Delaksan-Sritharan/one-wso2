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

import type { JSX, ReactNode } from "react";
import { Box, Button, Divider, Drawer, IconButton, Stack, Typography } from "@wso2/oxygen-ui";
import { XIcon } from "@wso2/oxygen-ui-icons-react";
import { EA_SCOPE_SX } from "./eaStyles";

/** A record in a side drawer: its details, and the action for its stage in the footer. */
export default function RecordDrawer({ title, subtitle, children, actions, onClose }: { title: ReactNode; subtitle?: ReactNode; children: ReactNode; actions?: ReactNode; onClose: () => void }): JSX.Element {
  return (
    <Drawer anchor="right" open onClose={onClose} sx={EA_SCOPE_SX} slotProps={{ paper: { sx: { width: { xs: "100%", sm: 460 }, display: "flex", flexDirection: "column" } } }}>
      <Box sx={{ p: 2.5, pb: 1.5, display: "flex", alignItems: "flex-start", gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="h2" variant="h6">
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        <IconButton size="small" aria-label="Close" onClick={onClose} sx={{ mt: -0.5, mr: -1 }}>
          <XIcon size={18} />
        </IconButton>
      </Box>
      <Divider />
      <Box sx={{ p: 2.5, flex: 1, overflowY: "auto" }}>{children}</Box>
      <Divider />
      <Stack direction="row" spacing={1} sx={{ p: 2, justifyContent: "flex-end" }}>
        {actions ?? (
          <Button variant="contained" onClick={onClose}>
            Close
          </Button>
        )}
      </Stack>
    </Drawer>
  );
}

