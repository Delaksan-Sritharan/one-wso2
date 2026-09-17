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

import type { ParEmployee } from "../api/types";

// ChainViewTab.tsx's own getFilteredRows: matches name OR email, unlike
// parReportChain.ts's filterChainReports (email only) — that narrower scope
// is that file's own, not something to carry over here.
export function filterHistoryChainEmployees(
  rows: ParEmployee[],
  searchQuery: string,
  showLeadsOnly: boolean,
): ParEmployee[] {
  const term = searchQuery.toLowerCase();
  return rows.filter(
    (row) =>
      (row.employeeName.toLowerCase().includes(term) || row.workEmail.toLowerCase().includes(term)) &&
      (!showLeadsOnly || row.isLead === true),
  );
}
