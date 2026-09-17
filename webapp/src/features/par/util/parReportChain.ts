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

import type { ParChainReport } from "../api/types";

// Ports ReportChainView.tsx's own getFilteredRows: search matches the email
// only (not the name, same narrower scope as Additional Reports), combined
// with the "Show Leads Only" toggle — `isEmployeeALead` is a literal "True"
// string from the backend, not a boolean.
export function filterChainReports(
  rows: ParChainReport[],
  searchQuery: string,
  showLeadsOnly: boolean,
): ParChainReport[] {
  const term = searchQuery.toLowerCase();
  return rows.filter(
    (row) =>
      row.parEmployeeEmail.toLowerCase().includes(term) &&
      (!showLeadsOnly || row.isEmployeeALead.toLowerCase() === "true"),
  );
}

// `params.row.isEmployeeALead === "True"` gates the "View Subordinates"
// action in source — an exact-case comparison, unlike the toLowerCase one
// above. Kept as its own predicate so the action and the filter can't
// silently drift if the backend's casing ever changes.
export function isEmployeeALead(row: ParChainReport): boolean {
  return row.isEmployeeALead === "True";
}
