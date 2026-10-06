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

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

export function formatCount(value: number): string {
  return compact.format(value);
}

export function productLabel(productName: string | null, repoName: string): string {
  return productName && productName.trim() !== "" ? productName : repoName;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Collection jobs are instants, so the time is the viewer's local zone.
// Download tables keep the API's calendar date, which is already a day.
export function formatJobTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number): string => String(n).padStart(2, "0");
  const day = `${pad(date.getDate())} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  return `${day}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const JOB_STATUS_LABEL: Record<string, string> = {
  SUCCESS: "Success",
  PARTIAL_FAILURE: "Partial failure",
  FAILED: "Failed",
  STARTED: "Started",
};

export function jobStatusLabel(status: string): string {
  return JOB_STATUS_LABEL[status] ?? status;
}

const activityDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export function activityDate(value: string | null | undefined): string | undefined {
  return value && activityDatePattern.test(value) ? value : undefined;
}

export function isIsolatedPoint(
  data: readonly Record<string, string | number | null>[],
  dataKey: string,
  index: number,
): boolean {
  const value = data[index]?.[dataKey];
  const prev = index > 0 ? data[index - 1]?.[dataKey] : null;
  const next = index + 1 < data.length ? data[index + 1]?.[dataKey] : null;
  return typeof value === "number" && typeof prev !== "number" && typeof next !== "number";
}
