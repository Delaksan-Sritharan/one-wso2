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
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchResults, UserInfo } from "../api/engagementTypes";
import GlobalSearch from "./GlobalSearch";

const state = vi.hoisted(() => ({
  info: undefined as unknown,
  result: {} as Record<string, unknown>,
  asked: [] as unknown[][],
}));
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

const info = (a: number[], t: number[]) => ({ allocations: { privileges: a, roles: [] }, travel: { privileges: t, roles: [] } }) as unknown as UserInfo;
const results: SearchResults = {
  query: "2026",
  groups: [
    { kind: "travelRequests", total: 12, items: [{ id: "TRV-2026-11-0003", title: "TRV-2026-11-0003", subtitle: "Jane Doe, India", status: "In Progress" }, { id: "TRV-2026-11-0004", title: "TRV-2026-11-0004" }] },
    { kind: "engagements", total: 3, items: [{ id: "E-9", title: "Acme Rollout", segment: "customer" }] },
  ],
  failed: ["allocations"],
};
const ready = (data: SearchResults | undefined = results, extra: Record<string, unknown> = {}) => {
  state.result = { data, isPending: data === undefined, isFetching: false, isError: false, error: null, ...extra };
};

function Where() {
  const l = useLocation();
  return <output data-testid="where">{l.pathname + l.search}</output>;
}
function box() {
  render(
    <MemoryRouter initialEntries={["/finance/engagement-app/dashboard"]}>
      <GlobalSearch />
      <input aria-label="Other field" />
      <Where />
    </MemoryRouter>,
  );
  return screen.queryByRole("combobox", { name: "Search Engagement App" });
}
const type = (el: HTMLElement, value: string) => {
  fireEvent.focus(el);
  fireEvent.change(el, { target: { value } });
  act(() => void vi.advanceTimersByTime(300));
};

describe("GlobalSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    state.info = info([1, 3, 13], [2]);
    state.asked = [];
    ready();
  });
  afterEach(() => vi.useRealTimers());

  it("is hidden for someone with none of the searchable lists, and asks nothing", () => {
    state.info = info([1], []);
    expect(box()).toBeNull();
    expect(state.asked).toHaveLength(0);
  });

  it("waits out the debounce before asking and keeps to the first five per kind", () => {
    const el = box() as HTMLElement;
    fireEvent.focus(el);
    fireEvent.change(el, { target: { value: "20" } });
    expect(state.asked.at(-1)?.[0]).toBe("");
    act(() => void vi.advanceTimersByTime(260));
    expect(state.asked.at(-1)).toEqual(["20", 5]);
  });

  it("shows Searching while the typed text has not been asked yet", () => {
    const el = box() as HTMLElement;
    fireEvent.focus(el);
    fireEvent.change(el, { target: { value: "20" } });
    expect(screen.getByText("Searching…")).toBeTruthy();
  });

  it("does not open for a single character", () => {
    const el = box() as HTMLElement;
    type(el, "2");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("groups the suggestions with each group's total, and names a group that failed", () => {
    type(box() as HTMLElement, "2026");
    const travel = screen.getByRole("group", { name: "Travels" });
    expect(travel.textContent).toContain("12");
    expect(travel.textContent).toContain("Jane Doe, India");
    expect(travel.textContent).toContain("In Progress");
    expect(screen.getByRole("group", { name: "Engagements" }).textContent).toContain("Acme Rollout");
    expect(screen.getByText("Couldn't search Allocations")).toBeTruthy();
    expect(screen.getByRole("option", { name: "Show All Results" })).toBeTruthy();
  });

  it("says No matches when nothing is found", () => {
    ready({ query: "zz", groups: [], failed: [] });
    type(box() as HTMLElement, "zz");
    expect(screen.getByText("No matches")).toBeTruthy();
  });

  it("opens the travel request that is picked and clears the box", () => {
    const el = box() as HTMLInputElement;
    type(el, "2026");
    fireEvent.click(screen.getByText("TRV-2026-11-0003"));
    expect(screen.getByTestId("where").textContent).toBe("/finance/engagement-app/travel-requests/TRV-2026-11-0003/info");
    expect(el.value).toBe("");
  });

  it("opens an engagement by its id", () => {
    type(box() as HTMLElement, "2026");
    fireEvent.click(screen.getByText("Acme Rollout"));
    expect(screen.getByTestId("where").textContent).toBe("/finance/engagement-app/engagements/E-9/allocations");
  });

  it("walks the suggestions with the arrow keys and opens the highlighted one on Enter", () => {
    const el = box() as HTMLElement;
    type(el, "2026");
    fireEvent.keyDown(el, { key: "ArrowDown" });
    fireEvent.keyDown(el, { key: "ArrowDown" });
    expect(screen.getAllByRole("option", { selected: true }).map((o) => o.textContent)).toEqual(["TRV-2026-11-0004"]);
    fireEvent.keyDown(el, { key: "ArrowUp" });
    fireEvent.keyDown(el, { key: "Enter" });
    expect(screen.getByTestId("where").textContent).toBe("/finance/engagement-app/travel-requests/TRV-2026-11-0003/info");
  });

  it("wraps from the first suggestion up to Show All Results", () => {
    const el = box() as HTMLElement;
    type(el, "2026");
    fireEvent.keyDown(el, { key: "ArrowUp" });
    expect(screen.getByRole("option", { name: "Show All Results", selected: true })).toBeTruthy();
  });

  it("goes to the results page from the Show All Results row", () => {
    type(box() as HTMLElement, "2026");
    fireEvent.click(screen.getByRole("option", { name: "Show All Results" }));
    expect(screen.getByTestId("where").textContent).toBe("/finance/engagement-app/search?q=2026");
  });

  it("goes to the results page on Enter with nothing highlighted", () => {
    const el = box() as HTMLElement;
    type(el, " 2026 ");
    fireEvent.keyDown(el, { key: "Enter" });
    expect(screen.getByTestId("where").textContent).toBe("/finance/engagement-app/search?q=2026");
  });

  it("closes on Escape", () => {
    const el = box() as HTMLElement;
    type(el, "2026");
    fireEvent.keyDown(el, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("focuses on / from the page, not from inside another field", () => {
    const el = box() as HTMLElement;
    fireEvent.keyDown(document.body, { key: "/" });
    expect(document.activeElement).toBe(el);
    (screen.getByLabelText("Other field") as HTMLElement).focus();
    const notPrevented = fireEvent.keyDown(screen.getByLabelText("Other field"), { key: "/" });
    expect(notPrevented).toBe(true);
    expect(document.activeElement).toBe(screen.getByLabelText("Other field"));
  });

  it("ignores / with a modifier held", () => {
    const el = box() as HTMLElement;
    fireEvent.keyDown(document.body, { key: "/", metaKey: true });
    expect(document.activeElement).not.toBe(el);
  });
});
