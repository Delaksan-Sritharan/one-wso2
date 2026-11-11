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

import { useId, useState, type JSX } from "react";
import { useSearchParams } from "react-router";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CircularProgress,
  Divider,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@wso2/oxygen-ui";
import { DownloadIcon } from "@wso2/oxygen-ui-icons-react";
import { pdf } from "@react-pdf/renderer";
import PerspectiveHeader from "@components/perspective-header/PerspectiveHeader";
import { isLegalBackendConfigured } from "@config/apiConfig";
import { useCustomerSearch, formatCustomerAddress, type CustomerResult } from "@features/legal/api/useCustomerSearch";
import { useNdaAccess } from "@features/legal/api/useNdaAccess";
import { useRecordNda } from "@features/legal/api/useNdaRecords";
import ManualCounterpartyFields from "@features/legal/components/ManualCounterpartyFields";
import { ACCESS_UNKNOWN_MESSAGE, recordFailureMessage } from "@features/legal/recordErrors";
import NdaRecordsTable from "@features/legal/components/NdaRecordsTable";
import { countryName } from "@features/legal/countries";
import { downloadHint } from "@features/legal/downloadHint";
import { ndaFileNamePart } from "@features/legal/fileName";
import {
  EMPTY_MANUAL_COUNTERPARTY,
  isManualCounterpartyComplete,
  manualCounterpartyAddress,
  type ManualCounterparty,
} from "@features/legal/manualCounterparty";
import NdaPdfDocument, { NDA_ENTITY_CONFIGS, entityForCountry } from "./NdaPdfDocument";

// How the other party is given: picked from Salesforce, or typed in for
// anyone who isn't a Salesforce customer (vendors, contractors, prospects).
type PartyMode = "salesforce" | "manual";

// ── Static option lists ─────────────────────────────────────────────────────

// Only Mutual NDA — Standard is currently supported.
const NDA_TEMPLATE_LOCKED = "Mutual NDA \u2014 Standard";

// Derived from the keys of NDA_ENTITY_CONFIGS so the dropdown and the configs
// cannot drift apart. Each key corresponds to an official WSO2 NDA template docx.
// "WSO2 LLC — US" is labelled "WSO2 LLC (US)".
const WSO2_COMPANIES: { value: string; label: string }[] = Object.keys(NDA_ENTITY_CONFIGS).map((value) => ({
  value,
  label: value.replace(/ \u2014 (\w+)$/, " ($1)"),
}));

// ── Helpers ─────────────────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: string | null | undefined }): JSX.Element | null {
  if (!value) return null;
  return (
    <Box sx={{ display: "flex", gap: 2 }}>
      <Typography variant="body2" sx={{ color: "text.secondary", minWidth: 120, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Box>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function NdaPage(): JSX.Element {
  const [template] = useState(NDA_TEMPLATE_LOCKED);
  const [wso2Company, setWso2Company] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null);
  const [customerInput, setCustomerInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [snack, setSnack] = useState<{
    open: boolean;
    severity: "success" | "error";
    message: string;
  }>({ open: false, severity: "success", message: "" });

  const [partyMode, setPartyMode] = useState<PartyMode>("salesforce");
  const [manualParty, setManualParty] = useState<ManualCounterparty>(EMPTY_MANUAL_COUNTERPARTY);

  const {
    data: customerOptions = [],
    isFetching: searchingCustomers,
    isError: searchFailed,
  } = useCustomerSearch(customerInput);
  // The search list's open state is ours, so a failed search can keep it
  // closed: open, it would cover the warning below the field (which offers
  // manual entry) with a one-line copy of the same message.
  const [customerListOpen, setCustomerListOpen] = useState(false);
  const downloadHintId = useId();

  // Only the groups the legal backend allows (Sales and Legal) may pick the
  // other party from Salesforce; everyone else enters it by hand. Until the
  // answer arrives nothing is shown, so a Sales user isn't flashed the
  // manual form first.
  const access = useNdaAccess();
  const checkingAccess = isLegalBackendConfigured() && access.isPending;
  const canSearchSalesforce = access.data?.canSearchSalesforce === true;

  // The Legal team also gets an "NDA Records" tab (?tab=records): every NDA
  // generated, by whom, for which counterparty and when. The backend refuses
  // the list to anyone else; this only decides whether to offer the tab.
  const canViewRecords = access.data?.canViewNdaRecords === true;
  const [searchParams, setSearchParams] = useSearchParams();
  const showRecords = canViewRecords && searchParams.get("tab") === "records";
  const recordNda = useRecordNda();

  // The other party as the NDA will show it, from whichever mode is active.
  const isManual = !canSearchSalesforce || partyMode === "manual";
  const partyName = isManual ? manualParty.name.trim() : (selectedCustomer?.name ?? "");
  const partyAddress = formatCustomerAddress(
    isManual ? manualCounterpartyAddress(manualParty) : (selectedCustomer?.address ?? null),
  );
  const partyCountry = isManual
    ? (manualParty.countryCode ? countryName(manualParty.countryCode) : "")
    : (selectedCustomer?.address?.billingCountry ?? "");
  const partyReady = isManual ? isManualCounterpartyComplete(manualParty) : selectedCustomer !== null;

  const allFilled = Boolean(template && wso2Company && partyReady);
  const missingHint = checkingAccess
    ? null
    : downloadHint({
        isManual,
        manualParty,
        hasCustomer: selectedCustomer !== null,
        hasCountry: Boolean(partyCountry),
        hasWso2Company: Boolean(wso2Company),
      });

  // Switching mode re-derives the entity from that mode's party, so the
  // governing law never stays behind from the other mode's country.
  const handlePartyModeChange = (next: PartyMode) => {
    setPartyMode(next);
    if (next === "manual") {
      setWso2Company(manualParty.countryCode ? entityForCountry(manualParty.countryCode) : "");
    } else {
      setWso2Company(selectedCustomer ? entityForCountry(selectedCustomer.address?.billingCountry) : "");
    }
  };

  const handleManualPartyChange = (next: ManualCounterparty) => {
    // The entity follows the country, and stays editable, as for a Salesforce customer.
    if (next.countryCode !== manualParty.countryCode) {
      setWso2Company(next.countryCode ? entityForCountry(next.countryCode) : "");
    }
    setManualParty(next);
  };

  const handleDownload = async () => {
    setGenerating(true);
    try {
      // Whether this NDA must be recorded comes from GET /me. If that check
      // failed, ask again rather than download unrecorded; if it still can't
      // answer, download nothing. Manual entry stays usable meanwhile.
      let accessData = access.data;
      if (!accessData && isLegalBackendConfigured()) {
        accessData = (await access.refetch()).data;
        if (!accessData) {
          setSnack({ open: true, severity: "error", message: ACCESS_UNKNOWN_MESSAGE });
          return;
        }
      }
      const recordsEnabled = accessData?.ndaRecordsEnabled === true;

      const customerName = partyName;
      const customerAddress = partyAddress;
      const now = new Date();
      const effectiveDate = now.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const blob = await pdf(
        <NdaPdfDocument
          template={template}
          wso2Company={wso2Company}
          customerName={customerName}
          customerAddress={customerAddress}
          effectiveDate={effectiveDate}
          notes=""
          year={now.getFullYear()}
        />,
      ).toBlob();

      // Record only once the PDF exists, so a PDF that fails to build leaves
      // no record behind; download only once it is recorded, so every
      // downloaded NDA is in the Legal team's records when they are on.
      if (recordsEnabled) {
        try {
          await recordNda.mutateAsync({
            template,
            wso2Entity: wso2Company,
            counterpartyName: partyName,
            counterpartyAddress: partyAddress,
            counterpartyCountry: partyCountry,
            source: isManual ? "manual" : "salesforce",
            salesforceAccountId: isManual ? null : (selectedCustomer?.id ?? null),
          });
        } catch (err) {
          setSnack({ open: true, severity: "error", message: recordFailureMessage(err) });
          return;
        }
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `NDA-${ndaFileNamePart(customerName)}-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 100);

setSnack({ open: true, severity: "success", message: "NDA downloaded successfully." });
    } catch {
      setSnack({ open: true, severity: "error", message: "Failed to generate PDF. Please try again." });
    } finally {
      setGenerating(false);
    }
  };

  const tabs = canViewRecords && (
    <Tabs
      value={showRecords ? "records" : "generate"}
      onChange={(_e, next: string) => setSearchParams(next === "records" ? { tab: "records" } : {}, { replace: true })}
      aria-label="NDA views"
      sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}
    >
      <Tab value="generate" label="Generate NDA" sx={{ textTransform: "none" }} />
      <Tab value="records" label="NDA Records" sx={{ textTransform: "none" }} />
    </Tabs>
  );

  // Each tab has its own subtitle, so people without the records tab never
  // read about it.
  const header = (
    <PerspectiveHeader
      title="NDA"
      subtitle={
        showRecords
          ? "View all generated NDAs."
          : "Generate WSO2's standard Mutual NDA as a PDF."
      }
    />
  );

  // A plain Box, not a flex column with a gap: PerspectiveHeader renders the
  // title and subtitle as two separate elements with their own spacing, so a
  // gap would also open up between them, and again before the tabs. Same
  // layout as the Banking page (header, tabs, then the tab's content).
  if (showRecords) {
    return (
      <Box>
        {header}
        {tabs}
        <NdaRecordsTable />
      </Box>
    );
  }

  return (
    <Box>
      {header}
      {tabs}

      <Stack spacing={3} sx={{ maxWidth: 480 }}>
        {/* NDA Template — locked to Mutual NDA Standard for now */}
        <TextField
          fullWidth
          label="NDA Template"
          value={template}
          disabled
          helperText="Only the standard Mutual NDA is available for now."
        />

        {/* Counterparty — a Salesforce customer, or details typed in by hand.
            One group with its own heading, so the WSO2 Company below reads as
            a separate field. */}
        <Stack spacing={2}>
          <Typography variant="subtitle2" component="h2" sx={{ fontWeight: 600 }}>
            Counterparty
          </Typography>
          {checkingAccess && <CircularProgress size={18} aria-label="Checking your access" />}
          {canSearchSalesforce && (
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              value={partyMode}
              onChange={(_e, next: PartyMode | null) => {
                if (next) handlePartyModeChange(next);
              }}
              aria-label="How to enter the counterparty"
            >
              <ToggleButton value="salesforce" sx={{ textTransform: "none" }}>
                Salesforce customer
              </ToggleButton>
              <ToggleButton value="manual" sx={{ textTransform: "none" }}>
                Enter details manually
              </ToggleButton>
            </ToggleButtonGroup>
          )}

          {/* Guidance before the user starts typing or searching, not after:
              the NDA uses these details exactly as given. Also the only message
              when access can't be checked: why the search is missing means
              nothing to the user, what to enter instead does. */}
          {!checkingAccess && (
            <Alert severity="info">
              {isManual
                ? "Enter the counterparty's registered legal name and address. They go into the NDA exactly as you type them, so check them first."
                : "Search by the customer's Salesforce account name. The NDA uses the name and billing address from Salesforce, so check them in the details shown."}
            </Alert>
          )}

          {isManual && !checkingAccess && (
            <>
              <ManualCounterpartyFields value={manualParty} onChange={handleManualPartyChange} />
            </>
          )}

          {/* Customer Name — server-side search via customer-search API */}
          {!isManual && (
            <Autocomplete
              fullWidth
              options={customerOptions}
              value={selectedCustomer}
              inputValue={customerInput}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              onChange={(_e, newValue) => {
                setSelectedCustomer(newValue);
                // The entity follows the customer's billing country, and stays editable.
                if (newValue) setWso2Company(entityForCountry(newValue.address?.billingCountry));
              }}
              onInputChange={(_e, newInput) => setCustomerInput(newInput)}
              open={customerListOpen && !searchFailed}
              onOpen={() => setCustomerListOpen(true)}
              onClose={() => setCustomerListOpen(false)}
              // MUI skips onClose on blur while a failed search keeps the list
              // closed, so the list would reopen once the cleared input ends the
              // error. Forget the open state whenever focus leaves.
              onBlur={() => setCustomerListOpen(false)}
              filterOptions={(x) => x}
              loading={searchingCustomers}
              loadingText="Searching…"
              noOptionsText={customerInput.length < 2 ? "Type to search customers" : "No customers found"}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Customer Name"
                  slotProps={{
                    input: {
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {searchingCustomers && <CircularProgress size={16} />}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    },
                  }}
                />
              )}
            />
          )}

          {/* A failed search must not read as "No customers found": the user
              would conclude the customer doesn't exist. */}
          {!isManual && searchFailed && (
            <Alert
              severity="warning"
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => handlePartyModeChange("manual")}
                  sx={{ textTransform: "none" }}
                >
                  Enter details manually
                </Button>
              }
            >
              Customer search isn&apos;t working right now. Try again, or enter the details manually.
            </Alert>
          )}

          {/* Customer verification card — shown once a customer is selected */}
          {!isManual && selectedCustomer && (
            <Card variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Customer details from Salesforce
                </Typography>
                <DetailRow label="Country" value={selectedCustomer.address?.billingCountry} />
                <DetailRow label="Address" value={formatCustomerAddress(selectedCustomer.address ?? null)} />
                <DetailRow label="Region" value={selectedCustomer.subRegion} />
                <DetailRow label="Industry" value={selectedCustomer.subIndustry} />
              </Stack>
            </Card>
          )}
        </Stack>

        <Divider />

        {/* WSO2 Company — one option per official NDA template docx. Below the
            counterparty because it is filled in from the counterparty's country;
            users choose it here when it isn't. A searchable dropdown, like
            Country and Customer Name, so the three look and behave the same. */}
        <Autocomplete
          fullWidth
          options={WSO2_COMPANIES}
          value={WSO2_COMPANIES.find((c) => c.value === wso2Company) ?? null}
          getOptionLabel={(option) => option.label}
          isOptionEqualToValue={(option, value) => option.value === value.value}
          onChange={(_e, next) => setWso2Company(next?.value ?? "")}
          renderInput={(params) => (
            <TextField
              {...params}
              label="WSO2 Company"
              error={Boolean(partyCountry && !wso2Company)}
              helperText={
                partyCountry && !wso2Company
                  ? `No WSO2 entity matches the counterparty's country "${partyCountry}". Choose one.`
                  : "Set from the counterparty's country. It decides which law governs the NDA."
              }
            />
          )}
        />

        {/* Always shown, so users know where the form ends; enabled once the
            entity and the counterparty are complete. Until then the line
            under it says what is still missing. */}
        <Stack spacing={0.5} sx={{ alignItems: "flex-start" }}>
          <Button
            variant="contained"
            startIcon={
              generating ? (
                <CircularProgress size={16} sx={{ color: "inherit" }} />
              ) : (
                <DownloadIcon size={16} />
              )
            }
            disabled={!allFilled || generating}
            onClick={() => void handleDownload()}
            aria-describedby={missingHint ? downloadHintId : undefined}
            sx={{ textTransform: "none" }}
          >
            {generating ? "Generating PDF\u2026" : "Download NDA PDF"}
          </Button>
          {missingHint && (
            <Typography id={downloadHintId} variant="caption" sx={{ color: "text.secondary" }}>
              {missingHint}
            </Typography>
          )}
        </Stack>
      </Stack>

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snack.severity}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
