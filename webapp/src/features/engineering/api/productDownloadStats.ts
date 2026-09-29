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

import { authedGet } from "@api/http";

// Read at call time, not at import. The preview switch works the same way:
// a test (and a config.js edit) has to be able to change the answer without
// reimporting the page.

export function productDownloadStatsBackendUrl(): string {
  return (window.config?.ONE_WSO2_PRODUCT_DOWNLOAD_STATS_BACKEND_URL ?? "").replace(
    /\/+$/,
    "",
  );
}

export function isProductDownloadStatsConfigured(): boolean {
  return productDownloadStatsBackendUrl().length > 0;
}

export interface TopProduct {
  repoId: number;
  repoName: string;
  productName: string | null;
  todayDownloads: number;
  totalDownloads: number;
  stars: number;
}

export interface Summary {
  trackedRepositories: number;
  totalDownloads: number;
  totalClonesLast14d: number;
  todayDownloads: number;
  todayDeltaPct: number | null;
  monthDownloads: number;
  topProducts: TopProduct[];
}

export interface DailyPoint {
  date: string;
  value: number;
}

export interface DailySeries {
  repoId: number;
  repoName: string;
  points: DailyPoint[];
}

export interface DailyResponse {
  series: DailySeries[];
}

export interface TrackedRepository {
  id: number;
  repoName: string;
  productName: string | null;
}

export interface RepositoriesResponse {
  repositories: TrackedRepository[];
}

export function getSummary(accessToken: string): Promise<Summary> {
  return authedGet(`${productDownloadStatsBackendUrl()}/api/v1/stats/summary`, accessToken);
}

// Last 30 days through today, UTC, matching the existing Overview chart.
// The API already labels each point; this only chooses the window.
export function dailyRange(now = new Date()): { from: string; to: string } {
  const to = now.toISOString().slice(0, 10);
  const fromDate = new Date(now);
  fromDate.setUTCDate(fromDate.getUTCDate() - 30);
  return { from: fromDate.toISOString().slice(0, 10), to };
}

export function getDaily(accessToken: string, now = new Date()): Promise<DailyResponse> {
  const { from, to } = dailyRange(now);
  const params = new URLSearchParams({ from, to, interval: "day" });
  return authedGet(
    `${productDownloadStatsBackendUrl()}/api/v1/stats/daily?${params}`,
    accessToken,
  );
}

export function getRepositories(accessToken: string): Promise<RepositoriesResponse> {
  return authedGet(`${productDownloadStatsBackendUrl()}/api/v1/repositories`, accessToken);
}
