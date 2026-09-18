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
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { localIsoDateOffset } from "@utils/localDate";

vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));

const CURRENT_YEAR = new Date().getFullYear();
const LAST_YEAR = CURRENT_YEAR - 1;
// Built the way `todayIso()` builds it — `toISOString()` is UTC and names a
// different day either side of local midnight.
const TODAY = localIsoDateOffset(0);

const SUMMARY = { totalClaimedAmount: 12000, totalRemaining: 38000, totalClaimLimit: 50000 };

const state = {
  roles: [444] as number[],
  lastYearClaimSummary: null as typeof SUMMARY | null,
  draft: null as { transactions: unknown[] } | null,
};

vi.mock("../useOpd", () => ({
  useOpdUserInfo: () => ({
    data: { workEmail: "me@wso2.com", userRoles: state.roles },
    isLoading: false,
    isError: false,
  }),
  useOpdAppData: () => ({
    data: {
      claimSummary: SUMMARY,
      lastYearClaimSummary: state.lastYearClaimSummary,
      draft: state.draft,
    },
    isLoading: false,
    isError: false,
    isSuccess: true,
  }),
}));

const submitMutate = vi.fn();
const draftRemove = vi.fn();
const uploadMutate = vi.fn(async () => "OPD-FILE-1.pdf");
vi.mock("../useOpdMutations", () => ({
  useOpdReceiptUpload: () => ({ mutateAsync: uploadMutate, isPending: false }),
  useSubmitOpdClaim: () => ({ mutate: submitMutate, isPending: false, isError: false, error: null }),
  useOpdDraftSync: () => ({
    save: { mutateAsync: vi.fn(async () => undefined) },
    remove: { mutate: draftRemove, mutateAsync: vi.fn(async () => undefined) },
  }),
}));

// Stubbed down to the two slots the screen puts anything in: the title, which
// carries "New Claim", and the actions beside it, which carry Add expense and
// Submit. The eyebrow, the subtitle and the not-configured alert are the
// shell's own business and have their own tests.
vi.mock("../../components/FinanceShell", () => ({
  default: ({
    title,
    actions,
    children,
  }: {
    title: string;
    actions?: ReactNode;
    children: ReactNode;
  }) => (
    <>
      <h1>{title}</h1>
      {actions}
      {children}
    </>
  ),
}));

const { default: OpdNewClaimScreen } = await import("./OpdNewClaimScreen");
const { NotificationsProvider } = await import("@context/notifications/NotificationsContext");

beforeEach(() => {
  state.roles = [444];
  state.lastYearClaimSummary = null;
  state.draft = null;
  submitMutate.mockClear();
  draftRemove.mockClear();
  uploadMutate.mockClear();
});

function show() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NotificationsProvider>
        <OpdNewClaimScreen />
      </NotificationsProvider>
    </QueryClientProvider>,
  );
}

/** Fill the Add dialog and press Add. Leaves it open when validation refuses. */
async function addBill({
  date = TODAY,
  amount = "1000",
  comment = "Consultation",
  withReceipt = true,
}: { date?: string; amount?: string; comment?: string; withReceipt?: boolean } = {}) {
  fireEvent.change(await screen.findByLabelText(/Bill Date/), { target: { value: date } });
  fireEvent.change(screen.getByLabelText(/Claim Amount/), { target: { value: amount } });
  fireEvent.change(screen.getByLabelText(/Description/), { target: { value: comment } });
  if (withReceipt) {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(["x"], "receipt.pdf", { type: "application/pdf" })] },
    });
    await waitFor(() => expect(uploadMutate).toHaveBeenCalled());
  }
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
}

// The way in depends on whether anything has been added yet: an empty claim
// offers only the empty state's "Add OPD Claim", and the header's "Add expense"
// appears alongside Submit once there is a bill (`NewClaim.tsx:359`).
const openAdd = async () =>
  fireEvent.click(await screen.findByRole("button", { name: /Add OPD Claim/ }));

const openAddAnother = async () =>
  fireEvent.click(await screen.findByRole("button", { name: "Add expense" }));

// NewClaim.tsx:222-262 — what somebody filing their first claim is shown.
// The screen is reached both from the finance landing page and by URL, so the
// heading is what says which of the OPD screens you are on. It comes from the
// shared shell, which is easy to render around a screen and just as easy to
// leave off it.
describe("the page's heading", () => {
  it("names the screen while it is still loading", () => {
    show();
    expect(screen.getByRole("heading", { name: "New Claim" })).toBeInTheDocument();
  });

  it("stays put once the claim is on screen", async () => {
    show();
    await screen.findByText("Let's get started!");
    expect(screen.getByRole("heading", { name: "New Claim" })).toBeInTheDocument();
  });

  it("is there even when the account cannot claim", async () => {
    state.roles = [555];
    show();
    await screen.findByText(/OPD claim submission isn't available/);
    expect(screen.getByRole("heading", { name: "New Claim" })).toBeInTheDocument();
  });
});

describe("a first-time claimant", () => {
  it("is invited to start rather than shown an empty frame", async () => {
    show();
    expect(await screen.findByText("Let's get started!")).toBeInTheDocument();
    expect(screen.getByText("Submit your OPD claim now")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add OPD Claim/ })).toBeInTheDocument();
  });

  it("is offered no draft to restore when there is none", async () => {
    show();
    await screen.findByText("Let's get started!");
    expect(screen.queryByRole("button", { name: "Restore Draft" })).not.toBeInTheDocument();
  });

  // :359 — an empty claim has nothing to add to and nothing to send, so the
  // header offers neither; the empty state's own button is the single way in.
  it("is offered no Submit and no second Add button", async () => {
    show();
    await screen.findByText("Let's get started!");
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add expense" })).not.toBeInTheDocument();
  });

  it("gets both once a bill is on the claim", async () => {
    show();
    await openAdd();
    await addBill();
    expect(await screen.findByRole("button", { name: "Submit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add expense" })).toBeInTheDocument();
  });

  // The allowance is the thing you want to know before deciding to claim.
  it("is shown what is left of the allowance", async () => {
    show();
    expect(await screen.findByText("Rs. 38,000.00")).toBeInTheDocument();
    expect(screen.getByText(/Spent Rs. 12,000.00 of Rs. 50,000.00/)).toBeInTheDocument();
  });
});

// ExpenseForm.tsx:88-107 — four fields, all required, the receipt included.
describe("adding a bill", () => {
  it("puts it on the claim, with its own total", async () => {
    show();
    await openAdd();
    await addBill({ amount: "1500", comment: "Dental" });
    expect(await screen.findByText("OPD ITEM 1")).toBeInTheDocument();
    expect(screen.getByText("Dental")).toBeInTheDocument();
    expect(screen.getByText("Total Amount:")).toBeInTheDocument();
    // Twice over: the bill's own Amount and the Total row, which for a
    // one-bill claim are the same figure.
    expect(screen.getAllByText("Rs. 1,500.00")).toHaveLength(2);
  });

  // :107 — the source requires a receipt on every bill. The earlier port did
  // not, so a bill could be filed with nothing backing it.
  it("is refused without a receipt", async () => {
    show();
    await openAdd();
    await addBill({ withReceipt: false });
    expect(await screen.findByText("A receipt is required.")).toBeInTheDocument();
    expect(screen.queryByText("OPD ITEM 1")).not.toBeInTheDocument();
  });

  it("is refused with no amount", async () => {
    show();
    await openAdd();
    await addBill({ amount: "" });
    expect(await screen.findByText("Required")).toBeInTheDocument();
  });

  it("is refused at zero", async () => {
    show();
    await openAdd();
    await addBill({ amount: "0" });
    expect(await screen.findByText("Amount must be greater than 0")).toBeInTheDocument();
  });

  // :94-102 — the cap is the remaining balance less what is already listed.
  it("is refused above the remaining balance, and says the limit", async () => {
    show();
    await openAdd();
    await addBill({ amount: "38001" });
    expect(
      await screen.findByText("Amount cannot exceed available limit of 38,000.00"),
    ).toBeInTheDocument();
  });

  it("bounds the bill date to the year being claimed against", async () => {
    show();
    await openAdd();
    const date = await screen.findByLabelText(/Bill Date/);
    expect(date).toHaveAttribute("min", `${CURRENT_YEAR}-01-01`);
    // The exact bound: on 31 December "not 31 Dec" would pass for the wrong reason.
    expect(date).toHaveAttribute("max", TODAY);
  });
});

// ExpenseForm.tsx:129-144 — enforced, not merely implied by the picker, because
// the date field is typeable.
describe("the single-year rule", () => {
  it("refuses a bill from another year", async () => {
    show();
    await openAdd();
    await addBill({ date: `${CURRENT_YEAR}-03-02` });
    await screen.findByText("OPD ITEM 1");

    await openAddAnother();
    await addBill({ date: `${LAST_YEAR}-03-02`, comment: "Older bill" });
    expect(
      await screen.findByText("All transactions in a claim must belong to the same year."),
    ).toBeInTheDocument();
    expect(screen.queryByText("OPD ITEM 2")).not.toBeInTheDocument();
  });
});

// ExpenseForm.tsx:75-87 — the edited bill's own amount is not spent yet.
describe("correcting a bill", () => {
  it("replaces the row rather than adding one", async () => {
    show();
    await openAdd();
    await addBill({ amount: "1000", comment: "First go" });
    await screen.findByText("OPD ITEM 1");

    fireEvent.click(screen.getByRole("button", { name: "Edit OPD ITEM 1" }));
    fireEvent.change(await screen.findByLabelText(/Description/), {
      target: { value: "Corrected" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update" }));

    expect(await screen.findByText("Corrected")).toBeInTheDocument();
    expect(screen.queryByText("First go")).not.toBeInTheDocument();
    expect(screen.queryByText("OPD ITEM 2")).not.toBeInTheDocument();
  });

  // Without giving the amount back, re-saving an unchanged bill is refused by
  // the very limit it already fits inside.
  it("does not count its own amount against the limit", async () => {
    show();
    await openAdd();
    await addBill({ amount: "38000", comment: "The whole allowance" });
    await screen.findByText("OPD ITEM 1");

    fireEvent.click(screen.getByRole("button", { name: "Edit OPD ITEM 1" }));
    fireEvent.click(await screen.findByRole("button", { name: "Update" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Update" })).not.toBeInTheDocument(),
    );
  });

  // Icons alone would be a row of unlabelled glyphs; each carries a name that
  // says which bill it acts on, so several cards do not read as identical.
  it("offers the receipt actions ahead of the ones that change the bill", async () => {
    show();
    await openAdd();
    await addBill();
    await screen.findByText("OPD ITEM 1");

    const actions = ["View or download receipt for", "Edit", "Remove"].map((name) =>
      screen.getByRole("button", { name: new RegExp(`^${name}`) }),
    );
    for (const button of actions) expect(button).toBeInTheDocument();

    // The receipt is one button, not a view/download pair: the viewer carries
    // its own Download, so a second icon here only lengthened the row.
    expect(screen.queryByRole("button", { name: /^Download receipt/ })).not.toBeInTheDocument();

    // Reading the receipt comes before altering the bill, and Remove is last
    // rather than sitting between two safe controls.
    const order = actions.map((el) =>
      actions[0].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING ? 1 : 0,
    );
    expect(order).toEqual([0, 1, 1]);
  });

  it("can be removed", async () => {
    show();
    await openAdd();
    await addBill();
    await screen.findByText("OPD ITEM 1");
    fireEvent.click(screen.getByRole("button", { name: "Remove OPD ITEM 1" }));
    await waitFor(() => expect(screen.queryByText("OPD ITEM 1")).not.toBeInTheDocument());
    expect(screen.getByText("Let's get started!")).toBeInTheDocument();
  });
});

// NewClaim.tsx:79-107 — a saved draft is offered, never loaded.
describe("a saved draft", () => {
  const draftBill = {
    date: `${CURRENT_YEAR}-02-02`,
    amount: 900,
    comment: "Drafted bill",
    receiptUrl: "d.pdf",
  };

  it("is offered rather than restored", async () => {
    state.draft = { transactions: [draftBill] };
    show();
    expect(await screen.findByRole("button", { name: "Restore Draft" })).toBeInTheDocument();
    expect(screen.queryByText("Drafted bill")).not.toBeInTheDocument();
  });

  it("loads on request", async () => {
    state.draft = { transactions: [draftBill] };
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Restore Draft" }));
    expect(await screen.findByText("Drafted bill")).toBeInTheDocument();
  });

  it("is refused when it spans two years", async () => {
    state.draft = {
      transactions: [draftBill, { ...draftBill, date: `${LAST_YEAR}-02-02` }],
    };
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Restore Draft" }));
    expect(
      await screen.findByText("Draft contains transactions from multiple years. Restore aborted."),
    ).toBeInTheDocument();
  });

  // :246 — starting a fresh bill drops the draft, said before it happens.
  it("warns before a new bill discards it", async () => {
    state.draft = { transactions: [draftBill] };
    show();
    fireEvent.click(await screen.findByRole("button", { name: /Add OPD Claim/ }));
    expect(await screen.findByText("Draft Deletion Warning")).toBeInTheDocument();
    expect(
      screen.getByText("Adding a new claim will delete your draft. Are you sure you want to proceed?"),
    ).toBeInTheDocument();
    // The form has not opened yet — the warning is a question, not a notice.
    expect(screen.queryByLabelText(/Claim Amount/)).not.toBeInTheDocument();
  });
});

// :129-130 — the choice exists only while the backend still reports a last-year
// balance, which is what makes it claimable.
describe("claiming against last year", () => {
  it("offers no year choice when there is no last-year balance", async () => {
    show();
    await screen.findByText("Let's get started!");
    expect(screen.queryByRole("tab", { name: "Last Year" })).not.toBeInTheDocument();
  });

  it("offers the choice when there is one", async () => {
    state.lastYearClaimSummary = {
      totalClaimedAmount: 45000,
      totalRemaining: 5000,
      totalClaimLimit: 50000,
    };
    show();
    expect(await screen.findByRole("tab", { name: "This Year" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Last Year" })).toBeInTheDocument();
  });

  it("moves the balance and the date bounds onto the chosen year", async () => {
    state.lastYearClaimSummary = {
      totalClaimedAmount: 45000,
      totalRemaining: 5000,
      totalClaimLimit: 50000,
    };
    show();
    fireEvent.click(await screen.findByRole("tab", { name: "Last Year" }));
    expect(await screen.findByText("Rs. 5,000.00")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Add OPD Claim/ }));
    const date = await screen.findByLabelText(/Bill Date/);
    // A past year runs its whole length, not up to today.
    expect(date).toHaveAttribute("min", `${LAST_YEAR}-01-01`);
    expect(date).toHaveAttribute("max", `${LAST_YEAR}-12-31`);
  });

  it("warns before a year switch throws away the bills entered", async () => {
    state.lastYearClaimSummary = {
      totalClaimedAmount: 45000,
      totalRemaining: 5000,
      totalClaimLimit: 50000,
    };
    show();
    await openAdd();
    await addBill();
    await screen.findByText("OPD ITEM 1");

    fireEvent.click(screen.getByRole("tab", { name: "Last Year" }));
    expect(await screen.findByText("Change Year Warning")).toBeInTheDocument();
    // Still there until the warning is answered.
    expect(screen.getByText("OPD ITEM 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(screen.queryByText("OPD ITEM 1")).not.toBeInTheDocument());
  });
});

describe("submitting the claim", () => {
  it("asks first", async () => {
    show();
    await openAdd();
    await addBill();
    await screen.findByText("OPD ITEM 1");

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("Claim Submission Confirmation")).toBeInTheDocument();
    expect(submitMutate).not.toHaveBeenCalled();
  });

  it("sends the bills once confirmed", async () => {
    show();
    await openAdd();
    await addBill({ amount: "1500", comment: "Dental" });
    await screen.findByText("OPD ITEM 1");

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    fireEvent.click(await screen.findByRole("button", { name: "Submit", hidden: false }));
    await waitFor(() => expect(submitMutate).toHaveBeenCalled());
    expect(submitMutate.mock.calls[0][0]).toMatchObject({
      transactions: [{ amount: 1500, comment: "Dental", receiptUrl: "OPD-FILE-1.pdf" }],
    });
  });

  // A filed claim must not be offered back as a draft, so the draft is removed
  // directly rather than left to the autosave debounce.
  it("clears the claim and its draft afterwards", async () => {
    show();
    await openAdd();
    await addBill();
    await screen.findByText("OPD ITEM 1");

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    fireEvent.click(await screen.findByRole("button", { name: "Submit", hidden: false }));
    await waitFor(() => expect(submitMutate).toHaveBeenCalled());

    submitMutate.mock.calls[0][1].onSuccess();
    expect(await screen.findByText("Let's get started!")).toBeInTheDocument();
    expect(draftRemove).toHaveBeenCalled();
  });
});

// The OPD backend refuses the app to anyone holding neither role; the screen
// says which rule it is rather than showing a form that cannot be sent.
describe("an account without the submitter role", () => {
  it("is told, and offered no form", async () => {
    state.roles = [555];
    show();
    expect(
      await screen.findByText(/OPD claim submission isn't available for your account/),
    ).toBeInTheDocument();
    // Not even the empty state's way in — the message replaces the screen
    // rather than sitting above a form that could never be sent.
    expect(screen.queryByRole("button", { name: /Add OPD Claim/ })).not.toBeInTheDocument();
  });
});
