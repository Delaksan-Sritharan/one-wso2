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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const authedGet = vi.fn();
const backend = vi.hoisted(() => ({ url: "http://localhost:8090" }));

vi.mock("@api/http", async () => {
  const actual = await vi.importActual<typeof import("@api/http")>("@api/http");
  return { ...actual, authedGet: (...args: unknown[]) => authedGet(...args) };
});
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "access-token" }));
vi.mock("@hooks/useIdToken", () => ({ useIdToken: () => async () => "id-token" }));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@config/apiConfig", () => ({
  get infraBackendUrl() {
    return backend.url;
  },
  isInfraBackendConfigured: () => true,
  get infraServiceUrls() {
    return { leads: `${backend.url}/leads` };
  },
}));

const { useInfraLeads } = await import("./useInfraDirectory");

function wrap(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  authedGet.mockReset().mockResolvedValue([]);
  backend.url = "http://localhost:8090";
});

describe("useInfraLeads localhost JWT header", () => {
  it("sends x-jwt-assertion when the backend is http://localhost", async () => {
    const { result } = renderHook(() => useInfraLeads(), { wrapper: ({ children }) => wrap(children) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(authedGet).toHaveBeenCalledWith("http://localhost:8090/leads", "access-token", {
      "x-jwt-assertion": "id-token",
    });
  });

  it("omits x-jwt-assertion for a localhost lookalike host", async () => {
    backend.url = "http://localhost.example.com";
    const { result } = renderHook(() => useInfraLeads(), { wrapper: ({ children }) => wrap(children) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(authedGet).toHaveBeenCalledWith(
      "http://localhost.example.com/leads",
      "access-token",
      undefined,
    );
  });
});
