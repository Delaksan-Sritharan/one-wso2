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
import { Box, Paper, Stack, Typography } from "@wso2/oxygen-ui";
import { FileTextIcon, MapPinIcon, MessageSquareTextIcon } from "@wso2/oxygen-ui-icons-react";
import type { QuoteSheet, SheetAddress } from "@features/sales/cado2/quotes/sheet/sheetModel";
import SheetCard, { Fact, FactGrid } from "@features/sales/cado2/components/section-card/SectionCard";

function TextBlock({ children }: { children: ReactNode }): JSX.Element {
  return (
    <Box sx={{ mt: 0.5, pl: 1.5, borderLeft: 3, borderColor: "divider", whiteSpace: "pre-wrap" }}>
      <Typography variant="body2">{children}</Typography>
    </Box>
  );
}

/** Payment terms, PO, and any special or governing terms. */
export function TermsSection({ sheet }: { sheet: QuoteSheet }): JSX.Element {
  return (
    <SheetCard title="Commercial terms" icon={<FileTextIcon size={18} />}>
      <FactGrid>
        <Fact
          label="Payment terms"
          value={sheet.netTermsDays ? `Net ${sheet.netTermsDays}` : ""}
          hint={sheet.netTermsDays ? `Due ${sheet.netTermsDays} days after the invoice` : undefined}
        />
        <Fact label="PO number" value={sheet.poNumber ?? "None"} />
      </FactGrid>
      <Stack spacing={2} sx={{ mt: 2.5 }}>
        <Box>
          <Typography variant="overline" color="text.secondary">
            Special terms
          </Typography>
          {sheet.specialTerms ? <TextBlock>{sheet.specialTerms}</TextBlock> : <Typography variant="body2">None</Typography>}
        </Box>
        <Box>
          <Typography variant="overline" color="text.secondary">
            Governing terms
          </Typography>
          {sheet.governingTerms ? (
            <TextBlock>{sheet.governingTerms}</TextBlock>
          ) : (
            <Typography variant="body2">WSO2 standard terms</Typography>
          )}
        </Box>
      </Stack>
    </SheetCard>
  );
}

function AddressCard({ title, address, note }: { title: string; address: SheetAddress | null; note?: string }): JSX.Element {
  return (
    <Paper variant="outlined" aria-label={title} sx={{ p: 2, borderRadius: 2, minWidth: 0, height: "100%" }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, color: "text.secondary" }}>
        <MapPinIcon size={14} />
        <Typography variant="overline" sx={{ lineHeight: 1.4 }}>
          {title}
        </Typography>
      </Stack>
      {note ? (
        <Typography variant="body2">{note}</Typography>
      ) : !address ? (
        <Typography variant="body2" color="text.disabled" sx={{ fontStyle: "italic" }}>
          Not set yet
        </Typography>
      ) : (
        <>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {address.companyName}
          </Typography>
          {address.lines.map((l) => (
            <Typography key={l} variant="body2" color="text.secondary">
              {l}
            </Typography>
          ))}
          {address.taxId ? (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.75 }}>
              Tax ID {address.taxId}
            </Typography>
          ) : null}
        </>
      )}
    </Paper>
  );
}

/** Bill to and ship to, side by side. */
export function AddressesSection({ sheet }: { sheet: QuoteSheet }): JSX.Element {
  return (
    <SheetCard title="Addresses" icon={<MapPinIcon size={18} />}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0,1fr))" }, gap: 1.5 }}>
        <AddressCard title="Bill to" address={sheet.billTo} />
        <AddressCard title="Ship to" address={sheet.shipTo} note={sheet.shipToSameAsBillTo ? "Same as bill to" : undefined} />
      </Box>
    </SheetCard>
  );
}

/** The rep's justification for approvers. */
export function JustificationSection({ sheet }: { sheet: QuoteSheet }): JSX.Element {
  return (
    <SheetCard title="Justification" icon={<MessageSquareTextIcon size={18} />}>
      {sheet.justification ? (
        <TextBlock>{sheet.justification}</TextBlock>
      ) : (
        <Typography variant="body2" color="text.disabled" sx={{ fontStyle: "italic" }}>
          None given
        </Typography>
      )}
    </SheetCard>
  );
}
