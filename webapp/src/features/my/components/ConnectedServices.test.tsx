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
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { NotificationsProvider } from "@context/notifications/NotificationsContext";

// The promotion backend URL is read once, when apiConfig loads, so it has to be
// in place before anything imports it. The preview flag is read per call, so
// each case sets it for itself. Every other backend stays unset, so the
// neighbouring cards on this strip ask nothing.
const PROMOTION_URL = "https://promotion.example.com/v1";
vi.hoisted(() => {
  window.config = {
    ...(window.config ?? {}),
    ONE_WSO2_PROMOTION_BACKEND_URL: "https://promotion.example.com/v1",
  } as Window["config"];
});

// One object for every render, as the real provider gives. useAsgardeoUser's
// effect depends on getDecodedIdToken and sets state, so a fresh function per
// render re-runs it forever and the worker runs out of memory.
const asgardeo = vi.hoisted(() => ({
  isSignedIn: true,
  getDecodedIdToken: async () => ({ email: "person@wso2.com" }),
}));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => asgardeo }));
const getAccessToken = vi.hoisted(() => async () => "token");
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => getAccessToken }));
const authedGet = vi.hoisted(() => vi.fn());
vi.mock("@api/http", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@api/http")>()),
  authedGet,
}));

import ConnectedServices from "./ConnectedServices";

const originalConfig = window.config;

function setPromotionPreview(on: boolean) {
  window.config = {
    ...originalConfig,
    ONE_WSO2_PREVIEW_FEATURES: { promotion: on },
  } as Window["config"];
}

function promotionRequests(): string[] {
  return authedGet.mock.calls.map(([url]) => String(url)).filter((url) => url.startsWith(PROMOTION_URL));
}

function renderMeStrip() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NotificationsProvider>
        <MemoryRouter>
          <ConnectedServices />
        </MemoryRouter>
      </NotificationsProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  authedGet.mockReset();
  authedGet.mockResolvedValue({ promotionRequests: [] });
});

afterEach(() => {
  window.config = originalConfig;
});

describe("the Me profile's services strip, with the promotion backend configured", () => {
  it("asks the promotion backend nothing and shows no promotion line while the promotion preview is off", async () => {
    setPromotionPreview(false);
    renderMeStrip();

    // Wait for what does load here, so a request that was going to go out has.
    expect(await screen.findByText(/performance & growth/i)).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(promotionRequests(), "a request reached the promotion backend").toEqual([]);
    expect(screen.queryByText("Last promotion")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /promotion history/i })).not.toBeInTheDocument();
  });

  // The other half: without it, switching promotion off for everyone would
  // pass the case above.
  it("asks for the person's approved promotions and shows the latest one while the promotion preview is on", async () => {
    setPromotionPreview(true);
    authedGet.mockResolvedValue({
      promotionRequests: [
        {
          id: 7,
          employeeEmail: "person@wso2.com",
          currentJobBand: 5,
          currentJobRole: "Software Engineer",
          nextJobBand: 6,
          promotionCycle: "2023-H2",
          promotionStatement: null,
          businessUnit: "Engineering",
          department: "Integration",
          team: "Platform",
          subTeam: null,
          promotionType: "NORMAL",
          status: "APPROVED",
          createdOn: "2023-10-01",
          updatedOn: "2023-12-01",
        },
      ],
    });
    renderMeStrip();

    expect(await screen.findByText("2023-H2 · JB 5 → 6")).toBeInTheDocument();
    expect(screen.getByText("Last promotion")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view promotion history/i })).toBeInTheDocument();
    await waitFor(() =>
      expect(promotionRequests()).toEqual([
        `${PROMOTION_URL}/promotion/requests?statusArray=APPROVED&employeeEmail=person%40wso2.com`,
      ]),
    );
  });
});
