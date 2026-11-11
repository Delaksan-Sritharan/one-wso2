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

vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));

const authedPost = vi.fn(() => Promise.resolve(null));
const fetchWithReauth = vi.fn();
vi.mock("@api/http", async () => {
  const actual = await vi.importActual<typeof import("@api/http")>("@api/http");
  return {
    ...actual,
    authedPost: (...args: unknown[]) => authedPost(...(args as [])),
    fetchWithReauth: (...args: unknown[]) => fetchWithReauth(...(args as [])),
  };
});

// `@config/apiConfig` reads `window.config` once at module-load time (jsdom
// has no such global), so this must be set before the dynamic imports below
// trigger that module's first evaluation.
(window as unknown as { config: Record<string, string> }).config = {
  ONE_WSO2_UMT_BACKEND_URL: "https://umt.example.com",
};

const { useUmtStartPullRequestAnalysis, useUmtUploadPullRequestAnalysisFile } = await import("./useUmtPrAnalysis");
const { umtServiceUrls } = await import("@config/apiConfig");

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  authedPost.mockClear();
  fetchWithReauth.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useUmtStartPullRequestAnalysis", () => {
  it("POSTs the analysis payload with promotion and invalidates the results and the update", async () => {
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

    expect(authedPost).toHaveBeenCalledWith(
      "https://umt.example.com/update/42/pullRequestAnalysis?promote=true",
      "token",
      payload,
    );
    const invalidatedKeys = invalidateQueries.mock.calls.map((call) => call[0]?.queryKey?.[0]);
    expect(invalidatedKeys).toEqual(expect.arrayContaining(["umt-update-pull-request-analysis", "umt-update"]));
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

  it("sends the product file path as the file part's filename", async () => {
    fetchWithReauth.mockResolvedValue({ ok: true });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useUmtUploadPullRequestAnalysisFile("42"), { wrapper: wrapper(client) });

    await act(async () => {
      await result.current.mutateAsync({
        relativePath: "repository/components/lib/andes-4.0.0.jar",
        sourceFilePath: "",
        file: new File(["contents"], "andes-4.0.0.jar"),
        filePath: "repository/components/lib/andes-4.0.0.jar",
      });
    });

    const formData = fetchWithReauth.mock.calls[0][1].body as FormData;
    expect((formData.get("file") as File).name).toBe("repository/components/lib/andes-4.0.0.jar");
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
