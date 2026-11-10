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
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OpportunityLinesDialog from "./OpportunityLinesDialog";

const refetch = vi.fn();
const query = { data: undefined as unknown, error: null as unknown, isPending: false, isFetching: false, refetch };
vi.mock("@features/sales/cado2/quotes/api/useQuoteApi", () => ({ useOpportunityLines: () => query }));

const onLoad = vi.fn();
function renderDialog(productCount = 0) {
  render(
    <OpportunityLinesDialog
      open
      opportunityId="006A"
      opportunityName="Acme Bank – Renewal 2027"
      pricebookId="01sQQ"
      currency="USD"
      productCount={productCount}
      onLoad={onLoad}
      onClose={vi.fn()}
    />,
  );
  return within(screen.getByRole("dialog", { name: /Import renewal products from Salesforce/ }));
}

// D150: a line as the backend checks it.
const loadOf = (id: string) => ({
  pricebookEntryId: `01u${id}`,
  productId: `01t${id}`,
  productName: `Product ${id}`,
  productCode: null,
  productDescription: null,
  pricebookId: "01sQQ",
  pricebookName: "QuickQuote USD 2027",
  unitPrice: "16000",
  salesPrice: null,
  quantity: "20",
  discount: "10",
  category: "SUBSCRIPTION",
  classification: "PS",
  recurring: true,
  formula: false,
});
const sfLine = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  productName: `Product ${id}`,
  productCode: null,
  quantity: "20",
  salesPrice: "16000",
  discount: "10",
  totalPrice: "288000.00",
  commissionPercent: null,
  serviceStartDate: "2027-02-01",
  serviceEndDate: "2028-01-31",
  problems: [],
  load: loadOf(id),
  ...over,
});
const renewalCheck = (over: Record<string, unknown> = {}) => ({
  problems: [],
  canLoad: true,
  isRenewal: true,
  subsStartDate: "2027-02-01",
  subsEndDate: "2028-01-31",
  pricebookName: "QuickQuote USD 2027",
  ...over,
});

beforeEach(() => {
  Object.assign(query, { data: undefined, error: null, isPending: false, isFetching: false });
  onLoad.mockReset();
});

describe("OpportunityLinesDialog", () => {
  // D147: what the AM quotes from, read only.
  it("shows the opportunity's line items as a table, in its currency", () => {
    query.data = {
      currency: "EUR",
      lines: [
        {
          id: "00kA",
          productName: "Integrator: Production cores",
          productCode: "INT-PROD-CORE",
          quantity: "4",
          salesPrice: "9000",
          discount: "25",
          totalPrice: "27000.00",
          commissionPercent: "10",
          serviceStartDate: "2027-01-01",
          serviceEndDate: "2028-01-01",
          problems: null,
          load: null,
        },
        {
          id: "00kB",
          productName: "QuickStart Program",
          productCode: null,
          quantity: null,
          salesPrice: "18000",
          discount: null,
          totalPrice: "18000.00",
          commissionPercent: null,
          serviceStartDate: null,
          serviceEndDate: null,
          problems: null,
          load: null,
        },
      ],
      check: null,
    };
    const dialog = renderDialog();

    expect(dialog.getByText("Acme Bank – Renewal 2027 · prices in EUR")).toBeInTheDocument();
    const rows = dialog.getAllByRole("row");
    expect(within(rows[0]).getAllByRole("columnheader").map((c) => c.textContent)).toEqual([
      "Product",
      "Qty",
      "Sales price",
      "Discount",
      "Total price",
      "Service start",
      "Service end",
    ]);
    expect(within(rows[1]).getAllByRole("cell").map((c) => c.textContent)).toEqual([
      "Integrator: Production coresINT-PROD-CORE",
      "4",
      "9,000",
      "25%",
      "27,000.00",
      "1 Jan 2027",
      "1 Jan 2028",
    ]);
    expect(within(rows[2]).getAllByRole("cell").map((c) => c.textContent)).toEqual([
      "QuickStart Program",
      "—",
      "18,000",
      "—",
      "18,000.00",
      "—",
      "—",
    ]);
  });

  it("says so when the opportunity has no line items", () => {
    query.data = { currency: "USD", lines: [], check: null };
    expect(renderDialog().getByText("No line items on this opportunity in Salesforce.")).toBeInTheDocument();
  });

  it("loads a clean renewal in one go, warning that it replaces the quote's products", async () => {
    query.data = { currency: "USD", lines: [sfLine("GW"), sfLine("SUP")], check: renewalCheck() };
    const dialog = renderDialog(1);

    expect(dialog.getByLabelText("Status")).toHaveTextContent("Ready to load. All 2 lines match the quote's price book and term.");
    expect(dialog.getAllByLabelText("OK")).toHaveLength(2);
    expect(dialog.getByText("Replaces the 1 product already on this quote.")).toBeInTheDocument();
    await userEvent.setup().click(dialog.getByRole("button", { name: "Load into quote" }));
    expect(onLoad).toHaveBeenCalledWith([loadOf("GW"), loadOf("SUP")], renewalCheck());
  });

  it("says in one line why it can't load, with a short reason on each failing line", () => {
    const below = { short: "Price below book", detail: "Sales price 900.00 is below the price book's 16,000.00." };
    const bad = sfLine("MI", { problems: [below, { short: "Dates differ", detail: "Its dates don't match the subscription." }] });
    const missing = sfLine("CG", { problems: [{ short: "Not in price book", detail: "Not in the quote's price book." }], load: null });
    query.data = {
      currency: "USD",
      lines: [bad, sfLine("SUP"), missing],
      check: renewalCheck({ canLoad: false, problems: [{ short: "the term is 1 year and 1 day", detail: "The term is …" }] }),
    };
    const dialog = renderDialog();

    expect(dialog.getByLabelText("Status")).toHaveTextContent(
      "Can't load automatically: the term is 1 year and 1 day; 2 lines need fixing. Add the products by hand.",
    );
    expect(dialog.getByText("Price below book +1")).toBeInTheDocument();
    expect(dialog.getByText("Not in price book")).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Load into quote" })).toBeDisabled();
    expect(dialog.queryByRole("button", { name: /^Add / })).toBeNull(); // one rule: all or nothing
  });

  it("offers a retry when Salesforce can't be read", async () => {
    query.error = new Error("boom");
    const dialog = renderDialog();

    expect(dialog.getByText(/Couldn't read the line items from Salesforce\./)).toBeInTheDocument();
    await userEvent.setup().click(dialog.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalled();
  });
});
