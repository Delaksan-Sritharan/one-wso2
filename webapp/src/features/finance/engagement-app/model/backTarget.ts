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

// Where a page's back link returns to: the last URL seen for the target, so
// a list comes back on the tab, search, filters and page it was left on.

const MAX_SEEN = 50;
const seen: string[] = [];

const pathOf = (url: string): string => url.split("?")[0];
const parentOf = (path: string): string => path.slice(0, path.lastIndexOf("/"));
// A section's own root (/finance/engagement-app, /me) has no siblings to return to.
// An engagement's Edit and Allocate forms are actions, not views: neither is a place to return to.
const ACTION_ROUTES: ReadonlySet<string> = new Set(["edit", "allocate"]);
const isAction = (path: string): boolean => ACTION_ROUTES.has(path.slice(path.lastIndexOf("/") + 1));
const isSectionRoot = (path: string): boolean => path.split("/").filter(Boolean).length <= 2;

/** Records a visited URL (path and query); the newest comes last. */
export function rememberVisit(url: string): void {
  const i = seen.indexOf(url);
  if (i >= 0) seen.splice(i, 1);
  seen.push(url);
  if (seen.length > MAX_SEEN) seen.shift();
}

/**
 * The newest visited URL for `to`, other than the current page: `to` itself or
 * one of its tabs (`to/<tab>`), with the query it had; for a page tab such as an
 * engagement's Allocations, the tab of that page last seen. Otherwise `to`.
 */
export function backTarget(to: string, currentPath: string): string {
  const target = pathOf(to);
  const parent = parentOf(target);
  const siblings = !isSectionRoot(parent);
  for (let i = seen.length - 1; i >= 0; i--) {
    const path = pathOf(seen[i]);
    if (path === currentPath || (isAction(path) && path !== target)) continue;
    if (path === target || parentOf(path) === target || (siblings && parentOf(path) === parent)) return seen[i];
  }
  return to;
}

/** Of the `lists` (each a root path and its label), the one whose page, or one of its tabs, was visited last: where a record was most likely opened from. */
export function lastVisitedList<T extends { readonly to: string }>(lists: readonly T[]): T | undefined {
  for (let i = seen.length - 1; i >= 0; i--) {
    const path = pathOf(seen[i]);
    const hit = lists.find((l) => path === l.to || parentOf(path) === l.to);
    if (hit) return hit;
  }
  return undefined;
}

/** For tests: forgets every visit. */
export function clearVisits(): void {
  seen.length = 0;
}
