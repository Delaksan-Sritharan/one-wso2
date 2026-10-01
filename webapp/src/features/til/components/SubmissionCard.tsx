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
import { Box, Chip, IconButton, Paper, Tooltip, Typography } from "@wso2/oxygen-ui";
import { TrashIcon } from "@wso2/oxygen-ui-icons-react";
import type { TilSubmission } from "../api/tilTypes";

// One entry in the history feed.
//
// `what` is rendered as plain text (JSX text interpolation, not
// dangerouslySetInnerHTML) — React escapes it automatically, which is the
// baseline docs/conventions.md asks for on every user-supplied value. There
// is no rich-text editor here, so DOMPurify doesn't apply; if a formatted
// version is ever added, sanitize on both write and read per that doc.
export default function SubmissionCard({
  submission,
  canDelete,
  onDelete,
  deleting,
}: {
  submission: TilSubmission;
  canDelete: boolean;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2, display: "flex", flexDirection: "column", gap: 0.75 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>
            {submission.who}
          </Typography>
          <Chip label={submission.where} size="small" variant="outlined" />
        </Box>
        {canDelete && (
          <Tooltip title="Delete this entry">
            <span>
              <IconButton size="small" onClick={onDelete} disabled={deleting} aria-label="Delete entry">
                <TrashIcon size={16} />
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Box>
      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
        {submission.what}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {submission.createdAt.toLocaleString()}
      </Typography>
    </Paper>
  );
}
