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
import type { EngagementSummary, UserInfo } from "../api/engagementTypes";

const state = {
  info: undefined as UserInfo | undefined,
  rows: [] as EngagementSummary[],
  listParams: undefined as unknown,
};

// The header search box has its own tests.
vi.mock("../search/GlobalSearch", () => ({ default: () => null }));
vi.mock("../api/useEngagementUserInfo", async () => {
  const { engagementAccess } = await import("../model/engagementAccess");
  return { useEngagementAccess: () => engagementAccess(state.info), useEngagementUserInfo: () => ({ data: state.info }) };
});
vi.mock("../api/useEngagementApi", () => ({
  useEngagements: (params: unknown) => {
    state.listParams = params;
    return { data: { items: state.rows, total: state.rows.length, counts: { customer: state.rows.length } }, isPending: false, isError: false };
  },
  useEngagementTypes: () => ({ data: [] }),
  useReferenceData: () => ({ data: undefined }),
}));
vi.mock("../api/useEngagementMutations", () => ({
  useSetRequestStatus: () => ({ mutateAsync: vi.fn() }),
  useSetEngagementStatus: () => ({ mutateAsync: vi.fn() }),
  useApproveEngagement: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@context/notifications/NotificationsContext", () => ({ useNotifications: () => ({ showSuccess: vi.fn() }) }));

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import EngagementsPage from "./EngagementsPage";

const user = (allocations: number[]): UserInfo => ({ email: "jane@wso2.com", allocations: { privileges: allocations }, travel: { privileges: [] } });

const engagement: EngagementSummary = {
  id: "E00001",
  typeId: 3,
  typeName: "Non-Paid Pre Sale",
  kind: "customer",
  account: "Orion Retail",
  title: "Orion Retail – Pre-sale workshop",
  allocationType: "Pre-Sale Engagement",
  code: "ORI-INT-PR",
  nature: "On-site",
  country: "Singapore",
  city: "Singapore",
  start: "2026-12-07",
  end: "2026-12-11",
  requestStatus: "New",
  engagementStatus: "Pending",
  consultants: [{ email: "yukthi@wso2.com", name: "Yukthi Lochana" }],
};

const draw = (q = "") =>
  render(
    <MemoryRouter initialEntries={[`/finance/engagement-app/engagements/customer${q}`]}>
      <EngagementsPage segment="customer" />
    </MemoryRouter>,
  );

beforeEach(() => {
  state.rows = [engagement];
});

describe("Engagements", () => {
  it("gives a pre-sale allocator (33 with the page's reads) Allocate as the row's filled button", () => {
    state.info = user([3, 6, 33]);
    draw();
    expect(screen.getByRole("button", { name: "Allocate" })).toBeInTheDocument();
  });

  it("gives an Account Manager no Allocate, and the Create button and the Consultants column", () => {
    state.info = user([1, 2, 3, 5, 8]);
    draw();
    expect(screen.queryByRole("button", { name: "Allocate" })).toBeNull();
    expect(screen.getByRole("button", { name: "Create Customer Engagement" })).toBeInTheDocument();
    expect(screen.getByText("Consultants")).toBeInTheDocument();
    expect(screen.getByText("1 consultant")).toBeInTheDocument();
  });

  it("leaves the Consultants column out without privilege 8", () => {
    state.info = user([3]);
    draw();
    expect(screen.queryByText("Consultants")).toBeNull();
  });

  it("rebuilds the list from the address: the search and filters go to the backend", () => {
    state.info = user([3]);
    draw("?q=orion&requestStatus=New");
    expect(state.listParams).toMatchObject({ segment: "customer", includePending: true, search: "orion", requestStatus: ["New"], offset: 0 });
  });

  it("shows a pending event with its Pending Approval chip and only Edit and Approve, no Allocate", () => {
    state.info = user([13, 16, 15, 27, 28, 4]);
    state.rows = [
      {
        ...engagement,
        id: "EVT00271",
        typeId: 5,
        kind: "marketing",
        requestStatus: "Pending Approval",
        actions: { allocate: false, edit: false, editPending: true, approve: true },
      },
    ];
    render(
      <MemoryRouter initialEntries={["/finance/engagement-app/engagements/marketing"]}>
        <EngagementsPage segment="marketing" />
      </MemoryRouter>,
    );
    expect(state.listParams).toMatchObject({ segment: "marketing", includePending: true });
    expect(screen.getByText("Pending Approval")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Allocate" })).toBeNull();
  });

  it("says why the list is empty and offers Create when nothing exists yet", () => {
    state.info = user([2, 3]);
    state.rows = [];
    draw();
    expect(screen.getByText("No Engagements Yet")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Create Customer Engagement" })).toHaveLength(2);
  });
});
