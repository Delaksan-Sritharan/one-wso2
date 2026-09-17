// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy at
// http://www.apache.org/licenses/LICENSE-2.0

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: { status: "ready", sub: "user-under-test" }, retry: () => {} }),
}));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));

const authedPost = vi.fn(() => Promise.resolve(null));
const authedPut = vi.fn(() => Promise.resolve(null));
const fetchWithReauth = vi.fn();
vi.mock("@api/http", async () => {
  const actual = await vi.importActual<typeof import("@api/http")>("@api/http");
  return {
    ...actual,
    authedPost: (...args: unknown[]) => authedPost(...(args as [])),
    authedPut: (...args: unknown[]) => authedPut(...(args as [])),
    fetchWithReauth: (...args: unknown[]) => fetchWithReauth(...(args as [])),
  };
});

function textResponse(body: string, ok = true, status = 200) {
  return { ok, status, text: async () => body };
}

// `@config/apiConfig` reads `window.config` once at module-load time (jsdom
// has no such global), so this must be set before the dynamic imports below
// trigger that module's first evaluation.
(window as unknown as { config: Record<string, string> }).config = {
  ONE_WSO2_UMT_BACKEND_URL: "https://umt.example.com",
};

const {
  useUmtPrAnalysisStatus,
  useUmtStartPullRequestAnalysis,
  useUmtProceedFromPrAnalysis,
  useUmtUploadPullRequestAnalysisFile,
} = await import("./useUmtPrAnalysis");
const { umtServiceUrls } = await import("@config/apiConfig");

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  authedPost.mockClear();
  authedPut.mockClear();
  fetchWithReauth.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useUmtPrAnalysisStatus", () => {
  it("seeds from the initial status without an immediate fetch", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useUmtPrAnalysisStatus("42", "COMPLETED", true, false), {
      wrapper: wrapper(client),
    });
    expect(result.current.data).toBe("COMPLETED");
    expect(fetchWithReauth).not.toHaveBeenCalled();
  });

  // Regression test: the backend sends `content-type: application/json` but
  // the body is a bare, unquoted status word (e.g. `COMPLETED`, not
  // `"COMPLETED"`) — not valid JSON. Parsing it as JSON throws on every poll,
  // so the query never leaves its seeded initialData. This must be read as
  // plain text.
  it("reads the bare (non-JSON) status text the backend actually returns", async () => {
    fetchWithReauth.mockResolvedValue(textResponse("COMPLETED"));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const queryKey = ["umt-update-pr-analysis-status", "user-under-test", "42"];

    renderHook(() => useUmtPrAnalysisStatus("42", "QUEUED", true, false), { wrapper: wrapper(client) });
    await act(async () => {
      await client.refetchQueries({ queryKey });
    });

    expect(client.getQueryData(queryKey)).toBe("COMPLETED");
  });

  it("computes a 3s refetch interval while queued or processing, and stops once terminal", () => {
    fetchWithReauth.mockResolvedValue(textResponse("QUEUED"));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderHook(() => useUmtPrAnalysisStatus("42", "QUEUED", true, false), { wrapper: wrapper(client) });

    const queryKey = ["umt-update-pr-analysis-status", "user-under-test", "42"];
    const query = client.getQueryCache().find({ queryKey });
    expect(query).toBeDefined();
    const options = query!.options as unknown as { refetchInterval: (q: unknown) => number | false };
    const refetchInterval = options.refetchInterval;

    expect(refetchInterval({ state: { data: "QUEUED" } })).toBe(3000);
    expect(refetchInterval({ state: { data: "PROCESSING" } })).toBe(3000);
    expect(refetchInterval({ state: { data: "COMPLETED" } })).toBe(false);
    expect(refetchInterval({ state: { data: "failed: some reason" } })).toBe(false);
  });

  // Regression test for the stalled-polling bug: a single invalidation-
  // triggered refetch right after starting analysis can race the backend and
  // read back the pre-analysis value. awaitingConfirmation keeps the loop
  // alive in that window regardless of what the last observed value was —
  // it never changes what value is shown, only whether polling continues.
  it("keeps polling while awaitingConfirmation is true, even if the last read isn't QUEUED/PROCESSING", () => {
    fetchWithReauth.mockResolvedValue(textResponse(""));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderHook(() => useUmtPrAnalysisStatus("42", "", true, true), { wrapper: wrapper(client) });

    const queryKey = ["umt-update-pr-analysis-status", "user-under-test", "42"];
    const query = client.getQueryCache().find({ queryKey });
    expect(query).toBeDefined();
    const options = query!.options as unknown as { refetchInterval: (q: unknown) => number | false };
    const refetchInterval = options.refetchInterval;

    // The last read was neither QUEUED nor PROCESSING (e.g. the pre-analysis
    // idle value), yet polling keeps going because awaitingConfirmation is true.
    expect(refetchInterval({ state: { data: "" } })).toBe(3000);
  });
});

describe("useUmtStartPullRequestAnalysis", () => {
  it("POSTs the analysis payload and invalidates status + results", async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidateQueries = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useUmtStartPullRequestAnalysis("42"), { wrapper: wrapper(client) });

    const payload = {
      updateId: "42",
      pullRequests: [{ pr: "https://github.com/wso2/repo/pull/1" }],
      additionalFileOperations: [],
      bundlesInfoChanges: [],
      isInstructionsOnly: false,
      isContainerizedUpdate: false,
    };

    await act(async () => {
      await result.current.mutateAsync(payload);
    });

    expect(authedPost).toHaveBeenCalledWith(umtServiceUrls.updatePullRequestAnalysis("42"), "token", payload);
    const invalidatedKeys = invalidateQueries.mock.calls.map((call) => call[0]?.queryKey?.[0]);
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining(["umt-update-pr-analysis-status", "umt-update-pull-request-analysis"]),
    );
  });
});

describe("useUmtProceedFromPrAnalysis", () => {
  it("promotes lifecycleState to PRAnalyzed then starts product analysis, and invalidates the right queries", async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidateQueries = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useUmtProceedFromPrAnalysis("42"), { wrapper: wrapper(client) });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(authedPut).toHaveBeenCalledWith(umtServiceUrls.update("42"), "token", {
      lifecycleState: "PRAnalyzed",
    });
    expect(authedPost).toHaveBeenCalledWith(umtServiceUrls.updateProductAnalysis("42"), "token", {});

    const invalidatedKeys = invalidateQueries.mock.calls.map((call) => call[0]?.queryKey?.[0]);
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([
        "umt-update",
        "umt-updates",
        "umt-update-lifecycle-history",
        "umt-update-product-analysis",
      ]),
    );
  });
});

describe("useUmtUploadPullRequestAnalysisFile", () => {
  it("uploads multipart fields to the file endpoint", async () => {
    fetchWithReauth.mockResolvedValue({ ok: true });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useUmtUploadPullRequestAnalysisFile("42"), { wrapper: wrapper(client) });

    const file = new File(["contents"], "bundle.jar");
    await act(async () => {
      await result.current.mutateAsync({
        relativePath: "/repository/components/plugins/bundle.jar",
        sourceFilePath: "",
        file,
      });
    });

    expect(fetchWithReauth).toHaveBeenCalledTimes(1);
    const [url, init] = fetchWithReauth.mock.calls[0];
    expect(url).toBe(umtServiceUrls.updatePullRequestAnalysisFile("42"));
    expect(init.method).toBe("POST");
    const formData = init.body as FormData;
    expect(formData.get("relativePath")).toBe("/repository/components/plugins/bundle.jar");
    expect(formData.get("id")).toBe("42");
    expect(formData.get("file")).toBe(file);
  });

  it("throws when the upload response is not ok", async () => {
    fetchWithReauth.mockResolvedValue({ ok: false, status: 400, text: async () => "bad request" });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useUmtUploadPullRequestAnalysisFile("42"), { wrapper: wrapper(client) });

    await expect(
      result.current.mutateAsync({ relativePath: "/a", sourceFilePath: "", file: new File([], "a") }),
    ).rejects.toThrow();
  });
});
