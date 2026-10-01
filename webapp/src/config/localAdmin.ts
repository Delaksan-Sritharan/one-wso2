/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * LOCAL ONLY — NOT FOR COMMIT.
 *
 * A developer's own machine standing in for an `admin` privilege it does not
 * have. Admin-gated finance screens — the four Master Data tables — are opened
 * by people-app privilege 999, which no local test account holds, so they are
 * invisible to the very people building them: the rail row is absent and the
 * route redirects, which looks like a broken feature and is really just a
 * correctly-applied permission.
 *
 * Two guards, and both have to hold:
 *
 *  1. The switch lives in `public/config.js`, which is gitignored — it cannot
 *     be committed, staged or deployed by accident, because it is not in the
 *     repository at all.
 *  2. Even set, it is ignored anywhere but a loopback host. A `config.js`
 *     copied from a laptop onto a real deployment grants nothing.
 */

/**
 * Loopback only. An explicit list rather than a pattern: "contains localhost"
 * would also match `localhost.some-real-domain.com`, and a check that can be
 * fooled by a hostname somebody else chooses is not a check.
 */
const LOOPBACK_HOSTS: readonly string[] = ["localhost", "127.0.0.1", "[::1]", "::1"];

/** Whether this page is being served from the developer's own machine. */
function isLoopbackHost(): boolean {
  return LOOPBACK_HOSTS.includes(window.location.hostname);
}

/**
 * Whether to treat this session as holding the `admin` capability.
 *
 * ```js
 * // public/config.js — local only, gitignored
 * ONE_WSO2_LOCAL_ADMIN: true,
 * ```
 */
export function isLocalAdminOverride(): boolean {
  return isLoopbackHost() && window.config?.ONE_WSO2_LOCAL_ADMIN === true;
}
