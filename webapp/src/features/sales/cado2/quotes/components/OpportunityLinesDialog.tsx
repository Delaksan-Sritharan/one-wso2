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

import type { JSX } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useOpportunityLines } from "@features/sales/cado2/quotes/api/useQuoteApi";
import { formatDate } from "@features/sales/cado2/quotes/form/draftForm";
import { formatMoney } from "@features/sales/cado2/utils/money";

interface OpportunityLinesDialogProps {
  readonly open: boolean;
  readonly opportunityId: string | null;
  readonly opportunityName: string;
  readonly onClose: () => void;
}

/** A percentage from Salesforce, "25" → "25%"; a dash when it has none. */
function percent(value: string | null): string {
  return value ? `${value}%` : "—";
}

/**
 * "View SF line items" (D147): the opportunity's product lines as they are in
 * Salesforce now, read fresh each time it opens. Read only: the AM adds
 * products to the quote themselves.
 */
export default function OpportunityLinesDialog({
  open,
  opportunityId,
  opportunityName,
  onClose,
}: OpportunityLinesDialogProps): JSX.Element {
  const data = useOpportunityLines(opportunityId, open);
  const lines = data.data?.lines ?? [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Line items in Salesforce
        {opportunityName ? (
          <Typography variant="body2" color="text.secondary" component="span" sx={{ display: "block" }}>
            {opportunityName}
          </Typography>
        ) : null}
      </DialogTitle>
      <DialogContent>
        {data.isPending ? (
          <Typography variant="body2" color="text.secondary">
            Reading the opportunity in Salesforce…
          </Typography>
        ) : data.error ? (
          <ErrorNotice error={data.error} onRetry={() => void data.refetch()} retrying={data.isFetching}>
            Couldn&apos;t read the line items from Salesforce.
          </ErrorNotice>
        ) : lines.length === 0 ? (
          <Paper variant="outlined" sx={{ p: 2, textAlign: "center", borderStyle: "dashed" }}>
            <Typography variant="body2" color="text.secondary">
              No line items on this opportunity in Salesforce.
            </Typography>
          </Paper>
        ) : (
          <>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small" sx={{ minWidth: 780 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Product</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Sales price</TableCell>
                    <TableCell align="right">Discount</TableCell>
                    <TableCell align="right">Total price</TableCell>
                    <TableCell align="right">Commission %</TableCell>
                    <TableCell>Service start</TableCell>
                    <TableCell>Service end</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lines.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        {l.productName ?? "—"}
                        {l.productCode ? (
                          <Typography variant="caption" color="text.secondary" component="div">
                            {l.productCode}
                          </Typography>
                        ) : null}
                      </TableCell>
                      <TableCell align="right">{formatMoney(l.quantity)}</TableCell>
                      <TableCell align="right">{formatMoney(l.salesPrice)}</TableCell>
                      <TableCell align="right">{percent(l.discount)}</TableCell>
                      <TableCell align="right">{formatMoney(l.totalPrice)}</TableCell>
                      <TableCell align="right">{percent(l.commissionPercent)}</TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDate(l.serviceStartDate)}</TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDate(l.serviceEndDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.75 }}>
              Prices in {data.data?.currency ?? "the opportunity's currency"}. Sales price is per unit; Total price is the
              whole line, after discount.
            </Typography>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
