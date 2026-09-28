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
import type { BankAccount } from "@features/my/api/types";

const accounts = vi.hoisted(() => ({
  data: [] as BankAccount[],
}));
const approveAccount = vi.hoisted(() => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue(undefined),
  isPending: false,
}));
const rejectAccount = vi.hoisted(() => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue(undefined),
  isPending: false,
}));

vi.mock("@features/my/api/usePendingSalaryAccounts", () => ({
  usePendingSalaryAccounts: () => ({
    data: { bankAccounts: accounts.data, count: accounts.data.length },
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("@features/my/api/useApproveAccount", () => ({ useApproveAccount: () => approveAccount }));
vi.mock("@features/my/api/useRejectAccount", () => ({ useRejectAccount: () => rejectAccount }));

const { default: ChangeRequestsTab } = await import("./ChangeRequestsTab");

function bankAccount(overrides: Partial<BankAccount> = {}): BankAccount {
  return {
    accountId: 1,
    employeeEmail: "jane@wso2.com",
    accountName: "Jane Doe",
    accountNumber: "123456789",
    accountStatus: "REQUESTED",
    accountType: "SALARY",
    bankCode: "COM001",
    bankSwiftCode: "COMBLK",
    bankName: "Commercial Bank",
    bankLocation: "Sri Lanka",
    branchCode: "001",
    branchName: "Colombo",
    beneficiaryAddress: "123 Main St",
    bankAddress: "456 Bank Rd",
    paymentMethod: null,
    effectiveFrom: "2026-10-01",
    createdOn: "2026-09-01",
    netSuiteInternalId: "NS-1",
    netSuiteVendorId: "V-1",
    netSuitePaymentFileFormat: "ACH",
    ...overrides,
  };
}

beforeEach(() => {
  accounts.data = [];
  approveAccount.mutate.mockReset();
  approveAccount.mutateAsync.mockReset().mockResolvedValue(undefined);
  rejectAccount.mutate.mockReset();
  rejectAccount.mutateAsync.mockReset().mockResolvedValue(undefined);
});

describe("ChangeRequestsTab list", () => {
  it("renders every pending request", () => {
    accounts.data = [
      bankAccount({ accountId: 1, employeeEmail: "jane@wso2.com" }),
      bankAccount({ accountId: 2, employeeEmail: "john@wso2.com" }),
    ];
    render(<ChangeRequestsTab />);
    expect(screen.getByText("jane@wso2.com")).toBeInTheDocument();
    expect(screen.getByText("john@wso2.com")).toBeInTheDocument();
  });

  it("shows a clear empty state when there are no pending requests", () => {
    render(<ChangeRequestsTab />);
    expect(screen.getByText(/no pending/i)).toBeInTheDocument();
  });

  it("filters the list by employee email", async () => {
    const user = userEvent.setup();
    accounts.data = [
      bankAccount({ accountId: 1, employeeEmail: "jane@wso2.com" }),
      bankAccount({ accountId: 2, employeeEmail: "john@wso2.com" }),
    ];
    render(<ChangeRequestsTab />);
    await user.type(screen.getByPlaceholderText("Search by employee email"), "jane");
    expect(screen.getByText("jane@wso2.com")).toBeInTheDocument();
    expect(screen.queryByText("john@wso2.com")).not.toBeInTheDocument();
  });
});

describe("ChangeRequestsTab actions", () => {
  it("approves a request once confirmed", async () => {
    const user = userEvent.setup();
    accounts.data = [bankAccount({ accountId: 7 })];
    render(<ChangeRequestsTab />);
    await user.click(screen.getByRole("button", { name: "Approve" }));
    await user.click(await screen.findByRole("button", { name: "Confirm" }));
    expect(approveAccount.mutateAsync).toHaveBeenCalledWith(7);
  });

  it("sends only one approve request when Confirm is pressed twice in quick succession", async () => {
    const user = userEvent.setup();
    let finish: () => void = () => {};
    approveAccount.mutateAsync.mockReset().mockReturnValue(new Promise<undefined>((resolve) => (finish = () => resolve(undefined))));
    accounts.data = [bankAccount({ accountId: 7 })];
    render(<ChangeRequestsTab />);
    await user.click(screen.getByRole("button", { name: "Approve" }));
    await user.dblClick(await screen.findByRole("button", { name: "Confirm" }));
    expect(approveAccount.mutateAsync).toHaveBeenCalledTimes(1);
    finish();
  });

  it("blocks Reject until a reason is entered", async () => {
    const user = userEvent.setup();
    accounts.data = [bankAccount({ accountId: 7 })];
    render(<ChangeRequestsTab />);
    await user.click(screen.getByRole("button", { name: "Reject" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Reject" })).toBeDisabled();
    expect(rejectAccount.mutateAsync).not.toHaveBeenCalled();
  });

  it("rejects a request with the entered reason", async () => {
    const user = userEvent.setup();
    accounts.data = [bankAccount({ accountId: 7 })];
    render(<ChangeRequestsTab />);
    await user.click(screen.getByRole("button", { name: "Reject" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Reason for Rejection"), "Invalid account details");
    await user.click(within(dialog).getByRole("button", { name: "Reject" }));
    expect(rejectAccount.mutateAsync).toHaveBeenCalledWith({
      accountId: 7,
      rejectionReason: "Invalid account details",
    });
  });

  it("opens the Info dialog with the full record", async () => {
    const user = userEvent.setup();
    accounts.data = [bankAccount({ accountId: 7, netSuiteInternalId: "NS-42" })];
    render(<ChangeRequestsTab />);
    await user.click(screen.getByRole("button", { name: "Info" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/NS-42/)).toBeInTheDocument();
    expect(within(dialog).getByText(/123456789/)).toBeInTheDocument();
  });
});
