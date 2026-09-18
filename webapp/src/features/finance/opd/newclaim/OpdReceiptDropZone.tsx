/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { useRef, useState } from "react";
import { Box, CircularProgress, IconButton, Link, Stack, Typography } from "@wso2/oxygen-ui";
import { FileTextIcon, UploadIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import { OPD_RECEIPT_MAX_BYTES, RECEIPT_ACCEPT, maxSizeLabel } from "../../util/financeReceipts";
import { OPD_COPY } from "./opdNewClaim";

/** `FileUploadArea.tsx:114-126` — the extension decides, not the browser's guess. */
const ALLOWED = ["jpg", "jpeg", "png", "pdf"];

function isAllowed(file: File): boolean {
  return ALLOWED.includes(file.name.toLowerCase().split(".").pop() ?? "");
}

/**
 * Where a bill's receipt is dropped or chosen.
 *
 * `components/input-fields/FileUploadArea.tsx`. The existing OPD form has a
 * plain "Upload receipt" button behind a hidden input, so a drop does nothing
 * — which is the interaction the source leads with.
 *
 * Not `CcStatementDropZone`: that one's accept list, its guard and its copy are
 * all CSV, and it has no size check at all. The drag handling and the
 * keyboard activation are the same shape, deliberately.
 *
 * Both checks live here rather than on the input's `accept`, which filters the
 * picker's default view and nothing else — a drop bypasses it entirely.
 */
export function OpdReceiptDropZone({
  fileName,
  uploading,
  disabled,
  onPick,
  onClear,
}: {
  /** The name the backend gave the stored receipt, once uploaded. */
  fileName: string | null;
  uploading: boolean;
  disabled?: boolean;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  const take = (picked: File | undefined) => {
    if (!picked) return;
    if (!isAllowed(picked)) {
      setError(OPD_COPY.badFileType);
      return;
    }
    if (picked.size > OPD_RECEIPT_MAX_BYTES) {
      // The source compresses an oversized image instead of refusing it
      // (`FileUploadArea.tsx:9` pulls in browser-image-compression). We do not
      // carry that dependency, so the limit is enforced plainly and the
      // message says what to do about it.
      setError(`Receipt must be ${maxSizeLabel(OPD_RECEIPT_MAX_BYTES)} or smaller.`);
      return;
    }
    setError("");
    onPick(picked);
  };

  if (fileName) {
    return (
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={1.5}
        sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 1.5, p: 1.5 }}
      >
        <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
          <FileTextIcon size={22} style={{ flexShrink: 0 }} />
          <Typography
            sx={{
              fontSize: 13.5,
              // A stored receipt name is a GUID-laden mouthful; it is identity,
              // not something to read, so it truncates rather than wrapping to
              // three lines and pushing the dialog's buttons off screen.
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={fileName}
          >
            {fileName}
          </Typography>
        </Stack>
        <IconButton size="small" aria-label="Remove receipt" onClick={onClear} disabled={disabled}>
          <XIcon size={16} />
        </IconButton>
      </Stack>
    );
  }

  return (
    <Box>
      <Box
        role="button"
        tabIndex={0}
        aria-label="Drag & drop your receipt or browse"
        aria-busy={uploading}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!uploading) take(e.dataTransfer.files?.[0]);
        }}
        onClick={() => {
          if (!uploading) input.current?.click();
        }}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !uploading) input.current?.click();
        }}
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
          py: 3,
          px: 2,
          border: "1px dashed",
          borderColor: dragging ? "primary.main" : "divider",
          borderRadius: 1.5,
          bgcolor: dragging ? "action.hover" : "transparent",
          cursor: uploading ? "default" : "pointer",
          opacity: uploading ? 0.6 : 1,
          textAlign: "center",
        }}
      >
        <input
          ref={input}
          type="file"
          accept={RECEIPT_ACCEPT}
          onChange={(e) => {
            take(e.target.files?.[0]);
            // Cleared so choosing the same file twice in a row still fires a
            // change event — after a failed upload that is exactly what
            // someone does.
            if (input.current) input.current.value = "";
          }}
          style={{ display: "none" }}
        />
        {uploading ? (
          <CircularProgress size={22} />
        ) : (
          <UploadIcon size={22} style={{ opacity: 0.7 }} />
        )}
        <Typography sx={{ fontSize: 13.5, color: "text.secondary" }}>
          {uploading ? (
            "Uploading…"
          ) : dragging ? (
            "Drop your receipt here"
          ) : (
            <>
              Drag &amp; drop your receipt or{" "}
              {/* A link, as the source has it, but the whole zone is the
                  control — so this is presentational and must not be a second
                  tab stop inside a button. */}
              <Link component="span" underline="always" sx={{ cursor: "pointer" }}>
                browse
              </Link>
            </>
          )}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: 11.5, color: "text.secondary", mt: 0.75 }}>
        JPG, PNG or PDF, file size no more than {maxSizeLabel(OPD_RECEIPT_MAX_BYTES)}
      </Typography>
      {error && (
        <Typography sx={{ fontSize: 12.5, color: "error.main", mt: 0.5 }}>{error}</Typography>
      )}
    </Box>
  );
}
