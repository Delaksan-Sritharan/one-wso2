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
import { render, screen } from "@testing-library/react";
import type { InfraGate } from "@features/infra/api/useInfraGate";

const configured = vi.hoisted(() => ({ value: false }));
vi.mock("@config/apiConfig", () => ({
  isInfraBackendConfigured: () => configured.value,
}));

const gate = vi.hoisted(() => ({ value: {} as InfraGate }));
vi.mock("@features/infra/api/useInfraGate", () => ({
  useInfraGate: () => gate.value,
}));

vi.mock("@components/perspective-landing/PerspectiveLanding", () => ({
  default: () => <div>perspective landing</div>,
}));

const { default: InfraPerspectiveLanding } = await import("./InfraPerspectiveLanding");

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

beforeEach(() => {
  configured.value = false;
  gate.value = AUTHORIZED;
});

describe("InfraPerspectiveLanding", () => {
  it("shows the config notice when the Infra backend is unset", () => {
    configured.value = false;
    render(<InfraPerspectiveLanding />);
    expect(screen.getByText(/ONE_WSO2_INFRA_BACKEND_URL/)).toBeInTheDocument();
    expect(screen.queryByText("perspective landing")).not.toBeInTheDocument();
  });

  it("forwards to PerspectiveLanding when the backend is configured", () => {
    configured.value = true;
    render(<InfraPerspectiveLanding />);
    expect(screen.getByText("perspective landing")).toBeInTheDocument();
    expect(screen.queryByText(/ONE_WSO2_INFRA_BACKEND_URL/)).not.toBeInTheDocument();
  });
});
