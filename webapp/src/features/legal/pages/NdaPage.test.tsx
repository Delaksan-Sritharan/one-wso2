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

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import type { CustomerResult } from "@features/legal/api/useCustomerSearch";
import type { NdaPdfProps } from "@features/legal/pages/NdaPdfDocument";
import NdaPage from "@features/legal/pages/NdaPage";
import { HttpError } from "@api/http";
import { downloadHint } from "@features/legal/downloadHint";
import { EMPTY_MANUAL_COUNTERPARTY } from "@features/legal/manualCounterparty";

vi.mock("@config/apiConfig", () => ({
  isLegalBackendConfigured: () => true,
  legalServiceUrls: { customerSearch: "/customer-search", me: "/me" },
}));

const ACME_LANKA: CustomerResult = {
  id: "001",
  name: "Acme Lanka",
  subRegion: null,
  subIndustry: null,
  salesRegion: null,
  address: {
    billingStreet: "1 Main Street",
    billingCity: "Colombo",
    billingState: null,
    billingPostalCode: null,
    billingCountry: "Sri Lanka",
  },
};

const search = vi.hoisted(() => ({ failed: false }));
vi.mock("@features/legal/api/useCustomerSearch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@features/legal/api/useCustomerSearch")>()),
  useCustomerSearch: () =>
    search.failed
      ? { data: undefined, isFetching: false, isError: true }
      : { data: [ACME_LANKA], isFetching: false, isError: false },
}));

// Capture what the page asks the PDF renderer to draw, instead of drawing it.
const rendered = vi.hoisted(() => ({ props: null as NdaPdfProps | null, fail: false }));
vi.mock("@react-pdf/renderer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@react-pdf/renderer")>()),
  pdf: (element: { props: NdaPdfProps }) => {
    rendered.props = element.props;
    return {
      toBlob: async () => {
        if (rendered.fail) throw new Error("PDF layout failed");
        return new Blob(["%PDF-"]);
      },
    };
  },
}));

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => "blob:nda");
  URL.revokeObjectURL = vi.fn();
});

type AccessData = { canSearchSalesforce: boolean; ndaRecordsEnabled?: boolean; canViewNdaRecords?: boolean };
type Access = {
  isPending: boolean;
  isError: boolean;
  data?: AccessData;
  /** Re-asks GET /me; the page calls it when the first check failed. */
  refetch?: () => Promise<{ data?: AccessData }>;
};
const access = vi.hoisted(() => ({ value: {} as Access }));
vi.mock("@features/legal/api/useNdaAccess", () => ({
  useNdaAccess: () => access.value,
}));

// Recording an NDA, and the records list, without a backend.
const recording = vi.hoisted(() => ({
  mutateAsync: vi.fn<(input: unknown) => Promise<unknown>>(),
}));
vi.mock("@features/legal/api/useNdaRecords", () => ({
  useRecordNda: () => ({ mutateAsync: recording.mutateAsync }),
  useNdaRecords: () => ({ data: { items: [], total: 0, days: 7 }, isPending: false, isError: false }),
}));

beforeEach(() => {
  rendered.props = null;
  rendered.fail = false;
  vi.mocked(URL.createObjectURL).mockClear();
  recording.mutateAsync.mockReset();
  recording.mutateAsync.mockResolvedValue({});
});

function renderPage(a: Access, { searchFails = false, url = "/legal/nda" } = {}) {
  access.value = a;
  search.failed = searchFails;
  return render(
    <MemoryRouter initialEntries={[url]}>
      <NdaPage />
    </MemoryRouter>,
  );
}

describe("NdaPage counterparty", () => {
  it("offers Salesforce search and manual entry to the Salesforce search groups", () => {
    renderPage({ isPending: false, isError: false, data: { canSearchSalesforce: true } });
    expect(screen.getByRole("button", { name: "Salesforce customer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enter details manually" })).toBeInTheDocument();
    expect(screen.getByLabelText("Customer Name")).toBeInTheDocument();
  });

  it("offers only manual entry to everyone else", () => {
    renderPage({ isPending: false, isError: false, data: { canSearchSalesforce: false } });
    expect(screen.queryByRole("button", { name: "Salesforce customer" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Customer Name")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Legal name/ })).toBeInTheDocument();
  });

  it("shows neither while access is being checked", () => {
    renderPage({ isPending: true, isError: false });
    expect(screen.getByLabelText("Checking your access")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salesforce customer" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /Legal name/ })).not.toBeInTheDocument();
  });

  it("keeps the download button visible but disabled until the form is complete, and says what's missing", () => {
    renderPage({ isPending: false, isError: false, data: { canSearchSalesforce: false } });
    const download = screen.getByRole("button", { name: /Download NDA PDF/ });
    expect(download).toBeDisabled();
    expect(download).toHaveAccessibleDescription(
      "To download, fill in the legal name, street address and city, and choose the country.",
    );
  });

  it("falls back to manual entry with a single message when access can't be checked", () => {
    renderPage({ isPending: false, isError: true });
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent(/Enter the counterparty's registered legal name/);
    expect(screen.queryByRole("button", { name: "Salesforce customer" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Legal name/ })).toBeInTheDocument();
  });

  it("says the search is broken, not that the customer doesn't exist, and offers manual entry", async () => {
    const user = userEvent.setup();
    renderPage({ isPending: false, isError: false, data: { canSearchSalesforce: true } }, { searchFails: true });
    expect(screen.getByText(/Customer search isn't working right now/)).toBeInTheDocument();

    // The alert's own button, not the toggle with the same label.
    const alert = screen.getByText(/Customer search isn't working right now/).closest("[role=alert]") as HTMLElement;
    await user.click(within(alert).getByRole("button", { name: "Enter details manually" }));
    expect(screen.getByRole("textbox", { name: /Legal name/ })).toBeInTheDocument();
    expect(screen.queryByText(/Customer search isn't working right now/)).not.toBeInTheDocument();
  });

  it("keeps the search list closed while the search fails, so it can't cover the warning", async () => {
    const user = userEvent.setup();
    renderPage({ isPending: false, isError: false, data: { canSearchSalesforce: true } }, { searchFails: true });
    await user.type(screen.getByRole("combobox", { name: /Customer Name/ }), "num");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.queryByText("No customers found")).not.toBeInTheDocument();
    expect(screen.getAllByText(/Customer search isn't working right now/)).toHaveLength(1);
  });

  it("doesn't reopen the search list after a failed search once the field loses focus", async () => {
    const user = userEvent.setup();
    renderPage({ isPending: false, isError: false, data: { canSearchSalesforce: true } }, { searchFails: true });
    await user.type(screen.getByRole("combobox", { name: /Customer Name/ }), "num");
    // Leaving the field clears it, and an empty field runs no search, so the error ends.
    search.failed = false;
    await user.tab();
    expect(screen.getByRole("combobox", { name: /Customer Name/ })).toHaveValue("");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.queryByText("Type to search customers")).not.toBeInTheDocument();
  });
});

describe("NdaPage counterparty and WSO2 company", () => {
  const allowed: Access = { isPending: false, isError: false, data: { canSearchSalesforce: true } };
  const wso2Company = () => screen.getByRole("combobox", { name: /WSO2 Company/ });

  async function pickSalesforceCustomer(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByRole("combobox", { name: "Customer Name" }), "Acme");
    await user.click(await screen.findByRole("option", { name: "Acme Lanka" }));
  }

  async function enterManualParty(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "Enter details manually" }));
    await user.type(screen.getByRole("textbox", { name: /Legal name/ }), "Example Vendor Ltd");
    await user.type(screen.getByRole("textbox", { name: /Street address/ }), "1 Example Road");
    await user.type(screen.getByRole("textbox", { name: /City/ }), "London");
    await user.type(screen.getByRole("combobox", { name: /Country/ }), "United Kingdom");
    await user.click(await screen.findByRole("option", { name: "United Kingdom" }));
  }

  it("follows the active counterparty's country when switching between Salesforce and manual entry", async () => {
    const user = userEvent.setup();
    renderPage(allowed);

    await pickSalesforceCustomer(user);
    expect(wso2Company()).toHaveValue("WSO2 Lanka (Pvt) Ltd (LK)");

    // Manual entry has no country yet, so the Sri Lanka entity must not stay behind.
    await user.click(screen.getByRole("button", { name: "Enter details manually" }));
    expect(wso2Company()).toHaveValue("");

    await user.type(screen.getByRole("combobox", { name: /Country/ }), "United Kingdom");
    await user.click(await screen.findByRole("option", { name: "United Kingdom" }));
    expect(wso2Company()).toHaveValue("WSO2 (UK) Ltd (UK)");

    // Back to the Salesforce customer, back to its entity.
    await user.click(screen.getByRole("button", { name: "Salesforce customer" }));
    expect(wso2Company()).toHaveValue("WSO2 Lanka (Pvt) Ltd (LK)");
  });

  it("puts the active counterparty and its entity into the NDA", async () => {
    const user = userEvent.setup();
    renderPage(allowed);

    // A Salesforce customer chosen first must not leak into a manual NDA.
    await pickSalesforceCustomer(user);
    await enterManualParty(user);
    await user.click(screen.getByRole("button", { name: /Download NDA PDF/ }));

    await waitFor(() => expect(rendered.props).not.toBeNull());
    expect(rendered.props).toMatchObject({
      customerName: "Example Vendor Ltd",
      customerAddress: "1 Example Road, London, United Kingdom",
      wso2Company: "WSO2 (UK) Ltd \u2014 UK",
    });
  });
});

describe("downloadHint", () => {
  const base = {
    isManual: false,
    manualParty: EMPTY_MANUAL_COUNTERPARTY,
    hasCustomer: false,
    hasCountry: false,
    hasWso2Company: false,
  };

  it("asks for a customer, not the WSO2 Company the customer will fill in", () => {
    expect(downloadHint(base)).toBe("To download, choose a customer.");
  });

  it("asks for the WSO2 Company when the country has no matching entity", () => {
    expect(downloadHint({ ...base, hasCustomer: true, hasCountry: true })).toBe("To download, choose a WSO2 Company.");
  });

  it("lists only the manual fields still empty", () => {
    const party = { ...EMPTY_MANUAL_COUNTERPARTY, name: "Example Vendor Ltd", street: "1 Example Road" };
    expect(downloadHint({ ...base, isManual: true, manualParty: party })).toBe(
      "To download, fill in the city, and choose the country.",
    );
  });

  it("is null once everything is filled in", () => {
    expect(downloadHint({ ...base, hasCustomer: true, hasCountry: true, hasWso2Company: true })).toBeNull();
  });
});

describe("NdaPage records", () => {
  const recordsOn: Access = {
    isPending: false,
    isError: false,
    data: { canSearchSalesforce: false, ndaRecordsEnabled: true, canViewNdaRecords: false },
  };

  async function fillManualParty(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByRole("textbox", { name: /Legal name/ }), "Example Vendor Ltd");
    await user.type(screen.getByRole("textbox", { name: /Street address/ }), "1 Example Road");
    await user.type(screen.getByRole("textbox", { name: /City/ }), "London");
    await user.type(screen.getByRole("combobox", { name: /Country/ }), "United Kingdom");
    await user.click(await screen.findByRole("option", { name: "United Kingdom" }));
  }

  it("records the NDA before downloading it", async () => {
    const user = userEvent.setup();
    renderPage(recordsOn);
    await fillManualParty(user);
    await user.click(screen.getByRole("button", { name: /Download NDA PDF/ }));

    await waitFor(() => expect(rendered.props).not.toBeNull());
    expect(recording.mutateAsync).toHaveBeenCalledWith({
      template: "Mutual NDA \u2014 Standard",
      wso2Entity: "WSO2 (UK) Ltd \u2014 UK",
      counterpartyName: "Example Vendor Ltd",
      counterpartyAddress: "1 Example Road, London, United Kingdom",
      counterpartyCountry: "United Kingdom",
      source: "manual",
      salesforceAccountId: null,
    });
  });

  it("records a Salesforce customer with its account ID", async () => {
    const user = userEvent.setup();
    renderPage({ ...recordsOn, data: { ...recordsOn.data!, canSearchSalesforce: true } });
    await user.type(screen.getByRole("combobox", { name: "Customer Name" }), "Acme");
    await user.click(await screen.findByRole("option", { name: "Acme Lanka" }));
    await user.click(screen.getByRole("button", { name: /Download NDA PDF/ }));

    await waitFor(() => expect(rendered.props).not.toBeNull());
    expect(recording.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ counterpartyName: "Acme Lanka", source: "salesforce", salesforceAccountId: "001" }),
    );
  });

  it("downloads nothing when the NDA can't be recorded", async () => {
    recording.mutateAsync.mockRejectedValue(new Error("503"));
    const user = userEvent.setup();
    renderPage(recordsOn);
    await fillManualParty(user);
    await user.click(screen.getByRole("button", { name: /Download NDA PDF/ }));

    expect(await screen.findByText(/Couldn't record the NDA, so it wasn't downloaded/)).toBeInTheDocument();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("says why a refused record was refused, without suggesting a retry", async () => {
    recording.mutateAsync.mockRejectedValue(
      new HttpError("/ndas", 400, JSON.stringify({ message: "counterpartyName is too long" })),
    );
    const user = userEvent.setup();
    renderPage(recordsOn);
    await fillManualParty(user);
    await user.click(screen.getByRole("button", { name: /Download NDA PDF/ }));

    expect(await screen.findByText(/counterpartyName is too long/)).toBeInTheDocument();
    expect(screen.queryByText(/Please try again/)).not.toBeInTheDocument();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("downloads nothing when the access check failed and still can't answer", async () => {
    const refetch = vi.fn(async () => ({ data: undefined }));
    const user = userEvent.setup();
    renderPage({ isPending: false, isError: true, refetch });
    await fillManualParty(user);
    await user.click(screen.getByRole("button", { name: /Download NDA PDF/ }));

    expect(await screen.findByText(/Couldn't reach the NDA service to record this NDA/)).toBeInTheDocument();
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(rendered.props).toBeNull();
    expect(recording.mutateAsync).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("asks again when the access check failed, and records if records are on", async () => {
    const refetch = vi.fn(async () => ({ data: { canSearchSalesforce: false, ndaRecordsEnabled: true } }));
    const user = userEvent.setup();
    renderPage({ isPending: false, isError: true, refetch });
    await fillManualParty(user);
    await user.click(screen.getByRole("button", { name: /Download NDA PDF/ }));

    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(recording.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ counterpartyName: "Example Vendor Ltd" }));
  });

  it("records nothing when the PDF can't be built", async () => {
    rendered.fail = true;
    const user = userEvent.setup();
    renderPage(recordsOn);
    await fillManualParty(user);
    await user.click(screen.getByRole("button", { name: /Download NDA PDF/ }));

    expect(await screen.findByText("Failed to generate PDF. Please try again.")).toBeInTheDocument();
    expect(recording.mutateAsync).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("downloads without recording when NDA records are off", async () => {
    const user = userEvent.setup();
    renderPage({ ...recordsOn, data: { canSearchSalesforce: false, ndaRecordsEnabled: false } });
    await fillManualParty(user);
    await user.click(screen.getByRole("button", { name: /Download NDA PDF/ }));

    await waitFor(() => expect(rendered.props).not.toBeNull());
    expect(recording.mutateAsync).not.toHaveBeenCalled();
  });

  it("offers the NDA records tab only to those who may view them", () => {
    renderPage(recordsOn, { url: "/legal/nda?tab=records" });
    expect(screen.queryByRole("tab", { name: "NDA Records" })).not.toBeInTheDocument();
    expect(screen.getByText("Generate WSO2's standard Mutual NDA as a PDF.")).toBeInTheDocument();
    // Without the permission, ?tab=records still shows the form.
    expect(screen.getByRole("button", { name: /Download NDA PDF/ })).toBeInTheDocument();
  });

  it("shows the records table on the NDA records tab", async () => {
    const user = userEvent.setup();
    renderPage({ ...recordsOn, data: { ...recordsOn.data!, canViewNdaRecords: true } });

    expect(screen.getByRole("tab", { name: "Generate NDA" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Generate WSO2's standard Mutual NDA as a PDF.")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "NDA Records" }));
    expect(screen.getByRole("table", { name: "Generated NDAs" })).toBeInTheDocument();
    expect(screen.getByText("View all generated NDAs.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Download NDA PDF/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Generate NDA" }));
    expect(screen.getByRole("button", { name: /Download NDA PDF/ })).toBeInTheDocument();
  });
});
