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

// Where the OPD Claims app lives in the Finance perspective.
//
// OPD has had no home of its own here: it arrived as a tab under Me → Claims,
// beside expense claims, because both are things an employee files. That is
// true of the history, but it left the app with no front door of its own the
// way Expense Claims and Credit Card Expenses have, and nowhere for finance's
// own OPD screens to hang. This is that front door.
//
// Named rather than written out at each call site — the CC app moved once and
// a hardcoded link survived the move as a dead button until a grep found it
// (`ccPaths.ts`). The registry, the route and the overview tile all read from
// here, so they cannot drift apart.
//
// The Me → Claims OPD tab keeps its own routes (`claimsTabs.ts`); nothing here
// replaces or redirects them.
export const OPD_PATH = "/finance/opd";

export const opdPaths = {
  newClaim: `${OPD_PATH}/new`,
} as const;
