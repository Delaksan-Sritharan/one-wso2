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

// The campaignTrackerPacing flag is captured at module scope
// (const pacingEnabled = isPreviewEnabled("campaignTrackerPacing")), so each
// test re-imports the page after setting the flag value, giving it a fresh
// module that reads the flag at the right time.

import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const pacingFlag = vi.hoisted(() => ({ enabled: false }));

vi.mock("@config/previewFeatures", () => ({
  isPreviewEnabled: (f: string) => f === "campaignTrackerPacing" && pacingFlag.enabled,
}));

vi.mock("@features/marketing-ops/components/MarketingOpsShell", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@features/marketing-ops/api/useCampaignTracker", () => {
  const idle = { data: undefined, isFetching: false, error: null, refetch: vi.fn() };
  const mutation = { mutateAsync: vi.fn(), isPending: false };
  return {
    useCampaignRegister: () => idle,
    useBudgetPacing: () => idle,
    useWeeklyLog: () => idle,
    useLinkedinRefreshStatus: () => ({ data: undefined }),
    useUpdateRegisterOverride: () => mutation,
    useAddManualPacingRow: () => mutation,
    useUpdateManualPacingRow: () => mutation,
    useDeleteManualPacingRow: () => mutation,
    useAddWeeklyLogEntry: () => mutation,
    useAddWeeklyLogEntryToGroup: () => mutation,
    useUpdateWeeklyLogGroup: () => mutation,
    useUpdateWeeklyLogEntry: () => mutation,
    useSetEntryUnlogged: () => mutation,
    useTriggerLinkedinRefresh: () => mutation,
    setCampaignRegisterCache: vi.fn(),
    setBudgetPacingCache: vi.fn(),
    setWeeklyLogCache: vi.fn(),
  };
});

vi.mock("@features/marketing-ops/ad-campaigns/campaign-tracker/components/campaignTrackerPrimitives", () => ({
  StatStrip: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  StatCell: () => null,
  TrackerLoading: () => null,
}));

vi.mock("@features/marketing-ops/ad-campaigns/campaign-tracker/components/CampaignRegisterTable", () => ({
  CampaignRegisterTable: () => null,
  RegisterFilterControls: () => null,
  EMPTY_REGISTER_FILTERS: {},
}));

vi.mock("@features/marketing-ops/ad-campaigns/campaign-tracker/components/WeeklyLogTable", () => ({
  WeeklyLogTable: () => null,
  LogFilterControls: () => null,
  EMPTY_LOG_FILTERS: {},
}));

vi.mock("@features/marketing-ops/ad-campaigns/campaign-tracker/components/BudgetPacingTable", () => ({
  BudgetPacingTable: () => null,
  PacingFilterControls: () => null,
  EMPTY_PACING_FILTERS: {},
}));

vi.mock("@features/marketing-ops/ad-campaigns/campaign-tracker/components/BuOwnersPanel", () => ({
  BuOwnersPanel: () => null,
}));

vi.mock("@features/marketing-ops/ad-campaigns/campaign-tracker/components/BudgetSyncPanel", () => ({
  BudgetSyncPanel: () => null,
}));

vi.mock("@features/marketing-ops/ad-campaigns/campaign-tracker/components/BudgetSyncPacingPanel", () => ({
  BudgetSyncPacingPanel: () => null,
}));

vi.mock("@features/marketing-ops/ad-campaigns/analytics/components/AnalyticsPrimitives", () => ({
  FieldLabel: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  ToggleChip: () => null,
}));

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("CampaignTrackerPage — Pacing tab flag", () => {
  it("excludes the Pacing tab and starts on Register when the flag is off", async () => {
    pacingFlag.enabled = false;
    const { default: CampaignTrackerPage } = await import("./CampaignTrackerPage");

    render(<CampaignTrackerPage />, { wrapper: makeWrapper() });

    expect(screen.queryByRole("tab", { name: "Pacing" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Register" })).toHaveAttribute("aria-selected", "true");
  });

  it("includes the Pacing tab and starts on it when the flag is on", async () => {
    pacingFlag.enabled = true;
    const { default: CampaignTrackerPage } = await import("./CampaignTrackerPage");

    render(<CampaignTrackerPage />, { wrapper: makeWrapper() });

    expect(screen.getByRole("tab", { name: "Pacing" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Pacing" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Register" })).toHaveAttribute("aria-selected", "false");
  });
});
