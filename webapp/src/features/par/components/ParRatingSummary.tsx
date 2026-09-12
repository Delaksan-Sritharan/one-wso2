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

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Box, Button, Card, Chip, Stack, Typography } from "@wso2/oxygen-ui";
import { FileDownIcon } from "@wso2/oxygen-ui-icons-react";
import type { ParCycle, ParRating } from "../api/types";
import { decodeParComment, sanitizeParHtml } from "../util/parComment";
import { ParCommentView, ParQuestionText } from "./ParContent";
import { employeeChipLabel, pdfRatingText } from "../util/parLabels";

// The read-only view of one cycle's record from the employee's side: their
// own submitted comment, and — once the lead has shared — the lead's
// feedback (rating, special rating, shared-by, comment), plus a PDF export.
// Mirrors par-app's EmployeePar.tsx. Used by both the locked self-review
// tab and History's detail view.
export default function ParRatingSummary({
  cycle,
  rating,
}: {
  cycle: Pick<ParCycle, "parCycleConfigurations">;
  rating: ParRating;
}) {
  const selfComment = decodeParComment(rating.parEmployeeComment);
  // Presence, not parLeadStatus, is the visibility rule here: the backend's
  // sanitizeParRatingForSelf strips these three fields from the response
  // entirely while the lead's status is PENDING/DRAFT, so a lead comment
  // showing up at all already means it was shared.
  const leadShared = Boolean(rating.parLeadComment || rating.parRating);
  const leadComment = decodeParComment(rating.parLeadComment);

  return (
    <Stack spacing={1.75}>
      <Card variant="outlined" sx={{ p: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
          <ParQuestionText
            html={cycle.parCycleConfigurations?.employeeParQuestion}
            fallback="Employee feedback"
          />
          <Button
            size="small"
            variant="outlined"
            startIcon={<FileDownIcon size={14} />}
            onClick={() => downloadParPdf(rating, selfComment, leadComment)}
            sx={{ flexShrink: 0, ml: 1.5 }}
          >
            Download PDF
          </Button>
        </Box>
        <ParCommentView html={selfComment} />
      </Card>

      {leadShared && (
        <Card variant="outlined" sx={{ p: 2 }}>
          <Typography sx={{ fontWeight: 600, mb: 1 }}>Lead's feedback</Typography>
          <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: "wrap" }}>
            {rating.parRating && (
              <Chip size="small" color={employeeChipLabel(rating.parRating).color} label={`PAR rating: ${employeeChipLabel(rating.parRating).label}`} />
            )}
            {rating.parSpecialRating && (
              <Chip size="small" variant="outlined" color={employeeChipLabel(rating.parSpecialRating).color} label={employeeChipLabel(rating.parSpecialRating).label} />
            )}
            {rating.parRatingSharedBy && (
              <Chip size="small" variant="outlined" label={`Shared by ${rating.parRatingSharedBy}`} />
            )}
          </Stack>
          <ParCommentView html={leadComment} />
        </Card>
      )}
    </Stack>
  );
}

// Ports par-app's EmployeePar.tsx downloadPDF/formatCommentForPDF: a
// two-column table under a header naming the employee, their PAR rating,
// special rating and who shared it. No employee-name lookup is available
// here, so email addresses stand in, same as "Shared by" above.
function downloadParPdf(rating: ParRating, selfComment: string, leadComment: string): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  const rows: (string | { content: string; styles: Record<string, unknown> })[][] = [];
  if (selfComment) {
    rows.push([
      "Employee Comment",
      "",
      { content: htmlToPdfText(selfComment), styles: { textColor: [50, 50, 50], cellPadding: 6 } },
    ]);
  }
  if (leadComment) {
    rows.push([
      "Lead Comment",
      "",
      { content: htmlToPdfText(leadComment), styles: { textColor: [50, 50, 50], cellPadding: 6 } },
    ]);
  }

  autoTable(doc, {
    head: [
      [
        {
          content:
            ` - Employee: ${rating.parEmployeeEmail}\n` +
            ` - PAR Rating: ${pdfRatingText(rating.parRating)}\n` +
            ` - Top 5%/20% Rating: ${pdfRatingText(rating.parSpecialRating)}\n` +
            ` - PAR Shared By: ${rating.parRatingSharedBy || "Not Provided"}`,
          colSpan: 3,
          styles: { halign: "left", fontSize: 12, cellPadding: 10 },
        },
      ],
    ],
    showHead: "firstPage",
    body: rows,
    startY: 30,
    styles: { fontSize: 9, cellPadding: 4, overflow: "linebreak", valign: "top" },
    columnStyles: { 0: { cellWidth: 120 }, 1: { cellWidth: 60 }, 2: { cellWidth: "auto" } },
  });

  doc.save(`${rating.parEmployeeEmail}_par_summary.pdf`);
}

// Converts sanitized comment HTML into indented plain text for the PDF body
// — lists become "•"/"1." lines, matching what the rich-text editor showed.
function htmlToPdfText(html: string): string {
  const root = document.createElement("div");
  root.innerHTML = sanitizeParHtml(html);

  const walk = (el: Element, depth: number): string => {
    const indent = "    ".repeat(depth);
    if (el.tagName === "UL" || el.tagName === "OL") {
      const ordered = el.tagName === "OL";
      return Array.from(el.children)
        .map((li, i) => `${indent}${ordered ? `${i + 1}.` : "•"} ${walk(li, depth + 1).trim()}\n`)
        .join("");
    }
    if (el.children.length > 0) {
      return Array.from(el.children)
        .map((child) => walk(child, depth))
        .join("");
    }
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    return text ? `${text}\n` : "";
  };

  const text = walk(root, 0)
    .split("\n")
    .map((line) => (line.trim() ? `    ${line}` : line))
    .join("\n")
    .trim();
  return text || "-";
}
