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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MyOverview, UserInfo } from "../api/engagementTypes";

const state = {
  configured: true,
  info: { data: { email: "jane@wso2.com", allocations: { privileges: [1] }, travel: { privileges: [49] } } as UserInfo | undefined, isSuccess: true },
  overview: { data: undefined as MyOverview | undefined, isPending: false, isError: false, isFetching: false, error: null as unknown },
};
const overviewEnabled = vi.fn();

vi.mock("@config/apiConfig", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@config/apiConfig")>()),
  isEngagementAppBackendConfigured: () => state.configured,
}));
vi.mock("../api/useEngagementUserInfo", () => ({ useEngagementUserInfo: () => state.info }));
vi.mock("../api/useEngagementApi", () => ({
  useMyOverview: (enabled: boolean) => {
    overviewEnabled(enabled);
    return { ...state.overview, refetch: vi.fn() };
  },
}));

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import UpcomingCard from "./UpcomingCard";

const original = window.config;
const draw = () =>
  render(
    <MemoryRouter>
      <UpcomingCard />
    </MemoryRouter>,
  );

beforeEach(() => {
  state.configured = true;
  state.overview = { data: { allocations: [], trips: [] }, isPending: false, isError: false, isFetching: false, error: null };
  overviewEnabled.mockClear();
});
afterEach(() => {
  window.config = original;
});

describe("the Allocations & Travels card on the Me overview", () => {
  it("is not drawn at all when nothing is coming up", () => {
    const { container } = draw();
    expect(container).toBeEmptyDOMElement();
  });

  it("shows upcoming allocations and travels, and a trip opens its travel request", () => {
    state.overview.data = {
      allocations: [
        {
          id: "A2610040001",
          engagementId: "E07201",
          title: "Northwind Bank – Open Banking PoC",
          start: "2026-11-19",
          end: "2026-11-30",
          status: "Clearance In Progress",
          current: false,
        },
      ],
      trips: [{ jobNumber: "TRV-2026-11-1301", traveller: { email: "jane@wso2.com", name: "Jane" }, country: "United States of America", city: "Boston", start: "2026-11-19", end: "2026-11-30", travelAgent: "Classic Travels", status: "In Progress" }],
    };
    draw();
    expect(screen.getByText("Allocations & Travels")).toBeInTheDocument();
    expect(screen.getByText("Northwind Bank – Open Banking PoC")).toBeInTheDocument();
    expect(screen.getByText("Clearance In Progress")).toBeInTheDocument();
    expect(screen.getByText("Upcoming Allocations")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Boston, United States of America/ })).toHaveAttribute("href", "/me/travel-requests/TRV-2026-11-1301/info");
  });

  it("does not call an allocation that has already started upcoming", () => {
    state.overview.data = {
      allocations: [
        { id: "A1", engagementId: "E1", title: "Running", start: "2026-10-09", end: "2027-10-08", status: "Confirmed", current: true },
        { id: "A2", engagementId: "E2", title: "Next", start: "2027-11-01", end: "2027-11-30", status: "Confirmed", current: false },
      ],
      trips: [],
    };
    draw();
    expect(screen.getByText("Current and Upcoming Allocations")).toBeInTheDocument();
    expect(screen.queryByText("Upcoming Allocations")).toBeNull();
  });

  it("never mentions passports or visas", () => {
    state.overview.data = {
      allocations: [],
      trips: [{ jobNumber: "TRV-1", traveller: { email: "j@wso2.com", name: "J" }, country: "India", start: "2026-12-01", end: "2026-12-03", status: "New" }],
    };
    draw();
    expect(screen.queryByText(/passport|visa/i)).toBeNull();
  });

  it("is not drawn, and asks nothing, while not connected", () => {
    state.configured = false;
    expect(draw().container).toBeEmptyDOMElement();
    expect(overviewEnabled).not.toHaveBeenCalledWith(true);
  });

  it("says so, with Retry, when the read fails rather than looking empty", () => {
    state.overview = { ...state.overview, data: undefined, isError: true, error: new Error("boom") };
    draw();
    expect(screen.getByText(/Couldn't load your upcoming allocations and travels/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
