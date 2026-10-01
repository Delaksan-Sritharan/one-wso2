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
import { render, screen } from "@testing-library/react";

// The gate is this screen's only input, so it is the whole fixture. The two
// dashboards are stubbed to a marker each: what matters here is WHICH of them
// is reachable and WHEN, not what either draws.
const gate = {
  canSee: (id: string): boolean => id === "",
  isResolving: false,
  ccHasOwnCard: false,
  opdFinance: false,
  opdErrored: false,
};

vi.mock("../api/useFinanceGate", () => ({ useFinanceGate: () => gate }));
vi.mock("../cc/pages/CcDashboardPage", () => ({
  default: ({ headerActions }: { headerActions?: React.ReactNode }) => (
    <div data-testid="cc-dashboard">{headerActions}</div>
  ),
}));
vi.mock("../opd/dashboard/OpdDashboardScreen", () => ({
  default: ({ headerActions }: { headerActions?: React.ReactNode }) => (
    <div data-testid="opd-dashboard">{headerActions}</div>
  ),
}));

const { default: FinanceOverviewPage } = await import("./FinanceOverviewPage");

/** A reader the gate has fully answered for, with the access given. */
function settled(access: Partial<typeof gate>) {
  Object.assign(gate, {
    isResolving: false,
    ccHasOwnCard: false,
    opdFinance: false,
    opdErrored: false,
    ...access,
  });
  gate.canSee = (id) =>
    id === "finance-overview" && (gate.ccHasOwnCard || gate.opdFinance || gate.opdErrored);
}

beforeEach(() => {
  settled({});
});

const aDashboard = () =>
  screen.queryByTestId("cc-dashboard") ?? screen.queryByTestId("opd-dashboard");

// The reason this screen exists in the shape it does: it is the content pane
// for a rail row that is itself hidden until the gate settles. Anything drawn
// here before that answer arrives is something the reader watches appear and
// then be taken away again.
describe("while the backends are still answering", () => {
  it("draws nothing at all — no dashboard, no refusal, no switcher", () => {
    settled({ ccHasOwnCard: true });
    gate.isResolving = true;

    const { container } = render(<FinanceOverviewPage />);

    expect(container).toBeEmptyDOMElement();
    expect(aDashboard()).not.toBeInTheDocument();
    expect(screen.queryByText(/isn't available for your role/)).not.toBeInTheDocument();
  });
});

// THE regression this screen was reported for. A reader with no card and no
// OPD role must never see a dashboard — not for one render on the way to the
// refusal, which is what "it blinks and comes back" was.
describe("a reader with neither a card nor an OPD role", () => {
  it("never sees a dashboard, from the first render to the last", () => {
    gate.isResolving = true;
    const { container, rerender } = render(<FinanceOverviewPage />);

    // Resolving: nothing.
    expect(aDashboard()).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();

    // Settled, and the answer is no.
    settled({});
    rerender(<FinanceOverviewPage />);

    expect(aDashboard()).not.toBeInTheDocument();
    expect(screen.getByText(/isn't available for your role/)).toBeInTheDocument();
  });

  // Hiding the rail row is not access control — the route is still reachable
  // by a bookmark or a typed URL.
  it("is refused outright rather than shown an empty switcher", () => {
    settled({});
    render(<FinanceOverviewPage />);

    expect(screen.getByText(/isn't available for your role/)).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});

// A reader holding one side is not offered the other: picking it would only
// land them on that dashboard's own denial notice.
describe("what the switcher offers", () => {
  it("opens the CC dashboard, and offers only it, for a card owner", () => {
    settled({ ccHasOwnCard: true });
    render(<FinanceOverviewPage />);

    expect(screen.getByTestId("cc-dashboard")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveTextContent("Credit Card");
    expect(screen.queryByTestId("opd-dashboard")).not.toBeInTheDocument();
  });

  // Lands straight on the dashboard they can actually use, rather than the
  // "cc" default they would have nothing to see on.
  it("opens the OPD dashboard for an OPD-only approver", () => {
    settled({ opdFinance: true });
    render(<FinanceOverviewPage />);

    expect(screen.getByTestId("opd-dashboard")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveTextContent("OPD Claims");
    expect(screen.queryByTestId("cc-dashboard")).not.toBeInTheDocument();
  });

  it("offers both to a reader holding both", () => {
    settled({ ccHasOwnCard: true, opdFinance: true });
    render(<FinanceOverviewPage />);

    expect(screen.getByTestId("cc-dashboard")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  // A failed OPD lookup is not the same answer as "no role": it is the reason
  // Overview is reachable at all for a no-card reader, so it lands there.
  it("lands an erroring OPD lookup on the OPD tab, which can be retried", () => {
    settled({ opdErrored: true });
    render(<FinanceOverviewPage />);

    expect(screen.getByTestId("opd-dashboard")).toBeInTheDocument();
  });
});
