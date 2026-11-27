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
import type { Invoice, UserInfo } from "../api/engagementTypes";

const state = {
  info: { email: "po@wso2.com", allocations: { privileges: [1] }, travel: { privileges: [2, 32, 39, 41] } } as UserInfo,
  invoices: [] as Invoice[],
};
const batch = vi.fn();
const showSuccess = vi.fn();
const showError = vi.fn();

// The header search box has its own tests.
vi.mock("../search/GlobalSearch", () => ({ default: () => null }));
vi.mock("../api/useEngagementUserInfo", async () => {
  const { engagementAccess } = await import("../model/engagementAccess");
  return { useEngagementAccess: () => engagementAccess(state.info), useEngagementUserInfo: () => ({ data: state.info }) };
});
vi.mock("../api/useEngagementApi", () => {
  const page = () => ({ data: { items: state.invoices, total: state.invoices.length, counts: { "approve-po": 1 } }, isPending: false, isError: false });
  return {
    useInvoices: page,
    useCampaigns: () => ({ data: [] }),
    useReferenceData: () => ({ data: undefined }),
    usePerDiemPayments: () => ({ data: { items: [], total: 0 }, isPending: false, isError: false }),
    useSyncFailures: () => ({ data: { items: [], total: 0 }, isPending: false, isError: false }),
  };
});
vi.mock("../api/useEngagementMutations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/useEngagementMutations")>()),
  useInvoiceBatch: () => ({ mutateAsync: batch }),
  usePaymentBatch: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@context/notifications/NotificationsContext", () => ({ useNotifications: () => ({ showSuccess, showError, showWarning: vi.fn() }) }));

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import InvoicesPage from "./InvoicesPage";

const invoice = (id: string, status: Invoice["status"]): Invoice => ({
  id,
  number: `NO-${id}`,
  jobNumber: "TRV-2026-10-1246",
  travelAgent: "Acorn Travels",
  costType: "Hotel",
  month: "October",
  amount: 402000,
  currency: "LKR",
  status,
  nsStatus: "Pending",
  addedDate: "2026-10-03",
});

const draw = () =>
  render(
    <MemoryRouter initialEntries={["/finance/engagement-app/invoices/all-invoices"]}>
      <InvoicesPage tab="all-invoices" />
    </MemoryRouter>,
  );

beforeEach(() => {
  state.invoices = [invoice("1", "Pending"), invoice("2", "Pending"), invoice("3", "Accepted by travel")];
  batch.mockReset();
  showSuccess.mockClear();
  showError.mockClear();
});

describe("Invoices & Payments", () => {
  it("offers the PO approver's queue, then All Invoices and All Per Diem Payments", () => {
    draw();
    const tabs = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(tabs[0]).toContain("Invoices to Approve (PO)");
    expect(tabs.some((t) => t?.includes("All Invoices"))).toBe(true);
    expect(tabs.some((t) => t?.includes("Invoices to Approve") && !t.includes("(PO)"))).toBe(false);
  });

  it("lets the PO approver select only invoices at the PO step", () => {
    draw();
    expect(screen.getByRole("checkbox", { name: "Select invoice NO-1" })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: "Select invoice NO-3" })).toBeDisabled();
  });

  it("approves the selection in one request and reports what failed without stopping the rest", async () => {
    const user = userEvent.setup();
    batch.mockResolvedValueOnce({ done: ["1"], failed: [{ id: "2", message: "Problem in Travel Invoice Status" }] });
    draw();
    await user.click(screen.getByRole("checkbox", { name: "Select invoice NO-1" }));
    await user.click(screen.getByRole("checkbox", { name: "Select invoice NO-2" }));
    await user.click(screen.getByRole("button", { name: /Approve \(PO\)/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Approve" }));
    expect(batch).toHaveBeenCalledTimes(1);
    expect(batch).toHaveBeenCalledWith({ action: "approve", ids: ["1", "2"], reason: undefined, idempotencyKey: undefined });
    expect(showSuccess).toHaveBeenCalledWith("1 invoice approved");
    expect(showError).toHaveBeenCalledWith("1 invoice could not be approved: Problem in Travel Invoice Status");
  });

  it("needs a reason to reject", async () => {
    const user = userEvent.setup();
    draw();
    await user.click(screen.getByRole("checkbox", { name: "Select invoice NO-1" }));
    await user.click(screen.getByRole("button", { name: /Reject \(PO\)/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Reject" }));
    expect(within(dialog).getByText("Add the reason for rejecting")).toBeInTheDocument();
    expect(batch).not.toHaveBeenCalled();
  });
});
