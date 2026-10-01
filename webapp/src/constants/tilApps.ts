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

// "Today I Learned" under the Me perspective — a company-wide feed every
// employee can read and post to, same rationale as Menu/Leave: an everyday
// thing any employee uses, not a role-gated tool. Kept in its own file
// (rather than appended to meApps.ts's ME_APPS) because it is held behind a
// preview flag until til-backend and the Chat App are both live — see
// isPreviewEnabled("til")'s call in perspectives.ts, the same arrangement
// ME_PROMOTION_APPS (promotionApps.ts) uses.

import { LightbulbIcon } from "@wso2/oxygen-ui-icons-react";
import type { MenuApp } from "@constants/appMenu";

export const ME_TIL_APPS: readonly MenuApp[] = [
  {
    key: "til",
    name: "Today I Learned",
    icon: LightbulbIcon,
    purpose: "Share and browse learnings from customers, partners, and internal sources.",
    items: [
      {
        id: "til-home",
        label: "Today I Learned",
        desc: "Share something you learned, and see what everyone else has shared.",
        path: "/me/til",
      },
    ],
  },
];
