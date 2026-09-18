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
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import type { ReactNode } from "react";

// Mocked at the query layer rather than at useParIsTeamLead, so the real
// gate formula is what runs here.
const employeeInfo: { isSuccess: boolean; isLoading: boolean; data?: { isTeamLead: boolean } } = {
  isSuccess: false,
  isLoading: false,
};

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) =>
    queryKey[0] === "par-employee-info" ? employeeInfo : { data: undefined },
}));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));

const profile = { data: { userInfo: { workEmail: "someone@wso2.com" } }, isLoading: false };
vi.mock("@features/my/api/useMeProfile", () => ({ useMeProfile: () => profile }));

vi.mock("../components/ParShell", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const { default: ParLeadGroupPage, ParLeadGroupIndex, ParRequiresTeamLeadRoute } = await import(
  "./ParLeadGroupPage"
);

/** Always mounted, so a redirect is visible even when the route renders nothing. */
function UrlProbe() {
  const { pathname } = useLocation();
  return <div data-testid="url">{pathname}</div>;
}

function Tab({ name }: { name: string }) {
  return <div data-testid="tab-body">{name}</div>;
}

beforeEach(() => {
  employeeInfo.isSuccess = false;
  employeeInfo.isLoading = false;
  employeeInfo.data = undefined;
  profile.isLoading = false;
});

function isTeamLead(value: boolean) {
  employeeInfo.isSuccess = true;
  employeeInfo.data = { isTeamLead: value };
}

/** The group, wired the way App.tsx wires it. */
function show(initial = "/people-ops/performance/lead") {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <UrlProbe />
      <Routes>
        <Route path="/people-ops/performance" element={<div data-testid="employee-portal" />} />
        <Route
          path="/people-ops/performance/lead"
          element={
            <ParRequiresTeamLeadRoute>
              <ParLeadGroupPage />
            </ParRequiresTeamLeadRoute>
          }
        >
          <Route index element={<ParLeadGroupIndex />} />
          <Route path="direct-reports" element={<Tab name="Direct Reports" />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("a team lead", () => {
  beforeEach(() => isTeamLead(true));

  it("sees the Direct Reports tab", async () => {
    show();
    expect(await screen.findByRole("tab", { name: "Direct Reports" })).toBeInTheDocument();
  });

  it("lands on Direct Reports, so the group URL is never blank", async () => {
    show();
    expect(await screen.findByTestId("url")).toHaveTextContent(
      "/people-ops/performance/lead/direct-reports",
    );
  });
});

describe("someone who isn't a team lead", () => {
  beforeEach(() => isTeamLead(false));

  // Unlike ParRequiresLeadRoute (fails open — a UX-only tab-visibility
  // decision), this fails CLOSED: showing an empty Lead Portal to everyone
  // while the lookup is in flight would flash a broken page for every
  // non-lead on every load, and there is no tab-set to preserve here, only
  // whole-portal access.
  it("is redirected to the Employee Portal", async () => {
    show();
    expect(await screen.findByTestId("url")).toHaveTextContent("/people-ops/performance");
    expect(screen.queryByTestId("tab-body")).not.toBeInTheDocument();
  });

  it("is redirected away even when deep-linking straight to a tab", async () => {
    show("/people-ops/performance/lead/direct-reports");
    expect(await screen.findByTestId("url")).toHaveTextContent("/people-ops/performance");
  });
});

describe("before the lookup has answered", () => {
  it("renders nothing rather than a flash of the portal", async () => {
    employeeInfo.isSuccess = false;
    employeeInfo.isLoading = true;
    show();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByTestId("employee-portal")).not.toBeInTheDocument();
  });

  it("sends nobody anywhere while the signed-in email is still loading", async () => {
    profile.isLoading = true;
    show();
    expect(await screen.findByTestId("url")).toHaveTextContent("/people-ops/performance/lead");
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });
});
