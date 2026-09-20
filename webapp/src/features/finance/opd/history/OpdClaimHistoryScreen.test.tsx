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

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type { OpdClaim } from "../opdTypes";

vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));

// Only the slots this screen puts anything in. The eyebrow, the subtitle and
// the not-configured alert are the shell's own business, with their own tests.
vi.mock("../../components/FinanceShell", () => ({
  default: ({ title, children }: { title: string; children: ReactNode }) => (
    <>
      <h1>{title}</h1>
      {children}
    </>
  ),
}));

const state: {
  roles: number[];
  claims: OpdClaim[];
  claimsError: Error | null;
  userInfoError: Error | null;
} = {
  roles: [444],
  claims: [],
  claimsError: null,
  userInfoError: null,
};

/** The payload the screen last asked `/search-claims` for. */
let lastPayload: unknown = null;

vi.mock("../useOpd", () => ({
  useOpdUserInfo: () => ({
    data: state.userInfoError
      ? undefined
      : { firstName: "A", lastName: "B", workEmail: "me@wso2.com", userRoles: state.roles },
    isLoading: false,
    isError: Boolean(state.userInfoError),
    isFetching: false,
    error: state.userInfoError,
    refetch: vi.fn(),
  }),
  useOpdClaims: (payload: unknown) => {
    lastPayload = payload;
    return {
      data: state.claimsError ? undefined : state.claims,
      isLoading: false,
      isError: Boolean(state.claimsError),
      isFetching: false,
      error: state.claimsError,
      refetch: vi.fn(),
    };
  },
}));

const { default: OpdClaimHistoryScreen } = await import("./OpdClaimHistoryScreen");
const { NotificationsProvider } = await import("@context/notifications/NotificationsContext");

function claim(over: Partial<OpdClaim> = {}): OpdClaim {
  return {
    id: "OPD-2001",
    employeeEmail: "me@wso2.com",
    // A bare date, so the row renders the same day in every timezone. Noon UTC
    // is already the 18th in UTC+12 and beyond, which failed this assertion in
    // Auckland while passing everywhere else. How a real timestamp is parsed is
    // asserted on the instant, in opdHistoryTypes.test.ts.
    createdDate: "2026-09-17",
    totalAmount: 7400,
    transactions: [
      { date: "2026-09-16", amount: 7400, comment: "Consultation", receiptUrl: "r.pdf" },
    ],
    statusDetails: {
      status: "PENDING",
      financeApproverEmail: null,
      financeApprovedDate: null,
      financeRejectedDate: null,
      financeRejectedReason: null,
    },
    ...over,
  };
}

/**
 * Claim ID lives behind the Filters control, as it does in the source. That
 * control is a Select drawn as a field rather than a button, so it opens on
 * mouseDown; its edits are held until Apply.
 */
function openFilters() {
  fireEvent.mouseDown(screen.getByLabelText("Filters"));
  return screen.getByLabelText("Claim ID");
}

function applyFilters() {
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
}

const show = () =>
  render(
    <NotificationsProvider>
      <OpdClaimHistoryScreen />
    </NotificationsProvider>,
  );

beforeEach(() => {
  state.roles = [444];
  state.claims = [claim()];
  state.claimsError = null;
  state.userInfoError = null;
  lastPayload = null;
});

describe("the screen", () => {
  it("names itself", () => {
    show();
    expect(screen.getByRole("heading", { name: "Claim history" })).toBeInTheDocument();
  });

  it("asks only for the signed-in person's claims", () => {
    show();
    expect(lastPayload).toMatchObject({ email: "me@wso2.com" });
  });
});

// A failed lookup leaves `data` undefined, which reads as "no role" — so
// without the isError guard this screen would tell someone their account is
// ineligible when all that happened is a request failed.
describe("when the role lookup fails", () => {
  it("offers a retry rather than calling the account ineligible", () => {
    state.userInfoError = new Error("boom");
    show();
    expect(screen.getByText(/Couldn't load your claims/)).toBeInTheDocument();
    expect(screen.queryByText(/aren't available for your account/)).not.toBeInTheDocument();
  });
});

describe("an account without the submitter role", () => {
  it("is told, rather than shown an empty list it can never fill", () => {
    state.roles = [999];
    show();
    expect(screen.getByText(/OPD claims aren't available for your account/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("the list", () => {
  it("shows a claim as a row", () => {
    show();
    expect(screen.getByText("OPD-2001")).toBeInTheDocument();
    expect(screen.getByText("17-Sep-2026")).toBeInTheDocument();
  });

  // Two different emptinesses: nothing filed yet, versus filters that match
  // nothing. Saying "no claims" to someone who has claims is a bug report.
  it("distinguishes a first-time claimant from filters that match nothing", () => {
    state.claims = [];
    const { unmount } = show();
    expect(screen.getByText(/haven't submitted an OPD claim yet/)).toBeInTheDocument();
    unmount();

    show();
    fireEvent.change(openFilters(), { target: { value: "OPD-9" } });
    applyFilters();
    expect(screen.getByText("No claims match these filters.")).toBeInTheDocument();
  });

  it("offers a retry when the search fails", () => {
    state.claimsError = new Error("boom");
    show();
    expect(screen.getByText(/Couldn't load your claims/)).toBeInTheDocument();
  });
});

describe("filtering", () => {
  it("sends a typed claim id, trimmed", async () => {
    show();
    fireEvent.change(openFilters(), { target: { value: " OPD-7 " } });
    applyFilters();
    await waitFor(() => expect(lastPayload).toMatchObject({ ids: ["OPD-7"] }));
  });

  // Offered only once something is narrowing the list — a permanently visible
  // Clear on an unfiltered screen is a button that does nothing.
  // The popover edits a copy: typing an id and walking away must not change
  // the list, or a half-finished thought would re-run the search.
  it("holds a typed id until Apply", async () => {
    show();
    fireEvent.change(openFilters(), { target: { value: "OPD-7" } });
    expect(lastPayload).toMatchObject({ ids: null });
    applyFilters();
    await waitFor(() => expect(lastPayload).toMatchObject({ ids: ["OPD-7"] }));
  });

  it("puts everything back on Clear", async () => {
    show();
    fireEvent.change(openFilters(), { target: { value: "OPD-7" } });
    applyFilters();
    await waitFor(() => expect(lastPayload).toMatchObject({ ids: ["OPD-7"] }));

    openFilters();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    await waitFor(() => expect(lastPayload).toMatchObject({ ids: null }));
  });
});

describe("the always-visible filters", () => {
  // FilterHolder.tsx — Year Range and Status stay on the page; everything else
  // is behind Filters. A regression here is a filter nobody can find.
  it("keeps Year Range and Status out of the menu", () => {
    show();
    expect(screen.getByLabelText("Year Range")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    expect(screen.queryByLabelText("Claim ID")).not.toBeInTheDocument();
  });
});

describe("the always-visible filters", () => {
  // FilterHolder.tsx — Year Range and Status stay on the page, everything else
  // sits behind Filters. A regression here is a filter nobody can find.
  it("keeps Year Range and Status out of the menu", () => {
    show();
    expect(screen.getByLabelText("Year Range")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    expect(screen.queryByLabelText("Claim ID")).not.toBeInTheDocument();
  });
});

describe("the activity trail", () => {
  it("opens from the row's status", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: /Claim activity for OPD-2001/ }));
    expect(screen.getByText("Claim Activity")).toBeInTheDocument();
    expect(screen.getByText("Claim Submission")).toBeInTheDocument();
    expect(screen.getByText(/Finance Review/)).toBeInTheDocument();
  });

  it("gives finance's reason on a rejected claim", () => {
    state.claims = [
      claim({
        statusDetails: {
          status: "REJECTED",
          financeApproverEmail: "f@wso2.com",
          financeApprovedDate: null,
          financeRejectedDate: "2026-09-18 12:00:00.0",
          financeRejectedReason: "Receipt unreadable.",
        },
      }),
    ];
    show();
    fireEvent.click(screen.getByRole("button", { name: /Claim activity for OPD-2001/ }));
    expect(screen.getByText(/Receipt unreadable\./)).toBeInTheDocument();
  });
});

describe("opening a claim", () => {
  it("shows its bills, and the way back", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "View claim OPD-2001" }));
    expect(screen.getByText("OPD ITEM 1")).toBeInTheDocument();
    expect(screen.getByText("Consultation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to claim history" })).toBeInTheDocument();
  });

  it("offers the receipt, as one button", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "View claim OPD-2001" }));
    expect(
      screen.getByRole("button", { name: /View or download receipt for OPD ITEM 1/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Download receipt/ })).not.toBeInTheDocument();
  });

  it("goes back to the list", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "View claim OPD-2001" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to claim history" }));
    expect(screen.getByRole("button", { name: "View claim OPD-2001" })).toBeInTheDocument();
  });
});
