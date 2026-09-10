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

// Builds the reporting tree from the flat employee directory (see
// useEmployeeDirectory) by walking managerEmail pointers — the whole tree is
// already in memory, so this is synchronous, unlike the original per-manager
// lazy-fetch model.

import type { EmployeeDirectoryRecord, OrgChartNode } from "../api/orgChartTypes";

export interface OrgChartTree {
  root: OrgChartNode;
  /**
   * Independent subtrees whose top person's managerEmail doesn't resolve to
   * anyone in the directory — almost always because that manager has fully
   * left the company, not a data error. Kept visible (rendered separately)
   * rather than silently dropped from the page.
   */
  strayRoots: OrgChartNode[];
}

// `visited` guards against buildNode recursing forever: childrenByManager is
// keyed on managerEmail, so a self-managed row (managerEmail === workEmail —
// the Chairman fixture is exactly this shape, see expandPathToEmployee.test.ts)
// lands in its own children bucket. Mirrors ancestorChain's guard below.
function buildNode(
  record: EmployeeDirectoryRecord,
  childrenByManager: Map<string, EmployeeDirectoryRecord[]>,
  visited: Set<string> = new Set(),
): OrgChartNode {
  visited.add(record.workEmail);
  const children = (childrenByManager.get(record.workEmail) ?? [])
    .filter((child) => child.workEmail !== record.workEmail && !visited.has(child.workEmail))
    .map((child) => buildNode(child, childrenByManager, visited));
  return { ...record, children };
}

/**
 * Builds the tree. There's no "managerEmail is null" signal for the root —
 * every row, including the Chairman's, has a non-empty managerEmail (see
 * EmployeeDirectoryRecord). A row is a root CANDIDATE when its managerEmail
 * doesn't resolve to anyone else in the fetched directory. In practice
 * several such candidates exist (confirmed ~27 in staging) — most are people
 * whose actual manager has left the company (excluded from this endpoint,
 * which only returns Active/Marked leaver), not the company root. The real
 * root is picked by an exact "Chairman" designation match (or `rootEmail`
 * when the caller already knows it); everyone else orphaned becomes a
 * strayRoot instead of being dropped.
 */
export function buildOrgTree(employees: readonly EmployeeDirectoryRecord[], rootEmail?: string): OrgChartTree | null {
  const byEmail = new Map(employees.map((employee) => [employee.workEmail, employee]));
  const childrenByManager = new Map<string, EmployeeDirectoryRecord[]>();
  employees.forEach((employee) => {
    const siblings = childrenByManager.get(employee.managerEmail) ?? [];
    siblings.push(employee);
    childrenByManager.set(employee.managerEmail, siblings);
  });

  const orphans = employees.filter(
    (employee) => employee.managerEmail === employee.workEmail || !byEmail.has(employee.managerEmail),
  );

  const rootRecord =
    (rootEmail && byEmail.get(rootEmail)) ??
    orphans.find((employee) => employee.designation?.trim().toLowerCase() === "chairman");
  if (!rootRecord) return null;

  const strayRoots = orphans
    .filter((employee) => employee.workEmail !== rootRecord.workEmail)
    .map((employee) => buildNode(employee, childrenByManager));

  return { root: buildNode(rootRecord, childrenByManager), strayRoots };
}

/** workEmail -> record, for ancestor-chain walks (search-jump) and lookups. */
export function indexByEmail(employees: readonly EmployeeDirectoryRecord[]): Map<string, EmployeeDirectoryRecord> {
  return new Map(employees.map((employee) => [employee.workEmail, employee]));
}

/** Distinct `company` values from the directory, alphabetical — the options
 *  for the company filter dropdown. Shared between the live page and the
 *  offline export so the two stay in sync. */
export function companyNames(employees: readonly { company: string }[]): string[] {
  const names = new Set<string>();
  employees.forEach((employee) => {
    const name = employee.company?.trim();
    if (name) names.add(name);
  });
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}
