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

function renderDialog() {
  render(<OpportunityLinesDialog open opportunityId="006A" opportunityName="Acme Bank – Renewal 2027" onClose={vi.fn()} />);
  return within(screen.getByRole("dialog", { name: /Line items in Salesforce/ }));
}

beforeEach(() => {
  Object.assign(query, { data: undefined, error: null, isPending: false, isFetching: false });
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
        },
      ],
    };
    const dialog = renderDialog();

    expect(dialog.getByText("Acme Bank – Renewal 2027")).toBeInTheDocument();
    const rows = dialog.getAllByRole("row");
    expect(within(rows[0]).getAllByRole("columnheader").map((c) => c.textContent)).toEqual([
      "Product",
      "Qty",
      "Sales price",
      "Discount",
      "Total price",
      "Commission %",
      "Service start",
      "Service end",
    ]);
    expect(within(rows[1]).getAllByRole("cell").map((c) => c.textContent)).toEqual([
      "Integrator: Production coresINT-PROD-CORE",
      "4",
      "9,000",
      "25%",
      "27,000.00",
      "10%",
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
      "—",
    ]);
    expect(dialog.getByText(/Prices in EUR/)).toBeInTheDocument();
  });

  it("says so when the opportunity has no line items", () => {
    query.data = { currency: "USD", lines: [] };
    expect(renderDialog().getByText("No line items on this opportunity in Salesforce.")).toBeInTheDocument();
  });

  it("offers a retry when Salesforce can't be read", async () => {
    query.error = new Error("boom");
    const dialog = renderDialog();

    expect(dialog.getByText(/Couldn't read the line items from Salesforce\./)).toBeInTheDocument();
    await userEvent.setup().click(dialog.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalled();
  });
});
