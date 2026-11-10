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

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JSX } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { AdapterDateFns, DatePickers } from "@wso2/oxygen-ui";
import {
  emptyDraftForm,
  type DraftFormValues,
  type LineValue,
} from "@features/sales/cado2/quotes/form/draftForm";
import ProductsStep from "./ProductsStep";

// D72: products brought in from the opportunity.

// The opportunity's line items in Salesforce (D147).
const sfLine = { id: "00kA", productName: "API Manager", productCode: null, quantity: "4", salesPrice: "9000", discount: "25", totalPrice: "27000.00", commissionPercent: null, serviceStartDate: null, serviceEndDate: null, problems: null, load: null };
const opportunityLines: { currency: string; lines: unknown[]; check: unknown } = { currency: "USD", lines: [sfLine], check: null };
// The quotes on the opportunity (D150: none synced to it yet).
const opportunityQuotes: { data: unknown[] } = { data: [] };
const sfLoad = {
  pricebookEntryId: "01uAPIM", productId: "01tAPIM", productName: "API Manager", productCode: "P-APIM", productDescription: null,
  pricebookId: "01sUSD", pricebookName: "USD Price Book", unitPrice: "8000", salesPrice: "9000", quantity: "4", discount: "25",
  category: "SUBSCRIPTION", classification: "PS", recurring: true, formula: false,
};
const empty = {
  data: [],
  error: null,
  isPending: false,
  isFetching: false,
  refetch: vi.fn(),
};
vi.mock("@features/sales/cado2/quotes/api/useQuoteApi", () => ({
  useAccountOpportunities: () => empty,
  useOpportunityLines: () => ({ ...empty, data: opportunityLines }),
  useOpportunityQuotes: () => ({ ...empty, data: opportunityQuotes.data }),
  usePricingFormulas: () => empty,
  useBundleChildren: () => ({ data: { children: [], missing: [] }, isFetching: false }),
  useCurrencies: () => ({ ...empty, data: ["USD"] }),
  usePricebooks: () => empty,
  useProducts: () => ({
    ...empty,
    data: { pages: [] },
    hasNextPage: false,
    fetchNextPage: vi.fn(),
  }),
}));

const line = (name: string, category: LineValue["category"]): LineValue => ({
  lineId: null,
  pricebookEntryId: `01u${name}`,
  productName: name,
  productCode: "",
  productDescription: "",
  pricebookId: "01sUSD",
  pricebookName: "USD Price Book",
  unitPrice: "360",
  category,
  categorySource: category ? "MAPPED" : "REP",
  recurring: category !== "PROFESSIONAL_SERVICE",
  classification: "PS",
  unitOfMeasure: "",
  quantity: "1",
  discount: "",
  yearNumber: 1,
  startDate: "",
  endDate: "",
  salesPrice: "",
  key: `k-${Math.random()}`,
  parentKey: "",
  bundleFixedQuantity: null,
});

/** Each line's quantity, by key, to check what the form holds. */
function Quantities(): JSX.Element {
  const lines = useWatch<DraftFormValues, "lines">({ name: "lines" });
  return <p aria-label="Quantities">{lines.map((l) => `${l.key}=${l.quantity}`).join(" ")}</p>;
}

function Harness({
  startDate = "2027-01-01",
  values = {},
}: { startDate?: string; values?: Partial<DraftFormValues> } = {}): JSX.Element {
  const form = useForm<DraftFormValues>({
    defaultValues: {
      ...emptyDraftForm(),
      accountId: "001A",
      currencyIsoCode: "USD",
      defaultPricebookId: "01sUSD",
      defaultPricebookName: "USD Price Book",
      startDate,
      dealKind: "FIRST_SALE",
      lines: [
        line("WSO2 Gateway", "SUBSCRIPTION"),
        line("WSO2 Integrator", ""),
      ],
      ...values,
    },
  });
  return (
    <DatePickers.LocalizationProvider dateAdapter={AdapterDateFns}>
      <FormProvider {...form}>
        <ProductsStep preview={null} />
        <Quantities />
      </FormProvider>
    </DatePickers.LocalizationProvider>
  );
}

describe("ProductsStep (Products & Pricing)", () => {
  beforeEach(() => {
    opportunityQuotes.data = [];
  });

  // D150: only an auto-generated renewal's inherited lines, until a quote is synced to it.
  it("shows the Salesforce line items only on a renewal never synced from QuickQuote", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness values={{ opportunityId: "006A", opportunityName: "Acme renewal" }} />);
    expect(screen.queryByRole("button", { name: "Import renewal products" })).toBeNull(); // a first sale
    unmount();

    opportunityQuotes.data = [{ quoteId: 9, syncedAt: "2026-11-01T10:00:00Z" }];
    const synced = render(<Harness values={{ opportunityId: "006A", opportunityName: "Acme renewal", dealKind: "RENEWAL" }} />);
    expect(screen.queryByRole("button", { name: "Import renewal products" })).toBeNull(); // its lines came from QuickQuote
    synced.unmount();

    opportunityQuotes.data = [{ quoteId: 10, syncedAt: null }]; // this quote, never synced
    render(<Harness values={{ opportunityId: "006A", opportunityName: "Acme renewal", dealKind: "RENEWAL" }} />);
    await user.click(screen.getByRole("button", { name: "Import renewal products" }));
    const dialog = within(screen.getByRole("dialog", { name: /Import renewal products from Salesforce/ }));
    expect(dialog.getByText(/Acme renewal/)).toBeInTheDocument();
    expect(dialog.getByText("API Manager")).toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("WSO2 Gateway")).toBeInTheDocument(); // the quote's own lines untouched
  });

  // D150: a clean renewal's lines replace the quote's, in the opportunity's one year.
  it("loads a clean renewal's line items into the quote", async () => {
    const user = userEvent.setup();
    opportunityLines.lines = [{ ...sfLine, problems: [], load: sfLoad }];
    opportunityLines.check = { problems: [], canLoad: true, isRenewal: true, subsStartDate: "2027-02-01", subsEndDate: "2028-01-31", pricebookName: "USD Price Book" };
    try {
      render(<Harness values={{ opportunityId: "006A", opportunityName: "Acme renewal", dealKind: "RENEWAL", yearCount: 2 }} />);
      await user.click(screen.getByRole("button", { name: "Import renewal products" }));
      expect(screen.getByText("Replaces the 2 products already on this quote.")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Load into quote" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(screen.getByLabelText("Loaded from Salesforce")).toHaveTextContent("Loaded 1 product from Salesforce. Check them, then save the draft.");
      expect(screen.queryByText("WSO2 Gateway")).toBeNull(); // replaced
      expect(screen.getByText("API Manager")).toBeInTheDocument();
      expect(screen.getByLabelText("Quantities")).toHaveTextContent(/=4$/);
      expect(screen.getByRole("button", { name: /Add Year 2/ })).toBeInTheDocument(); // down to one year
    } finally {
      opportunityLines.lines = [sfLine];
      opportunityLines.check = null;
    }
  });

  // D151: a rate per year, from the Partner Commission card.
  it("splits the commission into a rate per year, and back to one after asking", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness values={{ dealType: "PARTNER", partnerCommissionPercent: "10", yearCount: 1 }} />);
    expect(screen.queryByRole("checkbox", { name: "Different rate per year" })).toBeNull(); // one year
    unmount();

    render(<Harness values={{ dealType: "PARTNER", partnerCommissionPercent: "10", yearCount: 3 }} />);
    await user.click(screen.getByRole("checkbox", { name: "Different rate per year" }));
    const perYear = within(screen.getByLabelText("Commission per year"));
    expect(perYear.getAllByRole("textbox").map((t) => (t as HTMLInputElement).value)).toEqual(["10", "10", "10"]);
    const year1 = perYear.getByRole("textbox", { name: "Year 1" });
    await user.clear(year1);
    await user.type(year1, "15");

    await user.click(screen.getByRole("checkbox", { name: "Different rate per year" }));
    expect(screen.getByText("Every year will use Year 1's 15%.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Use 15%" }));
    expect(screen.queryByLabelText("Commission per year")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Commission" })).toHaveValue("15");
  });

  // D78: products can be added and kept before the start date; they are
  // priced once it is chosen.
  it("lets the AM add products before the start date is chosen", () => {
    render(<Harness startDate="" />);
    expect(screen.getByRole("button", { name: "Add product to Year 1" })).toBeEnabled();
    expect(screen.getByText("Amounts appear once the start date is chosen.")).toBeInTheDocument();
  });

  // Currency and price book first, then the term right above the products it
  // lays out (2026-10-23); billing and payment terms are on Commercials (D86).
  // An empty quote (2026-10-26): one way to add a product, no year to add,
  // no clone or delete, and no totals of nothing.
  it("starts an empty quote with one Add product and nothing else", () => {
    render(<Harness values={{ lines: [] }} />);
    expect(screen.getByText(/^No products yet/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Add product to Year 1" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /^Clone/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete Year 1" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Add Year 2/ })).toBeNull();
    expect(screen.queryByText(/Total order value/)).toBeNull();
  });

  // A new year (added or cloned) only once every year has products, so empty
  // years don't pile up; an empty year can still be deleted.
  it("adds or clones a year only once every year has products, and deletes an empty one", async () => {
    const user = userEvent.setup();
    render(<Harness values={{ lines: [{ ...line("WSO2 Gateway", "SUBSCRIPTION"), recurring: true }] }} />);
    await user.click(screen.getByRole("button", { name: "Add Year 2" }));
    expect(screen.getByRole("button", { name: "Add Year 3" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Clone/ })).toBeDisabled();
    const year2 = within(screen.getByRole("region", { name: "Year 2" }));
    expect(year2.getByText(/^No products yet/)).toBeInTheDocument();
    expect(year2.queryByRole("button", { name: /^Clone/ })).toBeNull();

    await user.click(year2.getByRole("button", { name: "Delete Year 2" }));
    expect(screen.queryByRole("region", { name: "Year 2" })).toBeNull();
    expect(screen.getByRole("button", { name: "Add Year 2" })).toBeEnabled();
  });

  // A quote always has Year 1: the only year can't be deleted, empty or not.
  it("never deletes the only year", () => {
    const { unmount } = render(<Harness values={{ lines: [] }} />);
    expect(screen.queryByRole("button", { name: "Delete Year 1" })).toBeNull();
    unmount();
    render(<Harness />);
    expect(screen.getByRole("region", { name: "Year 1" })).not.toHaveTextContent(/\d+ products?/); // no product count (2026-11-08)
    expect(screen.queryByRole("button", { name: "Delete Year 1" })).toBeNull();
  });

  // The last year's end date is clickable: a calendar brings it forward, and
  // "Full year" puts it back. Earlier years' dates are plain text.
  it("shortens the last year from its end date in the header", async () => {
    const user = userEvent.setup();
    render(<Harness values={{ yearCount: 1 }} />);
    await user.click(screen.getByRole("button", { name: /^Year 1 ends 31 Dec 2027\. Shorten Year 1/ }));
    const calendar = within(screen.getByLabelText("When Year 1 ends"));
    expect(calendar.queryByRole("button", { name: "Full year" })).toBeNull();
    await user.click(calendar.getByRole("gridcell", { name: "15" }));
    expect(screen.getByRole("button", { name: /^Year 1 ends 15 Dec 2027\. Change when Year 1 ends/ })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Year 1" })).toHaveTextContent("11 months");

    await user.click(screen.getByRole("button", { name: /^Year 1 ends 15 Dec 2027\. Change when Year 1 ends/ }));
    await user.click(within(screen.getByLabelText("When Year 1 ends")).getByRole("button", { name: "Full year" }));
    expect(screen.getByRole("button", { name: /^Year 1 ends 31 Dec 2027\. Shorten Year 1/ })).toBeInTheDocument();
  });

  // The year's actions sit beside its toggle, not inside
  // a button, so screen readers announce them.
  it("keeps a year's actions outside its fold toggle", () => {
    render(<Harness />);
    const toggle = screen.getByRole("button", { name: /^Year 1, (fold|unfold)$/ });
    const clone = screen.getByRole("button", { name: /^Clone/ });
    expect(toggle.contains(clone)).toBe(false);
  });

  it("puts the term right above the products", () => {
    render(<Harness />);
    const regions = screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"));
    expect(regions[0]).toBe("Currency & Price Book");
    expect(regions.indexOf("Term")).toBe(regions.indexOf("Products") - 1);
    expect(regions.indexOf("Year 1")).toBeGreaterThan(regions.indexOf("Products")); // a section inside the Products card
    expect(regions).not.toContain("Billing Frequency");
    expect(regions).not.toContain("Payment Terms");
  });

  // D93: a plain "Uncategorised" heading, no amber and no chip; the line's edit button opens the dialog.
  it("puts a line whose product isn't mapped under Uncategorised; its category is chosen in the line's dialog", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const table = screen.getByRole("table", { name: "Products" });
    expect(within(table).queryByRole("combobox")).toBeNull(); // no dropdown on the line
    expect(within(table).getByText("Uncategorised")).toBeInTheDocument(); // its own section, first
    // Framed by a thin red line.
    const group = within(table).getByRole("rowgroup", { name: "Uncategorised" });
    expect(within(group).getByText("WSO2 Integrator")).toBeInTheDocument();
    expect(within(group).queryByText("WSO2 Gateway")).toBeNull();
    // Says what to do (D95).
    expect(within(table).getByText(/to choose a category/)).toBeInTheDocument();
    expect(within(table).queryByRole("button", { name: /Category not set/ })).toBeNull();

    // Line 2 is WSO2 Integrator, the one without a category.
    await user.click(within(table).getByRole("button", { name: "Edit line 2" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("No category is set up for this product");
    await user.click(within(dialog).getByRole("combobox", { name: "Category" }));
    await user.click(screen.getByRole("option", { name: "Support" }));
    await user.click(within(dialog).getByRole("button", { name: "Save product" }));

    expect(within(table).getByText("Support")).toBeInTheDocument(); // now in its group
    expect(within(table).queryByText("Uncategorised")).toBeNull(); // gone once empty
    expect(within(table).queryByRole("rowgroup", { name: "Uncategorised" })).toBeNull();
  });

  // D125: a bundle child's quantity follows its rule when the AM changes the parent's.
  it("updates the children's quantities when the parent's changes", async () => {
    const user = userEvent.setup();
    const gw = { ...line("WSO2 Gateway", "SUBSCRIPTION"), key: "gw", quantity: "5" };
    const monitoring = { ...line("Monitoring", "SUBSCRIPTION"), key: "mon", parentKey: "gw", quantity: "5" };
    const support = { ...line("Enterprise Support", "SUPPORT"), key: "sup", parentKey: "gw", quantity: "1", bundleFixedQuantity: 1 };
    render(<Harness values={{ lines: [gw, monitoring, support] }} />);
    expect(screen.getByLabelText("Quantities")).toHaveTextContent("gw=5 mon=5 sup=1");

    await user.click(screen.getByRole("button", { name: "Edit line 1" }));
    const dialog = screen.getByRole("dialog");
    const qty = within(dialog).getByRole("textbox", { name: "Quantity" });
    await user.clear(qty);
    await user.type(qty, "10");
    await user.click(within(dialog).getByRole("button", { name: "Save product" }));

    expect(screen.getByLabelText("Quantities")).toHaveTextContent("gw=10 mon=10 sup=1");
  });

  // D91, amended 2026-10-23: the commission card sits above the term and the products, before any product too.
  it("puts the partner commission card above the term and the products", () => {
    render(<Harness values={{ dealType: "PARTNER", lines: [] }} />);
    const regions = screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"));
    expect(regions.indexOf("Partner Commission")).toBe(regions.indexOf("Term") - 1);
    expect(regions.indexOf("Partner Commission")).toBeGreaterThan(regions.indexOf("Currency & Price Book"));
  });

  it("has no commission card on a direct deal (D91)", () => {
    render(<Harness values={{ dealType: "DIRECT" }} />);
    expect(screen.queryByRole("region", { name: "Partner Commission" })).toBeNull();
  });
});
