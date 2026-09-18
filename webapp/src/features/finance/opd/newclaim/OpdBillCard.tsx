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

import { Box, Card, IconButton, Stack, Tooltip, Typography } from "@wso2/oxygen-ui";
import { EyeIcon, PencilIcon, Trash2Icon } from "@wso2/oxygen-ui-icons-react";
import { money, formatNice } from "../../util/financeFormat";
import type { OpdTransaction } from "../opdTypes";

/**
 * One bill in the claim being written.
 *
 * `components/claim/ClaimItemCard.tsx` — a card per bill rather than a table
 * row. The existing OPD form lists bills as one-line rows and says only whether
 * a receipt is attached, so the one thing worth checking before submitting —
 * that the right file went on the right bill — cannot be checked.
 *
 * Three actions are icons in the header: the one that opens the receipt
 * first, then the two that change the bill, with the destructive one last
 * rather than between two safe ones. Icons alone would be a row of unlabelled
 * glyphs, so each carries a tooltip AND an aria-label naming its bill — with
 * several cards on screen, "Edit" on its own leaves a screen reader reciting
 * identical buttons.
 *
 * One receipt button, not a view/download pair: `ReceiptViewer` already
 * carries a Download in its own footer, so a second icon here bought a click
 * at the cost of a fourth glyph on every card. Its tooltip names both, so the
 * download is not hidden behind an icon that only promises a preview.
 */
export function OpdBillCard({
  index,
  bill,
  onView,
  onEdit,
  onRemove,
}: {
  index: number;
  bill: OpdTransaction;
  onView: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const label = `OPD ITEM ${index + 1}`;
  return (
    // `flexShrink: 0` is load-bearing: the list is a flex column with a capped
    // height, and a flex child shrinks to fit by default — so without this each
    // card is squeezed thinner as bills are added instead of the list
    // scrolling. Ten bills would end up ten slivers.
    <Card variant="outlined" sx={{ p: 2, flexShrink: 0 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Typography sx={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.02em" }}>
          {label}
        </Typography>

        <Stack direction="row" spacing={0.25} alignItems="center" sx={{ flexShrink: 0 }}>
          {/* Absent rather than disabled when there is nothing to open. The
              form requires a receipt, but a draft restored from older data can
              carry a bill without one. */}
          {bill.receiptUrl && (
            <Tooltip title="View or download receipt">
              <IconButton
                size="small"
                aria-label={`View or download receipt for ${label}`}
                onClick={onView}
              >
                <EyeIcon size={16} />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Edit">
            <IconButton size="small" aria-label={`Edit ${label}`} onClick={onEdit}>
              <PencilIcon size={16} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Remove">
            <IconButton
              size="small"
              color="error"
              aria-label={`Remove ${label}`}
              onClick={onRemove}
            >
              <Trash2Icon size={16} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "auto 1fr auto" },
          gap: 2,
          alignItems: "start",
          mt: 1.5,
        }}
      >
        <Field label="Bill Date" value={formatNice(bill.date)} />
        <Field label="Description" value={bill.comment || "—"} />
        <Box sx={{ justifySelf: { sm: "end" }, textAlign: { sm: "right" } }}>
          <FieldLabel>Amount</FieldLabel>
          <Typography
            sx={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums", mt: 0.25 }}
          >
            {money(bill.amount)}
          </Typography>
        </Box>
      </Box>
    </Card>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      sx={{
        fontSize: 10.5,
        color: "text.secondary",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}
    >
      {children}
    </Typography>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <FieldLabel>{label}</FieldLabel>
      <Typography sx={{ fontSize: 13.5, mt: 0.25, overflowWrap: "anywhere" }}>{value}</Typography>
    </Box>
  );
}
