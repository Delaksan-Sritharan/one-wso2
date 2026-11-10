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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import type { JSX } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { CircleAlertIcon, CircleCheckIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useOpportunityLines } from "@features/sales/cado2/quotes/api/useQuoteApi";
import type { LineProblem, OpportunityLineLoad, RenewalCheck } from "@features/sales/cado2/quotes/api/quoteTypes";
import { formatDate } from "@features/sales/cado2/quotes/form/draftForm";
import { formatMoney } from "@features/sales/cado2/utils/money";

interface OpportunityLinesDialogProps {
  readonly open: boolean;
  readonly opportunityId: string | null;
  readonly opportunityName: string;
  /** The quote's price book and currency: the lines are checked against them (D150). */
  readonly pricebookId: string;
  readonly currency: string;
  /** The products already on the quote, which loading replaces. */
  readonly productCount: number;
  /** Load every line into the quote; only when all pass. */
  readonly onLoad: (lines: OpportunityLineLoad[], check: RenewalCheck) => void;
  readonly onClose: () => void;
}

/** A percentage from Salesforce, "25" → "25%"; a dash when it has none. */
function percent(value: string | null): string {
  return value ? `${value}%` : "—";
}

const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

/** Every problem's full sentence, for a tooltip. */
function details(problems: readonly LineProblem[]): JSX.Element {
  return (
    <Box component="ul" sx={{ m: 0, pl: 2 }}>
      {problems.map((p) => (
        <li key={p.detail}>{p.detail}</li>
      ))}
    </Box>
  );
}

/** A line's check at a glance: ✓, or ⚠ and its first problem's short label. */
function LineStatus({ problems }: { problems: readonly LineProblem[] }): JSX.Element {
  if (problems.length === 0) {
    return (
      <Box component="span" aria-label="OK" sx={{ color: "success.main", display: "inline-flex" }}>
        <CircleCheckIcon size={16} />
      </Box>
    );
  }
  return (
    <Tooltip title={details(problems)}>
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: "warning.dark", whiteSpace: "nowrap" }}>
        <CircleAlertIcon size={15} aria-hidden />
        <Typography variant="caption" sx={{ fontWeight: 600 }}>
          {problems[0].short}
          {problems.length > 1 ? ` +${problems.length - 1}` : ""}
        </Typography>
      </Stack>
    </Tooltip>
  );
}

/**
 * "Import renewal products" on an auto-generated renewal (D147, D150): the line
 * items Salesforce copied from last year, read fresh each time it opens and
 * checked against the quote's price book. Clean, they load in one go; if not,
 * one line says why, each failing line shows a short reason, and the AM adds
 * the products by hand.
 */
export default function OpportunityLinesDialog({
  open,
  opportunityId,
  opportunityName,
  pricebookId,
  currency,
  productCount,
  onLoad,
  onClose,
}: OpportunityLinesDialogProps): JSX.Element {
  const data = useOpportunityLines(opportunityId, open, { pricebookId, currency });
  const lines = data.data?.lines ?? [];
  const check = data.data?.check ?? null;
  const failing = lines.filter((l) => (l.problems ?? []).length > 0).length;
  // Why it can't load, in one line: the opportunity's problems, then how many lines need fixing.
  const reasons = [...(check?.problems ?? []).map((p) => p.short), ...(failing ? [`${plural(failing, "line needs", "lines need")} fixing`] : [])];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        Import renewal products from Salesforce
        {opportunityName ? (
          <Typography variant="body2" color="text.secondary" component="span" sx={{ display: "block" }}>
            {opportunityName} · prices in {data.data?.currency ?? "the opportunity's currency"}
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
          <Stack spacing={1.25}>
            {check ? (
              check.canLoad ? (
                <Stack direction="row" spacing={1} alignItems="center" aria-label="Status" sx={{ color: "success.main" }}>
                  <CircleCheckIcon size={18} aria-hidden />
                  <Typography variant="body2" color="text.primary">
                    <b>Ready to load.</b> {lines.length === 1 ? "The line matches" : `All ${lines.length} lines match`} the
                    quote&apos;s price book and term.
                  </Typography>
                </Stack>
              ) : (
                <Tooltip title={check.problems.length ? details(check.problems) : ""} placement="bottom-start">
                  <Stack direction="row" spacing={1} alignItems="center" aria-label="Status" sx={{ color: "warning.dark" }}>
                    <CircleAlertIcon size={18} aria-hidden />
                    <Typography variant="body2" color="text.primary">
                      <b>Can&apos;t load automatically:</b> {reasons.join("; ")}. Add the products by hand.
                    </Typography>
                  </Stack>
                </Tooltip>
              )
            ) : null}
            <TableContainer component={Paper} variant="outlined">
              <Table size="small" sx={{ minWidth: 900 }} aria-label="Salesforce line items">
                <TableHead>
                  <TableRow>
                    {check ? <TableCell sx={{ width: 150 }}>Check</TableCell> : null}
                    <TableCell>Product</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Sales price</TableCell>
                    <TableCell align="right">Discount</TableCell>
                    <TableCell align="right">Total price</TableCell>
                    <TableCell>Service start</TableCell>
                    <TableCell>Service end</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lines.map((l) => (
                    <TableRow key={l.id}>
                      {check ? (
                        <TableCell>
                          <LineStatus problems={l.problems ?? []} />
                        </TableCell>
                      ) : null}
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
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDate(l.serviceStartDate)}</TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDate(l.serviceEndDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {check?.canLoad && productCount > 0 ? (
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mr: "auto", pl: 1, color: "warning.dark" }}>
            <CircleAlertIcon size={15} aria-hidden />
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              Replaces the {plural(productCount, "product", "products")} already on this quote.
            </Typography>
          </Stack>
        ) : null}
        <Button onClick={onClose}>Close</Button>
        {check ? (
          <Button
            variant="contained"
            disabled={!check.canLoad}
            onClick={() => onLoad(lines.map((l) => l.load).filter((l): l is OpportunityLineLoad => l !== null), check)}
          >
            Load into quote
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
