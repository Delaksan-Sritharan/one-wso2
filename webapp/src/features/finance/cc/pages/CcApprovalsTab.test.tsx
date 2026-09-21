/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";

// Everything CcApproveDetail and the grid itself render — field labels, the
// amount column, the row-selection rules — is already covered against
// CcApprovePage. This file only covers what the Claim Approval tab does
// differently: its own connectivity notice, and the "As lead / As finance"
// toggle standing in for the standalone screen's dropdown.

vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));

const configured = { value: true };
vi.mock("@config/apiConfig", async () => {
  const actual = await vi.importActual<typeof import("@config/apiConfig")>("@config/apiConfig");
  return { ...actual, isCcBackendConfigured: () => configured.value };
});

const txn = {
  id: 1,
  ccNumber: "4444",
  txnDate: "2026-08-20",
  txnDescription: "Hotel",
  txnAmount: 500,
  status: "pending_lead",
  expenseTypeId: 1,
  expenseCategoryLabel: "Travel",
  expenseTypeLabel: "Hotels",
  txnComment: "Client trip",
  receiptFileName: "r.pdf",
  contractFileName: null,
  subRegion: null,
  travelJobNumber: "JOB-1",
  productUnit: "Integration",
  businessUnit: "Platform",
  employeeEmail: "someone@wso2.com",
  leadEmail: "lead@wso2.com",
  financeApproverEmail: null,
  empPostedDate: null,
  leadApprovedDate: null,
  financeApprovedDate: null,
  reportSequenceNumber: null,
};

const state = { access: ["lead", "finance"] as string[] };

vi.mock("../useCc", () => ({
  useCcUserInfo: () => ({
    data: { workEmail: "lead@wso2.com", accessLevels: state.access },
    isLoading: false,
    isError: false,
  }),
  useCcTransactions: () => ({ data: [txn], isLoading: false, isError: false }),
  useCreditCards: () => ({
    data: [{ id: 1, ccNumber: "4444", leadEmail: "lead@wso2.com", employeeEmail: "someone@wso2.com", status: "Active" }],
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("../ccTypes", async () => {
  const actual = await vi.importActual<typeof import("../ccTypes")>("../ccTypes");
  return { ...actual, ccHasAccess: (_u: unknown, lvl: string) => state.access.includes(lvl) };
});

vi.mock("../useCcMutations", () => ({
  useCcApprove: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCcSaveEdit: () => ({ mutate: vi.fn(), isPending: false }),
  useCcAttachment: () => ({
    upload: { mutateAsync: vi.fn(), isPending: false },
    remove: { mutateAsync: vi.fn(), isPending: false },
  }),
}));

const { default: CcApprovalsTab } = await import("./CcApprovalsTab");
const { NotificationsProvider } = await import("@context/notifications/NotificationsContext");

beforeEach(() => {
  configured.value = true;
  state.access = ["lead", "finance"];
});

function show() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NotificationsProvider>
        <CcApprovalsTab />
      </NotificationsProvider>
    </QueryClientProvider>,
  );
}

describe("when the cc backend isn't configured", () => {
  it("says so instead of rendering the queue", () => {
    configured.value = false;
    show();
    expect(screen.getByText(/Credit card expenses aren't connected yet/)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});

// The standalone screen switches role from a Select; this tab uses the same
// "As lead / As finance" toggle Expense and OPD already show, so the three
// per-type tabs read the same at a glance.
describe("the role control", () => {
  it("offers the toggle to someone holding both roles", async () => {
    show();
    await screen.findAllByRole("checkbox");
    expect(screen.getByRole("button", { name: "As lead" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "As finance" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Approve Role")).toBeNull();
  });

  it("hides the toggle from someone holding only one role", async () => {
    state.access = ["lead"];
    show();
    await screen.findAllByRole("checkbox");
    expect(screen.queryByRole("button", { name: "As lead" })).not.toBeInTheDocument();
  });

  it("switches the queue's mode when the toggle is used", async () => {
    const user = userEvent.setup();
    show();
    // Finance wins by default (ApproveBody's own derivation), so the pending-
    // lead row starts unselectable.
    await waitFor(() => expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(0));
    await user.click(screen.getByRole("button", { name: "As lead" }));
    const boxes = (await screen.findAllByRole("checkbox")).filter(
      (b) => b.getAttribute("name") === "select_row",
    );
    expect(boxes[0]).toBeEnabled();
  });
});

// The rich detail panel — expense category, comment, units, receipt — is the
// same CcApproveDetail the standalone screen uses; this just checks the tab
// actually shows it, not the field-by-field content already covered there.
describe("the detail panel", () => {
  it("shows the selected transaction's detail alongside the grid", async () => {
    show();
    await screen.findAllByRole("checkbox");
    expect(await screen.findByText("Hotel")).toBeInTheDocument();
    expect(screen.getByText("Travel")).toBeInTheDocument();
  });
});
