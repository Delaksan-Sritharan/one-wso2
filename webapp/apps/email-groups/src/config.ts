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

// Email Group Manager backend (digiops-infra/apps/email-group-manager). Read
// from window.config at runtime — the remote runs inside the shell's page, so
// it sees the same public/config.js the shell does.

declare global {
  interface Window {
    config?: { ONE_WSO2_EMAIL_GROUPS_BACKEND_URL?: string };
  }
}

const emailGroupsBackendUrl: string = window.config?.ONE_WSO2_EMAIL_GROUPS_BACKEND_URL ?? "";

export function isEmailGroupsBackendConfigured(): boolean {
  return Boolean(emailGroupsBackendUrl);
}

export const emailGroupsServiceUrls = {
  // Groups every employee is subscribed to automatically. Read-only.
  defaultGroups: `${emailGroupsBackendUrl}/default-google-groups`,
  // The full catalog the caller may subscribe to or unsubscribe from.
  allGroups: `${emailGroupsBackendUrl}/all-google-groups`,
  // The caller's own memberships: default groups, opted-in catalog groups, and
  // groups an admin added them to that aren't in the catalog.
  userGroups: `${emailGroupsBackendUrl}/user-google-groups`,
  // PATCH, body `{groupName, userEmail}`.
  subscribe: `${emailGroupsBackendUrl}/google-group/subscribe`,
  unsubscribe: `${emailGroupsBackendUrl}/google-group/unsubscribe`,
};
