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
import { Avatar, Box, Chip, Link, Paper, Stack, Typography } from "@wso2/oxygen-ui";
import { BriefcaseIcon, HandshakeIcon, MailIcon, RepeatIcon } from "@wso2/oxygen-ui-icons-react";
import type { ContactRole, QuoteSheet, SheetContact } from "@features/sales/cado2/quotes/sheet/sheetModel";
import { initialsOfName as initialsFor } from "@features/sales/cado2/utils/initials";

const ROLE_LABEL: Record<ContactRole, string> = {
  BILLING: "Billing contact",
  SECURITY: "Security contact",
};
const ROLE_COLOR: Record<ContactRole, "secondary" | "info"> = {
  BILLING: "secondary",
  SECURITY: "info",
};

function ContactCard({ role, contact }: { role: ContactRole; contact: SheetContact | null }): JSX.Element {
  if (!contact) {
    return (
      <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 2, borderStyle: "dashed" }} aria-label={ROLE_LABEL[role]}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar sx={{ width: 40, height: 40, bgcolor: "action.disabledBackground", color: "text.disabled" }}>–</Avatar>
          <Box>
            <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.4, display: "block" }}>
              {ROLE_LABEL[role]}
            </Typography>
            <Typography variant="body2" color="text.disabled" sx={{ fontStyle: "italic" }}>
              {role === "SECURITY" ? "Not set (optional)" : "Not set yet"}
            </Typography>
          </Box>
        </Stack>
      </Paper>
    );
  }
  return (
    <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 2, minWidth: 0 }} aria-label={ROLE_LABEL[role]}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Avatar sx={{ width: 40, height: 40, bgcolor: `${ROLE_COLOR[role]}.main`, color: `${ROLE_COLOR[role]}.contrastText`, fontSize: 15 }}>
          {initialsFor(contact.name)}
        </Avatar>
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.4, display: "block" }}>
            {ROLE_LABEL[role]}
          </Typography>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }} noWrap title={contact.name}>
            {contact.name}
          </Typography>
          {contact.title ? (
            <Typography variant="caption" color="text.secondary" display="block" noWrap>
              {contact.title}
            </Typography>
          ) : null}
          {contact.email ? (
            <Link href={`mailto:${contact.email}`} variant="caption" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, mt: 0.25, maxWidth: "100%" }}>
              <MailIcon size={12} />
              <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {contact.email}
              </Box>
            </Link>
          ) : null}
          <Box sx={{ mt: 0.75 }}>
            <Chip size="small" variant="outlined" label={contact.source === "MANUAL" ? "Typed in" : "Salesforce"} />
          </Box>
        </Box>
      </Stack>
    </Paper>
  );
}

/** Who the quote is for: account, opportunity, partner and the three contacts, up front. */
export default function CustomerBand({ sheet }: { sheet: QuoteSheet }): JSX.Element {
  const partner = sheet.dealType === "PARTNER" ? sheet.partner : null;
  return (
    <Paper
      component="section"
      aria-label="Customer"
      variant="outlined"
      sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, borderLeft: 4, borderLeftColor: "primary.main", minWidth: 0 }}
    >
      <Stack direction={{ xs: "column", md: "row" }} spacing={3} justifyContent="space-between">
        <Stack direction="row" spacing={2} alignItems="center" sx={{ minWidth: 0 }}>
          <Avatar sx={{ width: 56, height: 56, bgcolor: "primary.main", color: "primary.contrastText", fontSize: 22, fontWeight: 600 }}>
            {initialsFor(sheet.accountName || "?")}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" component="p" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {sheet.accountName || "No account yet"}
            </Typography>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.5, color: "text.secondary" }}>
              <BriefcaseIcon size={14} />
              <Typography variant="body2">{sheet.opportunityName || "No opportunity yet"}</Typography>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap", rowGap: 1 }}>
              {sheet.dealType ? (
                <Chip size="small" color="primary" label={sheet.dealType === "PARTNER" ? "Partner deal" : "Direct deal"} />
              ) : (
                <Chip size="small" color="warning" variant="outlined" label="Deal type unknown" />
              )}
              <Chip
                size="small"
                variant="outlined"
                icon={sheet.isRenewal ? <RepeatIcon size={12} /> : undefined}
                label={
                  sheet.isRenewal
                    ? `Renewal of ${sheet.previousOpportunityCount} opportunit${sheet.previousOpportunityCount === 1 ? "y" : "ies"}`
                    : "New business"
                }
              />
              {sheet.currency ? <Chip size="small" variant="outlined" label={sheet.currency} /> : null}
            </Stack>
          </Box>
        </Stack>
        {partner ? (
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
            <Avatar sx={{ width: 44, height: 44, bgcolor: "secondary.main", color: "secondary.contrastText" }}>
              <HandshakeIcon size={20} />
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.4, display: "block" }}>
                Sold through
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {partner.name}
              </Typography>
              {partner.role ? (
                <Typography variant="caption" color="text.secondary">
                  {partner.role}
                </Typography>
              ) : null}
            </Box>
          </Stack>
        ) : null}
      </Stack>
      <Box
        sx={{ mt: 3, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0,1fr))" }, gap: 1.5 }}
      >
        <ContactCard role="BILLING" contact={sheet.contacts[0]} />
        <ContactCard role="SECURITY" contact={sheet.contacts[1]} />
      </Box>
    </Paper>
  );
}
