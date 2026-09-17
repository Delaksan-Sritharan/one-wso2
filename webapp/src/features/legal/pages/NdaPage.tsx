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

import { useState, type JSX } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Snackbar,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { DownloadIcon } from "@wso2/oxygen-ui-icons-react";
import { pdf } from "@react-pdf/renderer";
import PerspectiveHeader from "@components/perspective-header/PerspectiveHeader";
import { useCustomerSearch, formatCustomerAddress, type CustomerResult } from "@features/legal/api/useCustomerSearch";
import NdaPdfDocument, { NDA_ENTITY_CONFIGS } from "./NdaPdfDocument";

// ── Static option lists ─────────────────────────────────────────────────────

// All current WSO2 NDA templates are Mutual NDAs. The other types are listed
// for completeness and may be backed by documents in future.
const NDA_TEMPLATES = [
  "Mutual NDA \u2014 Standard",
  "One-Way NDA \u2014 Vendor",
  "One-Way NDA \u2014 Customer",
  "Partnership NDA",
  "Evaluation NDA",
  "Employee NDA",
];

// Derived from the keys of NDA_ENTITY_CONFIGS so label and value stay in sync.
// Each entry corresponds to an official WSO2 NDA template docx file.
const WSO2_COMPANIES: { value: string; label: string }[] = [
  { value: "WSO2 LLC \u2014 US",                 label: "WSO2 LLC (US)" },
  { value: "WSO2 Lanka (Pvt) Ltd \u2014 LK",     label: "WSO2 Lanka (Pvt) Ltd (LK)" },
  { value: "WSO2 India Pvt Ltd \u2014 IN",        label: "WSO2 India Pvt Ltd (IN)" },
  { value: "WSO2 (UK) Ltd \u2014 UK",             label: "WSO2 (UK) Ltd (UK)" },
  { value: "WSO2 Australia Pty Ltd \u2014 AU",    label: "WSO2 Australia Pty Ltd (AU)" },
  { value: "WSO2 Middle East FZ-LLC \u2014 AE",   label: "WSO2 Middle East FZ-LLC (AE)" },
  { value: "WSO2EA Ltd \u2014 KE",                label: "WSO2EA Ltd (KE)" },
  { value: "WSO2 SG Pte Ltd \u2014 SG",           label: "WSO2 SG Pte Ltd (SG)" },
  { value: "WSO2 South Africa Pty Ltd \u2014 ZA", label: "WSO2 South Africa Pty Ltd (ZA)" },
  { value: "WSO2 Spain SL \u2014 ES",             label: "WSO2 Spain SL (ES)" },
  { value: "WSO2 Brasil \u2014 BR",               label: "WSO2 Brasil (BR)" },
];

// Verify at module load that every company value has a matching entity config.
// This catches a key mismatch at dev time rather than silently falling back.
if (import.meta.env.DEV) {
  for (const { value } of WSO2_COMPANIES) {
    if (!NDA_ENTITY_CONFIGS[value]) {
      console.warn(`[NdaPage] No entity config found for company key: "${value}"`);
    }
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function CustomerDetailRow({ label, value }: { label: string; value: string | null | undefined }): JSX.Element | null {
  if (!value) return null;
  return (
    <Box sx={{ display: "flex", gap: 1 }}>
      <Typography variant="caption" sx={{ color: "text.secondary", minWidth: 64 }}>
        {label}
      </Typography>
      <Typography variant="caption">{value}</Typography>
    </Box>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function NdaPage(): JSX.Element {
  const [template, setTemplate] = useState("");
  const [wso2Company, setWso2Company] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null);
  const [customerInput, setCustomerInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [snack, setSnack] = useState<{
    open: boolean;
    severity: "success" | "error";
    message: string;
  }>({ open: false, severity: "success", message: "" });

  const { data: customerOptions = [], isFetching: searchingCustomers } = useCustomerSearch(customerInput);

  const allFilled = Boolean(template && wso2Company && selectedCustomer);

  const handleDownload = async () => {
    setGenerating(true);
    try {
      const generatedDate = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const customerName = selectedCustomer?.name ?? "";
      const customerAddress = formatCustomerAddress(selectedCustomer?.address ?? null);

      const blob = await pdf(
        <NdaPdfDocument
          template={template}
          wso2Company={wso2Company}
          customerName={customerName}
          customerAddress={customerAddress}
          effectiveDate={generatedDate}
          notes=""
          generatedDate={generatedDate}
        />,
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `NDA-${customerName.replace(/\s+/g, "-")}-${Date.now()}.pdf`;
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

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <PerspectiveHeader
        title="NDA"
        subtitle="Non-disclosure agreement management and tracking."
      />

      <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, maxWidth: 480 }}>
        {/* NDA Template */}
        <TextField
          select
          fullWidth
          label="NDA Template"
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
        >
          {NDA_TEMPLATES.map((t) => (
            <MenuItem key={t} value={t}>
              {t}
            </MenuItem>
          ))}
        </TextField>

        {/* WSO2 Company — one option per official NDA template docx */}
        <TextField
          select
          fullWidth
          label="WSO2 Company"
          value={wso2Company}
          onChange={(e) => setWso2Company(e.target.value)}
        >
          {WSO2_COMPANIES.map((c) => (
            <MenuItem key={c.value} value={c.value}>
              {c.label}
            </MenuItem>
          ))}
        </TextField>

        {/* Customer Name — server-side search via customer-search API */}
        <Autocomplete
          fullWidth
          options={customerOptions}
          value={selectedCustomer}
          inputValue={customerInput}
          getOptionLabel={(option) => option.name}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          onChange={(_e, newValue) => setSelectedCustomer(newValue)}
          onInputChange={(_e, newInput) => setCustomerInput(newInput)}
          filterOptions={(x) => x}
          loading={searchingCustomers}
          loadingText="Searching…"
          noOptionsText={
            customerInput.length < 2
              ? "Type to search customers"
              : "No customers found"
          }
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

        {/* Customer verification card — shown once a customer is selected */}
        {selectedCustomer && (
          <Box
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              px: 2,
              py: 1.5,
              display: "flex",
              flexDirection: "column",
              gap: 0.5,
              backgroundColor: "action.hover",
            }}
          >
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Customer Details
            </Typography>
            <CustomerDetailRow label="Country" value={selectedCustomer.address?.billingCountry} />
            <CustomerDetailRow label="Address" value={formatCustomerAddress(selectedCustomer.address ?? null)} />
            <CustomerDetailRow label="Region" value={selectedCustomer.subRegion} />
            <CustomerDetailRow label="Industry" value={selectedCustomer.subIndustry} />
          </Box>
        )}

        {/* Download button — only shown when all three dropdowns are filled */}
        {allFilled && (
          <Button
            variant="contained"
            startIcon={
              generating ? (
                <CircularProgress size={16} sx={{ color: "inherit" }} />
              ) : (
                <DownloadIcon size={16} />
              )
            }
            disabled={generating}
            onClick={() => void handleDownload()}
            sx={{ alignSelf: "flex-start", textTransform: "none" }}
          >
            {generating ? "Generating PDF\u2026" : "Download NDA PDF"}
          </Button>
        )}
      </Box>

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
