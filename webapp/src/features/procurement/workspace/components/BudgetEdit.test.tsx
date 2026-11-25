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
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PurchaseRequest } from "../../types";
import BudgetEdit from "./BudgetEdit";

const change = vi.hoisted(() => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, isError: false, error: null as unknown }));
const showSuccess = vi.hoisted(() => vi.fn());
vi.mock("@context/notifications/NotificationsContext", () => ({ useNotifications: () => ({ showSuccess }) }));
vi.mock("../../api/useProcurement", () => {
  const settled = { isFetching: false, isError: false, error: null, refetch: vi.fn() };
  return {
    useChangeBudget: () => change,
    useProcurementLookups: () => ({
      ...settled,
      data: {
        budgetCategories: [{ value: "CAT-1", label: "Software" }, { value: "CAT-2", label: "Hardware" }],
        businessUnits: [{ value: "BU-1", label: "Sales" }, { value: "BU-2", label: "Engineering" }],
        products: [{ value: "PRD-1", label: "Choreo" }, { value: "PRD-2", label: "Asgardeo" }],
        regions: [{ value: "REG-1", label: "Global" }, { value: "REG-2", label: "APAC" }],
      },
    }),
    useEngagementCodes: (unit: string) => ({ ...settled, data: unit ? [{ value: `ENG-${unit}`, label: `ENG-${unit} - Platform` }] : [] }),
    useBudgetApprovers: () => ({ ...settled, data: [{ id: "10", name: "Budget Owner" }, { id: "11", name: "Regional Owner" }] }),
  };
});

const request = (patch: Partial<PurchaseRequest> = {}): PurchaseRequest =>
  ({
    id: "7",
    category: "NON-IT",
    status: "approved",
    requester: { id: "alex@example.com", name: "Alex Morgan", email: "alex@example.com" },
    teamLead: { id: "lead@example.com", name: "Lead", email: "lead@example.com" },
    additionalApprovers: ["second@example.com"],
    budget: { category: "CAT-1", businessUnit: "BU-1", product: "PRD-1", region: "REG-1", engagementCode: "ENG-Sales", salesforceCampaign: "" },
    budgetApproverId: "10",
    budgetApproverName: "Budget Owner",
    ...patch,
  }) as PurchaseRequest;

const open = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: "Edit budget details" }));
  return screen.getByRole("dialog", { name: "Edit budget details" });
};
const pick = async (user: ReturnType<typeof userEvent.setup>, field: string, option: string) => {
  await user.click(screen.getByRole("combobox", { name: new RegExp(field) }));
  await user.click(await screen.findByRole("option", { name: option }));
};

beforeEach(() => {
  change.mutate.mockReset().mockImplementation((_value: unknown, options?: { onSuccess?: () => void }) => options?.onSuccess?.());
  change.reset.mockReset();
  showSuccess.mockReset();
  change.isPending = false;
  change.isError = false;
  change.error = null;
});

describe("BudgetEdit", () => {
  it("is a pencil that opens a pop-up with the budget details as they are now, and nothing to save yet", async () => {
    const user = userEvent.setup();
    render(<BudgetEdit request={request()} me="pat@example.com" />);
    expect(screen.queryByRole("dialog")).toBeNull();
    const dialog = await open(user);
    expect(within(dialog).getByRole("combobox", { name: /Budget category/ })).toHaveValue("Software");
    expect(within(dialog).getByRole("combobox", { name: /Business unit/ })).toHaveValue("Sales");
    expect(within(dialog).getByRole("combobox", { name: /Budget approver/ })).toHaveValue("Budget Owner");
    expect(within(dialog).getByRole("button", { name: "Save budget" })).toBeDisabled();
  });

  it("saves the changed details only when Save is pressed, closes, and reports that the requester is emailed", async () => {
    const user = userEvent.setup();
    render(<BudgetEdit request={request()} me="pat@example.com" />);
    const dialog = await open(user);
    await pick(user, "Product", "Asgardeo");
    expect(change.mutate).not.toHaveBeenCalled();
    expect(within(dialog).getByText("The requester will be notified by email with the new details when you save.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Save budget" }));
    expect(change.mutate).toHaveBeenCalledWith(
      { budget: { category: "CAT-1", businessUnit: "BU-1", product: "PRD-2", region: "REG-1", engagementCode: "ENG-Sales", salesforceCampaign: "" }, budgetApproverId: "10" },
      expect.anything(),
    );
    expect(showSuccess).toHaveBeenCalledWith("Budget details have been updated. The requester has been notified by email.");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("clears the engagement code and the approver when the business unit changes, and a Non-IT request cannot be saved without a code", async () => {
    const user = userEvent.setup();
    render(<BudgetEdit request={request()} me="pat@example.com" />);
    const dialog = await open(user);
    await pick(user, "Business unit", "Engineering");
    // A required list is a plain select, so its value is its text rather than an input's value.
    expect(within(dialog).getByRole("combobox", { name: /Engagement code/ })).not.toHaveTextContent("ENG-Sales");
    expect(within(dialog).getByRole("combobox", { name: /Budget approver/ })).toHaveValue("");
    expect(within(dialog).getByRole("button", { name: "Save budget" })).toBeDisabled();
    await pick(user, "Engagement code", "ENG-Engineering - Platform");
    expect(within(dialog).getByRole("button", { name: "Save budget" })).toBeEnabled();
  });

  it("lets an IT request keep a blank engagement code", async () => {
    const user = userEvent.setup();
    render(<BudgetEdit request={request({ category: "IT", budget: { ...request().budget, engagementCode: "" } })} me="pat@example.com" />);
    const dialog = await open(user);
    await pick(user, "Product", "Asgardeo");
    expect(within(dialog).getByRole("button", { name: "Save budget" })).toBeEnabled();
  });

  it("closes without saving on Cancel, and opens again with the details as they were", async () => {
    const user = userEvent.setup();
    render(<BudgetEdit request={request()} me="pat@example.com" />);
    let dialog = await open(user);
    await pick(user, "Product", "Asgardeo");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(change.mutate).not.toHaveBeenCalled();
    dialog = await open(user);
    expect(within(dialog).getByRole("combobox", { name: /Product/ })).toHaveValue("Choreo");
  });

  it.each([["the requester", "alex@example.com"], ["the team lead", "lead@example.com"], ["an additional approver", "Second@example.com"]])(
    "is not offered to %s",
    (_who, me) => {
      render(<BudgetEdit request={request()} me={me} />);
      expect(screen.queryByRole("button", { name: "Edit budget details" })).toBeNull();
    },
  );

  it("keeps the pop-up open and shows what the backend said when saving fails", async () => {
    change.mutate.mockReset();
    change.isError = true;
    change.error = new Error("Budget approver not found.");
    const user = userEvent.setup();
    render(<BudgetEdit request={request()} me="pat@example.com" />);
    const dialog = await open(user);
    expect(within(dialog).getByText("Budget approver not found.")).toBeInTheDocument();
  });

  it("ignores Escape while the save runs, and closes on Escape otherwise", async () => {
    const user = userEvent.setup();
    for (const saving of [true, false]) {
      change.isPending = saving;
      const { unmount } = render(<BudgetEdit request={request()} me="pat@example.com" />);
      await open(user);
      await user.keyboard("{Escape}");
      if (saving) expect(screen.getByRole("dialog", { name: "Edit budget details" })).toBeInTheDocument();
      else await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      unmount();
    }
  });
});
