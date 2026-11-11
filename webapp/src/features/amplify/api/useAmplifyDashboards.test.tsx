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
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("@api/http", () => ({ authedGet: vi.fn(), fetchWithReauth: vi.fn(), HttpError: class extends Error {} }));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: { status: "ready", sub: "sub-1" }, retry: vi.fn() }),
  foldIdentityError: (query: unknown) => query,
}));
vi.mock("@config/apiConfig", () => ({
  amplifyServiceUrls: { dashboardPeople: "/dashboards/people" },
  isAmplifyBackendConfigured: () => true,
}));

import { authedGet } from "@api/http";
import { useDashboardPerson } from "./useAmplifyDashboards";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

// A team member Amplify holds no id for comes with `employeeId: null`. Asking anyway requested
// `/dashboards/people/`, which no gateway route matches (a 404 preflight the browser reports as CORS).
describe("useDashboardPerson", () => {
  beforeEach(() => {
    vi.mocked(authedGet).mockReset();
  });

  it.each([null, undefined, "", "  "])("asks nothing for a person with no id (%s)", async (employeeId) => {
    const { result } = renderHook(() => useDashboardPerson(employeeId), { wrapper });
    await act(async () => undefined);
    expect(authedGet).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("asks for the person's board by id", async () => {
    vi.mocked(authedGet).mockResolvedValueOnce({ employeeId: "e 1" });
    renderHook(() => useDashboardPerson("e 1"), { wrapper });
    await waitFor(() => expect(authedGet).toHaveBeenCalledWith("/dashboards/people/e%201", "token"));
  });
});
