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

import type { UmtBundleInfoChange, UmtFileOperation, UmtPullRequestAnalysisItem } from "../api/umtUpdates";

// Legacy persists five things to localStorage in the update-edit/view flow.
// Only its stepper position (activeStep_${id}) is actually scoped per update
// id - the other four (pullRequests, files, bundleInfo, selectedTab) are flat,
// global keys that leak stale drafts/tab-selection across different updates.
// Every key here is id-scoped to fix that, following this codebase's existing
// localStorage convention (see features/pinned/pinnedStore.ts): dotted,
// versioned keys, every access wrapped in try/catch with a safe fallback.

function readString(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeString(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // private browsing / storage disabled - non-fatal
  }
}

function readJson<T>(key: string, fallback: T): T {
  const raw = readString(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  writeString(key, JSON.stringify(value));
}

// --- Edit-tab stepper position (mirrors legacy's activeStep_${id}) ---

export function readPersistedEditStep(id: string): string | null {
  return readString(`one-wso2.umt-edit-step.v1.${id}`);
}

export function writePersistedEditStep(id: string, stepId: string | null): void {
  writeString(`one-wso2.umt-edit-step.v1.${id}`, stepId);
}

// --- PR Analysis manual-add drafts (mirrors legacy's pullRequests/files/bundleInfo, id-scoped) ---

export function readPersistedPullRequests(id: string): UmtPullRequestAnalysisItem[] {
  return readJson(`one-wso2.umt-pr-analysis-prs.v1.${id}`, []);
}

export function writePersistedPullRequests(id: string, rows: UmtPullRequestAnalysisItem[]): void {
  writeJson(`one-wso2.umt-pr-analysis-prs.v1.${id}`, rows);
}

export function readPersistedManualFiles(id: string): UmtFileOperation[] {
  return readJson(`one-wso2.umt-pr-analysis-files.v1.${id}`, []);
}

export function writePersistedManualFiles(id: string, rows: UmtFileOperation[]): void {
  writeJson(`one-wso2.umt-pr-analysis-files.v1.${id}`, rows);
}

export function readPersistedBundleInfoChanges(id: string): UmtBundleInfoChange[] {
  return readJson(`one-wso2.umt-pr-analysis-bundle-info.v1.${id}`, []);
}

export function writePersistedBundleInfoChanges(id: string, rows: UmtBundleInfoChange[]): void {
  writeJson(`one-wso2.umt-pr-analysis-bundle-info.v1.${id}`, rows);
}

// --- Update-detail selected tab (mirrors legacy's selectedTab, id-scoped) ---

export function readPersistedSelectedTab(id: string): string | null {
  return readString(`one-wso2.umt-update-tab.v1.${id}`);
}

export function writePersistedSelectedTab(id: string, tab: string): void {
  writeString(`one-wso2.umt-update-tab.v1.${id}`, tab);
}
