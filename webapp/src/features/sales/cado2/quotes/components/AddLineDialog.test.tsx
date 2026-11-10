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

import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdapterDateFns, DatePickers } from "@wso2/oxygen-ui";
import type { LineValue } from "@features/sales/cado2/quotes/form/draftForm";
import AddLineDialog from "./AddLineDialog";

const gateway = {
  id: "01t000000000001",
  name: "WSO2 API Manager",
  productCode: "APIM-GW",
  family: null,
  unitOfMeasure: "Gateways",
  // Its category and recurring status, from its Salesforce classification (D152).
  category: "SUBSCRIPTION" as const,
  recurring: true,
  classification: "PS", // on-prem
  pricebookEntries: [
    { id: "01u000000000001", unitPrice: "360", currencyIsoCode: "USD", isActive: true, pricebook: { id: "01s1", name: "FY26 USD" } },
  ],
};

// Classified ES: Support.
const support = {
  ...gateway,
  id: "01t000000000002",
  name: "WSO2 Enterprise Support Plan - APIM",
  productCode: "SUP-APIM",
  // Its description repeats the name first, as in Salesforce.
  description: "WSO2 Enterprise Support Plan - APIM. Based on the number of production gateways.",
  category: "SUPPORT" as const,
  classification: "ES",
  pricebookEntries: [{ ...gateway.pricebookEntries[0], id: "01u000000000002", unitPrice: "25000" }],
};

// The backend lists the quote's price book only. `more` stands for a
// next page still to load; `book` records the book asked for; `override`
// replaces the products listed.
const productPages: { more: boolean; fetchNextPage: () => void; book: string; override?: unknown[] } = {
  more: false,
  fetchNextPage: vi.fn(),
  book: "",
};
vi.mock("@features/sales/cado2/quotes/api/useQuoteApi", () => ({
  usePricingFormulas: () => ({ data: formulas.list }),
  useBundleChildren: (id: string | null) =>
    bundle.error && id ? { data: undefined, isFetching: false, error: bundle.error, refetch: vi.fn() } : { data: id ? bundle.of(id) : undefined, isFetching: false, error: null },
  useProducts: (_currency: string, _term: string, book: string) => {
    productPages.book = book;
    return {
      data: book ? (productPages.override ?? [gateway, support]) : [],
      isPending: false,
      fetchStatus: "idle",
      hasNextPage: productPages.more,
      isFetchingNextPage: false,
      fetchNextPage: productPages.fetchNextPage,
    };
  },
}));

const quoteBook = { id: "01s1", name: "FY26 USD" };
// A shortened last year (D146 tests).
const shortYear3 = { number: 3, start: "2028-01-01", end: "2028-06-30" };

// Support priced by an Admin's formula (D81), when a test sets it.
const supportFormula = {
  versionId: 6,
  version: 3,
  status: "ACTIVE" as "ACTIVE" | "REMOVED",
  productId: support.id,
  productName: support.name,
  productCode: support.productCode,
  expression: "max($1, $2 * $3)",
  bindings: [
    { name: "$1", kind: "VALUE" as const, value: "25000" },
    { name: "$2", kind: "VALUE" as const, value: "10%" },
    { name: "$3", kind: "PRODUCTS" as const, products: [{ id: gateway.id, name: gateway.name, code: gateway.productCode }] },
  ],
  unitOfMeasure: "Annual, higher of 25,000 or 10% of subscription",
  updatedByEmail: "admin@wso2.com",
  updatedAt: "2026-10-15T10:00:00Z",
};
const formulas: { list: (typeof supportFormula)[] } = { list: [] };

// Bundles, when a test sets them: parent id → what comes with it.
const bundle: { parents: Record<string, { children: unknown[]; missing: string[] }>; of: (id: string) => unknown; error?: Error } = {
  parents: {},
  of: (id) => bundle.parents[id] ?? { children: [], missing: [] },
};

// A saved Support line priced with formula v3 (quote 57's case).
function savedSupportLine(): LineValue {
  return {
    lineId: 228,
    pricebookEntryId: "01u000000000002",
    productId: support.id,
    productName: support.name,
    productCode: "SUP-APIM",
    productDescription: "",
    pricebookId: "01s1",
    pricebookName: "FY26 USD",
    unitPrice: "414000",
    category: "SUPPORT",
    recurring: true,
    classification: "PS",
    unitOfMeasure: "",
    quantity: "1",
    discount: "0",
    yearNumber: 1,
    startDate: "",
    endDate: "",
    salesPrice: "",
    key: `k-${Math.random()}`,
    parentKey: "",
    bundleFixedQuantity: null,
    keepPricing: {
      method: "FORMULA",
      formulaVersionId: 6,
      formula: {
        versionId: 6,
        version: 3,
        versionDate: "2026-10-15",
        unitOfMeasure: "Annual, per v3",
        expression: "max($1, $2 * 10%)",
        explanation: "max(25,000, 4,140,000 × 10%)",
        listPrice: "53000",
        values: [],
      },
    },
  };
}

function renderDialog(onSave = vi.fn(), line: LineValue | null = null) {
  render(
    <DatePickers.LocalizationProvider dateAdapter={AdapterDateFns}>
      <AddLineDialog open line={line} currency="USD" pricebook={quoteBook} year={null} onSave={onSave} onClose={vi.fn()} />
    </DatePickers.LocalizationProvider>,
  );
  return onSave;
}

async function pick(name: RegExp) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox", { name: /Product/ }));
  await user.click(await screen.findByRole("option", { name }));
  return user;
}

describe("AddLineDialog", () => {
  it("groups the fields and shows the chosen product and its price-book price", async () => {
    const onSave = renderDialog();
    const user = userEvent.setup();
    for (const group of ["Product", "Price, Quantity & Discount"]) {
      expect(screen.getByRole("region", { name: group })).toBeInTheDocument();
    }
    // Lines have no dates of their own: they cover the quote's term.
    expect(screen.queryByRole("region", { name: "Period" })).toBeNull();
    // D114: a plain title, no price-book line under it.
    expect(screen.getByRole("heading", { name: "Add Product" })).toBeInTheDocument();
    expect(screen.queryByText(/Priced from/)).toBeNull();
    expect(screen.queryByLabelText("Chosen product")).toBeNull();

    await user.click(screen.getByRole("combobox", { name: /Product/ }));
    await user.click(await screen.findByRole("option", { name: /WSO2 API Manager/ }));

    const card = within(screen.getByLabelText("Chosen product"));
    expect(card.getByText("WSO2 API Manager")).toBeInTheDocument();
    expect(card.getByText("APIM-GW")).toBeInTheDocument();
    expect(card.getByText("FY26 USD")).toBeInTheDocument();
    expect(card.getByText("USD 360")).toBeInTheDocument();

    // Its category comes from its classification (D152): nothing to choose,
    // and only the category is shown.
    expect(within(screen.getByLabelText("Category")).getByText("Subscription")).toBeInTheDocument();
    expect(screen.queryByText("Recurring")).toBeNull();
    expect(screen.queryByText(/Salesforce classification/)).toBeNull();
    expect(screen.queryByRole("combobox", { name: /Category/ })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Add product" }));
    // Product_Unit__c is the product family, so it no longer pre-fills the unit (2026-09-26).
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        pricebookEntryId: "01u000000000001",
        unitPrice: "360",
        unitOfMeasure: "",
        category: "SUBSCRIPTION",
        recurring: true,
        classification: "PS",
      }), []);
  });

  // The sales price is the list price unless the AM raises it; never lower.
  it("lets the AM raise the sales price, not lower it", async () => {
    const onSave = renderDialog();
    const user = await pick(/Enterprise Support Plan/); // list 25,000, mapped to Support
    const field = screen.getByRole("textbox", { name: "Sales price" });
    expect(field).toHaveAttribute("placeholder", "25000.00");
    expect(screen.getByText("List price USD 25,000. You can raise it, not lower it.")).toBeInTheDocument();

    await user.type(field, "24000");
    await user.click(screen.getByRole("button", { name: "Add product" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("The sales price can't be below the list price (25000.00)")).toBeInTheDocument();

    await user.clear(field);
    await user.type(field, "27500.50");
    await user.click(screen.getByRole("button", { name: "Add product" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ unitPrice: "25000", salesPrice: "27500.5" }), []);
  });

  // A bundle parent brings its children, same year and dates; "same quantity" ones take its quantity (D125).
  it("adds a bundle parent with the products that come with it", async () => {
    bundle.parents = { [gateway.id]: { children: [{ ...support, fixedQuantity: null }], missing: ["Onboarding"] } };
    try {
      const onSave = vi.fn();
      render(
        <DatePickers.LocalizationProvider dateAdapter={AdapterDateFns}>
          <AddLineDialog
            open
            line={null}
            currency="USD"
            pricebook={quoteBook}
            year={{ number: 2, start: "2028-01-01", end: "2028-12-31" }}
            onSave={onSave}
            onClose={vi.fn()}
          />
        </DatePickers.LocalizationProvider>,
      );
      const user = await pick(/WSO2 API Manager/);
      expect(screen.getByLabelText("Bundle")).toHaveTextContent("Comes with WSO2 Enterprise Support Plan - APIM");
      expect(screen.getByLabelText("Not in the price book")).toHaveTextContent("Not in FY26 USD, so not added: Onboarding");
      const qty = screen.getByRole("textbox", { name: "Quantity" });
      await user.clear(qty);
      await user.type(qty, "4");

      await user.click(screen.getByRole("button", { name: "Add 2 products" }));
      const [parent, children] = onSave.mock.calls[0] as [LineValue, LineValue[]];
      expect(children).toHaveLength(1);
      expect(children[0]).toMatchObject({ productId: support.id, quantity: "4", yearNumber: 2, category: "SUPPORT", parentKey: parent.key,
        bundleFixedQuantity: null });
    } finally {
      bundle.parents = {};
    }
  });

  // D131: a choice the AM must make (nothing picked for them), and an optional product.
  it("adds a bundle parent with the AM's picks only, once each choice is made", async () => {
    const enterprise = { ...support, fixedQuantity: 1, addMode: "CHOOSE_ONE", choiceName: "Support tier" };
    const premium = { ...support, id: "01t000000000009", name: "WSO2 Premium Support - APIM", productCode: "PREM-APIM", fixedQuantity: null, addMode: "CHOOSE_ONE", choiceName: "Support tier" };
    const training = { ...support, id: "01t000000000010", name: "Training", productCode: "TRN", fixedQuantity: 1, addMode: "OPTIONAL", choiceName: null };
    bundle.parents = { [gateway.id]: { children: [enterprise, premium, training], missing: [] } };
    try {
      const onSave = vi.fn();
      render(
        <DatePickers.LocalizationProvider dateAdapter={AdapterDateFns}>
          <AddLineDialog open line={null} currency="USD" pricebook={quoteBook} year={{ number: 1, start: "2027-01-01", end: "2027-12-31" }} onSave={onSave} onClose={vi.fn()} />
        </DatePickers.LocalizationProvider>,
      );
      const user = await pick(/WSO2 API Manager/);
      const picks = screen.getByRole("region", { name: "Comes with it" });
      expect(within(picks).getByRole("radio", { name: /Premium Support/ })).not.toBeChecked();
      expect(screen.getByText("To add: pick support tier")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Add product" })).toBeDisabled();

      await user.click(within(picks).getByRole("radio", { name: /Premium Support/ }));
      await user.click(within(picks).getByRole("checkbox", { name: /Training/ }));
      await user.click(screen.getByRole("button", { name: "Add 3 products" }));
      const [parent, children] = onSave.mock.calls[0] as [LineValue, LineValue[]];
      expect(children.map((c) => c.productId)).toEqual([premium.id, training.id]);
      expect(children.every((c) => c.parentKey === parent.key)).toBe(true);
    } finally {
      bundle.parents = {};
    }
  });

  // D131: editing the parent shows its picks; a new pick swaps the child, a kept one stays as it was.
  it("changes an edited parent's picks, keeping the children it keeps", async () => {
    const enterprise = { ...support, fixedQuantity: null, addMode: "CHOOSE_ONE", choiceName: "Support tier" };
    const premium = { ...support, id: "01t000000000009", name: "WSO2 Premium Support - APIM", productCode: "PREM-APIM", fixedQuantity: null, addMode: "CHOOSE_ONE", choiceName: "Support tier" };
    const training = { ...support, id: "01t000000000010", name: "Training", productCode: "TRN", fixedQuantity: 1, addMode: "OPTIONAL", choiceName: null };
    bundle.parents = { [gateway.id]: { children: [enterprise, premium, training], missing: [] } };
    const parentLine = { ...savedSupportLine(), lineId: 300, productId: gateway.id, productName: gateway.name, key: "p", parentKey: "", keepPricing: undefined, quantity: "4" } as LineValue;
    const kept = { ...savedSupportLine(), lineId: 302, productId: training.id, productName: "Training", key: "t", parentKey: "p", discount: "15", quantity: "1" } as LineValue;
    const old = { ...savedSupportLine(), lineId: 301, productId: enterprise.id, key: "e", parentKey: "p", quantity: "4" } as LineValue;
    try {
      const onSave = vi.fn();
      render(
        <DatePickers.LocalizationProvider dateAdapter={AdapterDateFns}>
          <AddLineDialog open line={parentLine} currentChildren={[old, kept]} currency="USD" pricebook={quoteBook} year={{ number: 1, start: "2027-01-01", end: "2027-12-31" }} onSave={onSave} onClose={vi.fn()} />
        </DatePickers.LocalizationProvider>,
      );
      const user = userEvent.setup();
      const picks = screen.getByRole("region", { name: "Comes with it" });
      expect(within(picks).getByRole("radio", { name: /Enterprise Support/ })).toBeChecked();
      expect(within(picks).getByRole("checkbox", { name: /Training/ })).toBeChecked();
      await user.click(within(picks).getByRole("radio", { name: /Premium Support/ }));
      await user.click(screen.getByRole("button", { name: "Save product" }));
      const [, children] = onSave.mock.calls[0] as [LineValue, LineValue[]];
      expect(children.map((c) => c.productId)).toEqual([premium.id, training.id]);
      expect(children[1]).toMatchObject({ lineId: 302, discount: "15" });
      expect(children[0]).toMatchObject({ lineId: null, quantity: "4", parentKey: "p" });
    } finally {
      bundle.parents = {};
    }
  });

  // D125: a child with a fixed quantity (Enterprise Support: always 1) whatever the parent's.
  it("adds a bundle child with its fixed quantity", async () => {
    bundle.parents = { [gateway.id]: { children: [{ ...support, fixedQuantity: 1 }], missing: [] } };
    try {
      const onSave = renderDialog();
      const user = await pick(/WSO2 API Manager/);
      expect(screen.getByLabelText("Bundle")).toHaveTextContent("WSO2 Enterprise Support Plan - APIM (always 1)");
      const qty = screen.getByRole("textbox", { name: "Quantity" });
      await user.clear(qty);
      await user.type(qty, "5");

      await user.click(screen.getByRole("button", { name: "Add 2 products" }));
      const [parent, children] = onSave.mock.calls[0] as [LineValue, LineValue[]];
      expect(parent.quantity).toBe("5");
      expect(children[0]).toMatchObject({ quantity: "1", bundleFixedQuantity: 1 });
    } finally {
      bundle.parents = {};
    }
  });

  // D125: the AM can't change a bundle child's quantity; the dialog says where it comes from.
  it("locks a bundle child's quantity", async () => {
    const onSave = renderDialog(vi.fn(), { ...savedSupportLine(), parentKey: "p", bundleFixedQuantity: 1 });
    const qty = screen.getByRole("textbox", { name: "Quantity" });
    expect(qty).toBeDisabled();
    expect(screen.getByText("Set by the bundle: always 1")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Save product" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ quantity: "1" }), null);
  });

  // A product whose bundle can't be read isn't added alone.
  it("won't add a product when what comes with it couldn't be checked", async () => {
    bundle.error = new Error("down");
    try {
      renderDialog();
      await pick(/WSO2 API Manager/);
      expect(screen.getByText(/Couldn't check what comes with this product/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Add product" })).toBeDisabled();
    } finally {
      bundle.error = undefined;
    }
  });

  it("takes a product's category from its classification, with no choice to make", async () => {
    const onSave = renderDialog();
    const user = await pick(/Enterprise Support Plan/);

    expect(within(screen.getByLabelText("Category")).getByText("Support")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /Category/ })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Add product" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ category: "SUPPORT" }), []);
  });

  it("can't add a product whose classification isn't set up (D152)", async () => {
    const problem =
      "WSO2 API Manager's classification, AI, isn't set up in QuickQuote. Ask an Admin to set it on Admin → Product Classifications.";
    const unset = { ...gateway, category: null, classification: "AI", classificationProblem: problem };
    productPages.override = [unset];
    try {
      const onSave = renderDialog();
      await pick(/WSO2 API Manager/);
      expect(screen.getByRole("alert", { name: "Classification" })).toHaveTextContent(problem);
      expect(screen.getByRole("button", { name: "Add product" })).toBeDisabled();
      expect(onSave).not.toHaveBeenCalled();
    } finally {
      productPages.override = undefined;
    }
  });

  it("keeps a saved line's category, with nothing to choose", async () => {
    const line: LineValue = {
      lineId: 7,
      pricebookEntryId: "01u000000000002",
      productName: "WSO2 Enterprise Support Plan - APIM",
      productCode: "SUP-APIM",
      productDescription: "",
      pricebookId: "01s1",
      pricebookName: "FY26 USD",
      unitPrice: "25000",
      category: "SUPPORT",
      recurring: true,
      classification: "PS",
      unitOfMeasure: "",
      quantity: "1",
      discount: "0",
      yearNumber: 1,
      startDate: "",
      endDate: "",
      salesPrice: "",
      key: `k-${Math.random()}`,
      parentKey: "",
      bundleFixedQuantity: null,
    };
    const onSave = renderDialog(vi.fn(), line);

    expect(screen.queryByRole("combobox", { name: /Category/ })).toBeNull();
    // The product can't be changed on a line: remove it and add another (2026-10-12).
    expect(screen.queryByRole("combobox", { name: /Product/ })).toBeNull();
    expect(screen.getByText(/remove this line and add it/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Save product" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ lineId: 7, category: "SUPPORT" }), null);
  });

  it("lists the quote's price book only, with its prices, and no choice of book", async () => {
    const onSave = renderDialog();
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: /Product/ }));

    expect(productPages.book).toBe("01s1");
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "WSO2 API Manager (APIM-GW)",
      "WSO2 Enterprise Support Plan - APIM (SUP-APIM)Based on the number of production gateways.",
    ]);
    expect(screen.getByText("All 2 products shown")).toBeInTheDocument();
    expect(screen.queryByText(/Not in |No category|Other price books/)).toBeNull();

    await user.click(screen.getByRole("option", { name: /Enterprise Support Plan/ }));
    expect(within(screen.getByLabelText("Chosen product")).getByText("FY26 USD")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /Price book/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Add product" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ pricebookId: "01s1", pricebookName: "FY26 USD", unitPrice: "25000" }), []);
  });

  it("says more are coming and loads the next page on scrolling to the end", async () => {
    productPages.more = true;
    try {
      renderDialog();
      await userEvent.setup().click(screen.getByRole("combobox", { name: /Product/ }));
      expect(screen.getByText("Showing 2 · scroll for more")).toBeInTheDocument();

      const list = screen.getByRole("listbox");
      Object.defineProperties(list, { scrollHeight: { value: 600 }, clientHeight: { value: 300 } });
      list.scrollTop = 290;
      list.dispatchEvent(new Event("scroll"));
      expect(productPages.fetchNextPage).toHaveBeenCalled();
    } finally {
      productPages.more = false;
    }
  });

  it("shows the description under the name, without repeating the name, and on the chosen product", async () => {
    const onSave = renderDialog();
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: /Product/ }));

    const option = screen.getByRole("option", { name: /Enterprise Support Plan/ });
    const about = within(option).getByText("Based on the number of production gateways.");
    expect(about).toHaveAttribute("title", "Based on the number of production gateways.");
    expect(within(screen.getByRole("option", { name: /WSO2 API Manager/ })).queryByText(/Based on/)).toBeNull();

    await user.click(option);
    expect(within(screen.getByLabelText("Chosen product")).getByText("Based on the number of production gateways.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add product" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        productDescription: "WSO2 Enterprise Support Plan - APIM. Based on the number of production gateways.",
      }), []);
  });

  // D114: shown in the table, not asked for here.
  it("has no unit of measure field", async () => {
    renderDialog();
    await pick(/WSO2 API Manager/);
    expect(screen.queryByRole("textbox", { name: "Unit of measure" })).toBeNull();
  });
});

// A click outside the dialog doesn't throw the typed line away (2026-10-13).
describe("AddLineDialog — closing", () => {
  it("shows a formula product's formula instead of a price, and takes a discount off it (D81, D149)", async () => {
    formulas.list = [supportFormula];
    try {
      const onSave = renderDialog();
      const user = await pick(/Enterprise Support Plan/);

      const card = within(screen.getByLabelText("Chosen product"));
      expect(card.getByText("By formula")).toBeInTheDocument();
      expect(card.queryByText("USD 25,000")).toBeNull();
      expect(card.getByText("Formula v3 · 15 Oct 2026")).toBeInTheDocument();
      expect(card.getByText("max($1, $2 * $3)")).toBeInTheDocument();
      expect(card.getByText("$1 = 25000 · $2 = 10% · $3 = total of WSO2 API Manager")).toBeInTheDocument();

      const discount = screen.getByRole("textbox", { name: "Discount" });
      expect(discount).toBeEnabled();
      expect(screen.getByText("Off the formula price")).toBeInTheDocument();
      await user.clear(discount);
      await user.type(discount, "5");
      // A new line's formula price is worked out on the quote.
      expect(screen.getByLabelText("Price after discount")).toHaveTextContent("5% off the formula price, once it's worked out on the quote.");
      // A formula's price can't be overridden.
      expect(screen.getByRole("textbox", { name: "Sales price" })).toBeDisabled();
      expect(screen.getByText("Priced by formula: the price can't be changed")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Add product" }));
      // D83: the unit of measure comes from the formula version, saved with the line.
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: support.id,
          discount: "5",
          salesPrice: "",
          unitOfMeasure: "Annual, higher of 25,000 or 10% of subscription",
        }),
        [],
      );
    } finally {
      formulas.list = [];
    }
  });

  // D82, the case of quote 57: a saved formula line shows the price it was
  // worked out at and its version, even after the formula was removed.
  it("shows a saved formula line's own price and version, and lets the AM move it to the price book", async () => {
    formulas.list = [{ ...supportFormula, versionId: 7, version: 4, status: "REMOVED", expression: "", bindings: [], updatedAt: "2026-10-16T10:00:00Z" }];
    try {
      const onSave = renderDialog(vi.fn(), savedSupportLine());
      const card = within(screen.getByLabelText("Chosen product"));
      expect(card.getByText("USD 414,000")).toBeInTheDocument();
      expect(card.getByText("per unit, by formula")).toBeInTheDocument();
      expect(card.queryByText("per unit, from the price book")).toBeNull();
      expect(card.getByText("Formula v3 · 15 Oct 2026")).toBeInTheDocument();
      expect(card.getByText("= max(25,000, 4,140,000 × 10%)")).toBeInTheDocument();
      // D149: the discount is taken off the formula price, shown worked out.
      const discount = screen.getByRole("textbox", { name: "Discount" });
      expect(discount).toBeEnabled();
      await userEvent.setup().clear(discount);
      await userEvent.setup().type(discount, "5");
      expect(screen.getByLabelText("Price after discount")).toHaveTextContent(
        "Formula priceUSD 414,000.00Discount 5%− USD 20,700.00Price after discount, per unitUSD 393,300.00",
      );

      expect(screen.getByText(/This formula was removed on 16 Oct 2026/)).toBeInTheDocument();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Use the price-book price" }));
      const moved = within(screen.getByLabelText("Chosen product"));
      expect(moved.getByText("USD 53,000")).toBeInTheDocument();
      expect(moved.getByText("per unit, from the price book")).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "Discount" })).toBeEnabled();
      await user.click(screen.getByRole("button", { name: "Save product" }));
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ lineId: 228, useLatestPricing: true, unitPrice: "53000", unitOfMeasure: "" }), null);
    } finally {
      formulas.list = [];
    }
  });

  it("keeps a saved line on its version unless the AM moves it to the newer one", async () => {
    formulas.list = [{ ...supportFormula, versionId: 8, version: 4, updatedAt: "2026-10-20T10:00:00Z" }];
    try {
      const onSave = renderDialog(vi.fn(), savedSupportLine());
      expect(screen.getByText(/A newer version of this formula is in force: v4 · 20 Oct 2026/)).toBeInTheDocument();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Save product" }));
      expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ useLatestPricing: undefined }), null);
      expect(onSave.mock.lastCall?.[0].keepPricing.formulaVersionId).toBe(6);
    } finally {
      formulas.list = [];
    }
  });

  it("offers a formula introduced since a price-book line was saved, without applying it", async () => {
    formulas.list = [supportFormula];
    try {
      const line = { ...savedSupportLine(), unitPrice: "25000", keepPricing: { method: "PRICE_BOOK" as const, formulaVersionId: null, formula: null } };
      renderDialog(vi.fn(), line);
      expect(within(screen.getByLabelText("Chosen product")).getByText("per unit, from the price book")).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "Discount" })).toBeEnabled();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Use the formula" }));
      expect(within(screen.getByLabelText("Chosen product")).getByText("By formula")).toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "Discount" })).toBeEnabled(); // D149
    } finally {
      formulas.list = [];
    }
  });

  // D146: a recurring line covers its whole year (here a shortened last
  // year); it has no date fields and saves none.
  it("shows a recurring line's whole year instead of date fields", async () => {
    const onSave = vi.fn();
    const line = { ...savedSupportLine(), yearNumber: 3, keepPricing: undefined, unitPrice: "25000" };
    render(
      <DatePickers.LocalizationProvider dateAdapter={AdapterDateFns}>
        <AddLineDialog open line={line} currency="USD" pricebook={quoteBook} year={shortYear3} onSave={onSave} onClose={vi.fn()} />
      </DatePickers.LocalizationProvider>,
    );
    expect(screen.getByText(/Covers the whole of Year 3/)).toBeInTheDocument();
    expect(screen.getByText("1 Jan 2028 – 30 Jun 2028")).toBeInTheDocument();
    expect(screen.getByText(/6 months/)).toBeInTheDocument();
    expect(screen.queryByText("Charged on")).toBeNull();
    expect(screen.queryByText("Start")).toBeNull();

    await userEvent.setup().click(screen.getByRole("button", { name: "Save product" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ startDate: "", endDate: "" }), null);
  });

  // D146: a one-off line has a start and an end, both within its year.
  it("asks a one-off line for a start and an end within its year", async () => {
    const onSave = vi.fn();
    const oneOff = (endDate: string) => ({
      ...savedSupportLine(),
      yearNumber: 3,
      keepPricing: undefined,
      unitPrice: "1260",
      recurring: false,
      classification: "TR",
      startDate: "2028-03-01",
      endDate,
    });
    const { unmount } = render(
      <DatePickers.LocalizationProvider dateAdapter={AdapterDateFns}>
        <AddLineDialog open line={oneOff("2028-07-15")} currency="USD" pricebook={quoteBook} year={shortYear3} onSave={onSave} onClose={vi.fn()} />
      </DatePickers.LocalizationProvider>,
    );
    expect(screen.queryByText("Charged on")).toBeNull();
    expect(screen.getAllByText("Start").length).toBeGreaterThan(0);
    expect(screen.getAllByText("End").length).toBeGreaterThan(0);
    expect(screen.getByText(/One-time: charged once, in full/)).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Save product" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Dates must fall within Year 3: 1 Jan 2028 – 30 Jun 2028")).toBeInTheDocument();
    unmount();

    render(
      <DatePickers.LocalizationProvider dateAdapter={AdapterDateFns}>
        <AddLineDialog open line={oneOff("2028-03-14")} currency="USD" pricebook={quoteBook} year={shortYear3} onSave={onSave} onClose={vi.fn()} />
      </DatePickers.LocalizationProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Save product" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ startDate: "2028-03-01", endDate: "2028-03-14" }), null);
  });

  // Starting on the year's first day, its real dates are saved, not "the
  // year's start": they stay put when the term start moves (D146).
  it("saves a one-off line's real dates even on its year's first day", async () => {
    const onSave = vi.fn();
    const line = { ...savedSupportLine(), yearNumber: 3, keepPricing: undefined, unitPrice: "1260", recurring: false, startDate: "", endDate: "" };
    render(
      <DatePickers.LocalizationProvider dateAdapter={AdapterDateFns}>
        <AddLineDialog open line={line} currency="USD" pricebook={quoteBook} year={shortYear3} onSave={onSave} onClose={vi.fn()} />
      </DatePickers.LocalizationProvider>,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "Save product" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ startDate: "2028-01-01", endDate: "2028-01-01" }), null);
  });

  it("stays open on a click outside it; Cancel closes it", async () => {
    const onClose = vi.fn();
    render(
      <DatePickers.LocalizationProvider dateAdapter={AdapterDateFns}>
        <AddLineDialog open line={null} currency="USD" pricebook={quoteBook} year={null} onSave={vi.fn()} onClose={onClose} />
      </DatePickers.LocalizationProvider>,
    );
    const user = userEvent.setup();
    const backdrop = document.querySelector(".MuiBackdrop-root") as HTMLElement;
    await user.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });
});
