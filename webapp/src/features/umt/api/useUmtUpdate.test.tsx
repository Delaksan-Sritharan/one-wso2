// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy at
// http://www.apache.org/licenses/LICENSE-2.0

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: { status: "ready", sub: "user-under-test" }, retry: () => {} }),
  foldIdentityError: (query: unknown) => query,
}));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));

const authedGet = vi.fn();
vi.mock("@api/http", async () => {
  const actual = await vi.importActual<typeof import("@api/http")>("@api/http");
  return { ...actual, authedGet: (...args: unknown[]) => authedGet(...(args as [])) };
});

// `@config/apiConfig` reads `window.config` once at module-load time, so this
// must be set before the dynamic import below.
(window as unknown as { config: Record<string, string> }).config = {
  ONE_WSO2_UMT_BACKEND_URL: "https://umt.example.com",
};

const { useUmtUpdate } = await import("./useUmtUpdate");

const queryKey = ["umt-update", "user-under-test", "42"];

function renderUpdate() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateQueries = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useUmtUpdate("42"), { wrapper });
  return { client, result, invalidateQueries };
}

function refetchInterval(client: QueryClient) {
  const query = client.getQueryCache().find({ queryKey });
  const options = query!.options as unknown as { refetchInterval: (q: unknown) => number | false };
  return (data: Record<string, unknown>) => options.refetchInterval({ state: { data } });
}

beforeEach(() => {
  authedGet.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useUmtUpdate", () => {
  it("polls while a PR analysis or the promotion after it is running, and stops once both have ended", async () => {
    authedGet.mockResolvedValue({ id: 42, lifecycleState: "Development", praStatus: "NONE" });
    const { client, result } = renderUpdate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const interval = refetchInterval(client);

    expect(interval({ lifecycleState: "Development", praStatus: "QUEUED", praPromotionPending: true })).toBe(3000);
    expect(interval({ lifecycleState: "Development", praStatus: "PROCESSING", praPromotionPending: true })).toBe(3000);
    expect(interval({ lifecycleState: "PRAnalyzed", praStatus: "COMPLETED", praPromotionPending: true })).toBe(3000);
    expect(interval({ lifecycleState: "PRAnalyzed", praStatus: "COMPLETED", praPromotionPending: false })).toBe(false);
    expect(interval({ lifecycleState: "Development", praStatus: "NONE", praPromotionPending: false })).toBe(false);
  });

  it("re-reads what the promotion changed once it ends", async () => {
    authedGet.mockResolvedValueOnce({
      id: 42,
      lifecycleState: "PRAnalyzed",
      praStatus: "COMPLETED",
      praPromotionPending: true,
    });
    const { client, result, invalidateQueries } = renderUpdate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateQueries).not.toHaveBeenCalled();

    authedGet.mockResolvedValueOnce({
      id: 42,
      lifecycleState: "PRAnalyzed",
      praStatus: "COMPLETED",
      praPromotionPending: false,
    });
    await act(async () => {
      await client.refetchQueries({ queryKey });
    });

    const invalidatedKeys = invalidateQueries.mock.calls.map((call) => call[0]?.queryKey?.[0]);
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([
        "umt-updates",
        "umt-update-lifecycle-history",
        "umt-update-product-analysis",
        "umt-update-pull-request-analysis",
      ]),
    );
  });

  it("re-reads nothing when no promotion was pending", async () => {
    authedGet.mockResolvedValue({ id: 42, lifecycleState: "PRAnalyzed", praStatus: "COMPLETED", praPromotionPending: false });
    const { client, result, invalidateQueries } = renderUpdate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    await act(async () => {
      await client.refetchQueries({ queryKey });
    });

    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});
