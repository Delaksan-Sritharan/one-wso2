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
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchResults, UserInfo } from "../api/engagementTypes";
import SearchPage from "./SearchPage";

const state = vi.hoisted(() => ({ info: undefined as unknown, result: {} as Record<string, unknown>, asked: [] as unknown[][] }));
vi.mock("../api/useEngagementUserInfo", async () => {
  const { engagementAccess } = await import("../model/engagementAccess");
  return {
    useEngagementUserInfo: () => ({ data: state.info }),
    useEngagementAccess: () => engagementAccess(state.info as UserInfo | undefined),
  };
});
vi.mock("../api/useEngagementApi", () => ({
  useEngagementSearch: (...args: unknown[]) => {
    state.asked.push(args);
    return state.result;
  },
}));
// The frame has its own tests.
vi.mock("../components/EaPage", () => ({ default: ({ title, children }: { title: string; children: React.ReactNode }) => <div><h1>{title}</h1>{children}</div> }));

const info = (a: number[], t: number[]) => ({ allocations: { privileges: a, roles: [] }, travel: { privileges: t, roles: [] } }) as unknown as UserInfo;
const ready = (data: SearchResults | undefined, extra: Record<string, unknown> = {}) => {
  state.result = { data, isPending: data === undefined, isFetching: false, isError: false, error: null, refetch: () => {}, ...extra };
};
const results: SearchResults = {
  query: "2026",
  groups: [
    { kind: "travelRequests", total: 40, items: [{ id: "TRV-2026-11-0003", title: "TRV-2026-11-0003", subtitle: "Jane Doe, India", status: "In Progress" }] },
    { kind: "invoices", total: 2, items: [{ id: "77", title: "INV-77", jobNumber: "TRV-2026-11-0003" }] },
    { kind: "perDiemPayments", total: 1, items: [{ id: "PD-5", title: "PD-5" }] },
    { kind: "allocations", total: 1, items: [{ id: "A-1", title: "A-1" }] },
  ],
  failed: ["engagements"],
};

function Where() {
  const l = useLocation();
  return <output data-testid="where">{l.pathname + l.search}</output>;
}
const page = (at = "/finance/engagement-app/search?q=2026") =>
  render(
    <MemoryRouter initialEntries={[at]}>
      <SearchPage />
      <Where />
    </MemoryRouter>,
  );
const href = (name: string | RegExp, within_?: HTMLElement) => ((within_ ? within(within_) : screen).getByRole("link", { name }) as HTMLAnchorElement).getAttribute("href");

describe("SearchPage", () => {
  beforeEach(() => {
    // The Travel Team and the invoice roles: travel requests, all invoices and payments, engagement and team allocations.
    state.info = { ...info([1, 3, 9, 21], [2, 39, 41]), workQueues: undefined };
    state.asked = [];
    ready(results);
  });
  afterEach(() => vi.useRealTimers());

  it("asks for twenty per kind for the address's q", () => {
    page();
    expect(state.asked.at(-1)).toEqual(["2026", 20, true]);
    expect((screen.getByLabelText("Search Engagement App") as HTMLInputElement).value).toBe("2026");
  });

  it("draws a card per kind with its total and its hits", () => {
    page();
    const travel = screen.getByRole("region", { name: "Travels" });
    expect(travel.textContent).toContain("40");
    expect(travel.textContent).toContain("Jane Doe, India");
    expect(screen.getByRole("region", { name: "Invoices" }).textContent).toContain("INV-77");
    expect(screen.queryByRole("region", { name: "Engagements" })).toBeNull();
  });

  it("links each card to its own list with the search typed in", () => {
    page();
    expect(href("View All in Travels")).toBe("/finance/engagement-app/travel-requests/all?q=2026");
    expect(href("View All in Invoices")).toBe("/finance/engagement-app/invoices/all-invoices?q=2026");
    expect(href("View All in Per Diem Payments")).toBe("/finance/engagement-app/invoices/all-payments?q=2026");
    expect(href("View All in Allocations")).toBe("/finance/engagement-app/allocations/engagement?q=2026");
  });

  it("links each hit to its page, or to its list for a record with no page", () => {
    page();
    expect(href(/TRV-2026-11-0003/, screen.getByRole("region", { name: "Travels" }))).toBe("/finance/engagement-app/travel-requests/TRV-2026-11-0003/info");
    expect(href(/INV-77/)).toBe("/finance/engagement-app/invoices/all-invoices?q=TRV-2026-11-0003");
    expect(href(/PD-5/)).toBe("/finance/engagement-app/invoices/all-payments?q=PD-5");
    expect(href(/A-1/)).toBe("/finance/engagement-app/allocations/engagement?q=A-1");
  });

  it("names a kind that failed and still shows the rest", () => {
    page();
    expect(screen.getByText(/Couldn't search Engagements/)).toBeTruthy();
    expect(screen.getByRole("region", { name: "Invoices" })).toBeTruthy();
  });

  it("says when nothing matches", () => {
    ready({ query: "zz", groups: [], failed: [] });
    page("/finance/engagement-app/search?q=zz");
    expect(screen.getByText("No Matches")).toBeTruthy();
  });

  it("asks for a query before it searches", () => {
    page("/finance/engagement-app/search");
    expect(screen.getByText("Type to Search")).toBeTruthy();
  });

  it("shows a skeleton, after the short delay, while it loads", () => {
    vi.useFakeTimers();
    ready(undefined);
    page();
    expect(screen.getByLabelText("Loading")).toBeTruthy();
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("shows a retryable error when the search fails", () => {
    const refetch = vi.fn();
    ready(undefined, { isPending: false, isError: true, error: new Error("boom"), refetch });
    page();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it("writes an edit to the address once typing pauses", () => {
    vi.useFakeTimers();
    page();
    fireEvent.change(screen.getByLabelText("Search Engagement App"), { target: { value: "india" } });
    expect(screen.getByTestId("where").textContent).toContain("q=2026");
    act(() => void vi.advanceTimersByTime(350));
    expect(screen.getByTestId("where").textContent).toBe("/finance/engagement-app/search?q=india");
  });
});
