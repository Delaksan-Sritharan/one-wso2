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

import { hasAnyGroup, useAsgardeoGroups } from "@hooks/useAsgardeoGroups";
import { parAdminGroup } from "@config/apiConfig";

// Unlike useParIsTeamLead, this isn't a wrapper around useParEmployeeInfo —
// the backend never returns an isAdmin field. Reproduces par-app's own
// check instead: id_token groups claim against a configured group name.
// Presentation only — every admin endpoint re-derives isAdmin from the JWT
// server-side, so a stale config value here can only hide the screen, never
// grant access it shouldn't.
export function useParIsAdmin() {
  const { ready, groups, error, retry } = useAsgardeoGroups();
  return {
    isAdmin: hasAnyGroup(groups, [parAdminGroup]),
    isLoading: !ready,
    isError: Boolean(error),
    error,
    retry,
  };
}
