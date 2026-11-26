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

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const authedGet = vi.fn<(url: string) => Promise<unknown>>();
vi.mock("@api/http", () => ({ authedGet: (url: string) => authedGet(url) }));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@config/apiConfig", () => ({
  googleOAuthClientId: "config-js-client",
  parServiceUrls: { parAppConfig: () => "/meta/app-config" },
}));
vi.mock("@features/my/util/digiopsHeaders", () => ({ digiopsHeaders: () => ({}) }));

const { useGoogleDrivePicker } = await import("./useGoogleDrivePicker");

const initTokenClient = vi.fn();
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

beforeAll(() => {
  // Google's scripts, already on the page, so nothing is fetched.
  for (const src of ["https://accounts.google.com/gsi/client", "https://apis.google.com/js/api.js"]) {
    const script = document.createElement("script");
    script.src = src;
    document.head.appendChild(script);
  }
  vi.stubGlobal("gapi", { load: (_name: string, done: () => void) => done() });
  class PickerBuilder {
    addView = () => this;
    enableFeature = () => this;
    setOAuthToken = () => this;
    setCallback = () => this;
    build = () => ({ setVisible: () => {} });
  }
  class DocsView {
    setIncludeFolders = () => this;
  }
  vi.stubGlobal("google", {
    accounts: { oauth2: { initTokenClient } },
    picker: { PickerBuilder, DocsView, ViewId: {}, Feature: {}, Action: {} },
  });
});

beforeEach(() => {
  client = new QueryClient();
  authedGet.mockReset();
  initTokenClient.mockReset();
  initTokenClient.mockReturnValue({ requestAccessToken: vi.fn() });
});

async function attach() {
  const { result } = renderHook(() => useGoogleDrivePicker(), { wrapper });
  await act(() => result.current.openPicker(() => {}));
  return result;
}
const clientIds = () => initTokenClient.mock.calls.map(([config]) => config.client_id);
/** Google signs in with the token client made `n`th. */
const signIn = (n: number) =>
  act(() => initTokenClient.mock.calls[n][0].callback({ access_token: `token-${n}`, expires_in: 3600 }));

describe("useGoogleDrivePicker", () => {
  it("signs in with the PAR backend's client ID", async () => {
    authedGet.mockResolvedValue({ googleOAuthClientId: "backend-client" });
    await attach();
    expect(authedGet).toHaveBeenCalledWith("/meta/app-config");
    expect(clientIds()).toEqual(["backend-client"]);
  });

  it("uses config.js's when the backend sends none", async () => {
    authedGet.mockResolvedValue({});
    await attach();
    expect(clientIds()).toEqual(["config-js-client"]);
  });

  it("uses config.js's when the backend can't be reached, and asks again on the next attach", async () => {
    authedGet.mockRejectedValueOnce(new Error("HTTP 404"));
    authedGet.mockResolvedValue({ googleOAuthClientId: "backend-client" });
    const result = await attach();
    // The token got with config.js's client ID isn't reused once the backend's is read.
    signIn(0);
    await act(() => result.current.openPicker(() => {}));
    expect(clientIds()).toEqual(["config-js-client", "backend-client"]);
  });

  it("reuses the token while the client ID stays the same", async () => {
    authedGet.mockResolvedValue({ googleOAuthClientId: "backend-client" });
    const result = await attach();
    signIn(0);
    await act(() => result.current.openPicker(() => {}));
    expect(clientIds()).toEqual(["backend-client"]);
    expect(initTokenClient.mock.results[0].value.requestAccessToken).toHaveBeenCalledTimes(1);
  });

  it("asks the backend once", async () => {
    authedGet.mockResolvedValue({ googleOAuthClientId: "backend-client" });
    const result = await attach();
    await act(() => result.current.openPicker(() => {}));
    expect(authedGet).toHaveBeenCalledTimes(1);
    expect(clientIds()).toEqual(["backend-client"]);
  });
});
