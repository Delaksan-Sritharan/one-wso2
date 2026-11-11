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
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import InfraHomePage from "@features/infra/pages/InfraHomePage";
import type { InfraGate } from "@features/infra/api/useInfraGate";

vi.mock("@config/apiConfig", () => ({
  isInfraBackendConfigured: () => true,
  isGitHubOAuthConfigured: () => false,
  infraServiceUrls: {},
  infraBackendUrl: "",
}));

const gate = vi.hoisted(() => ({ value: {} as InfraGate }));
vi.mock("@features/infra/api/useInfraGate", () => ({
  useInfraGate: () => gate.value,
}));

const AUTHORIZED: InfraGate = {
  canSee: () => true,
  isAuthorized: true,
  isEmployee: true,
  isApprover: false,
  isAdmin: false,
  isResolving: false,
  isForbidden: false,
  isError: false,
  retry: () => {},
};

function renderHome(g: Partial<InfraGate> = {}) {
  gate.value = { ...AUTHORIZED, ...g };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <InfraHomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  gate.value = AUTHORIZED;
});

describe("InfraHomePage", () => {
  it("offers GitHub connect and does not repeat the menu", () => {
    renderHome();

    expect(screen.getByText("Not Connected")).toBeInTheDocument();
    expect(screen.getByText("GitHub OAuth is not configured.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Connect your GitHub account" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Adding an email address to your GitHub account" })).toHaveAttribute(
      "href",
      "https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-personal-account-on-github/managing-email-preferences/adding-an-email-address-to-your-github-account",
    );
    expect(screen.queryByRole("link", { name: "Open new repository" })).not.toBeInTheDocument();
    expect(screen.queryByText("New Repository")).not.toBeInTheDocument();
    expect(screen.queryByText("Not here yet")).not.toBeInTheDocument();
  });
});
