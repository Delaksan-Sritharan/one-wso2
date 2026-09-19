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

// Registry of the digiops-finance apps and their top-level menu items,
// surfaced inside the Me perspective — claims/expenses are something an
// employee submits and tracks for themself, same rationale as Leave. Every
// item is a native route (built under src/features/finance/*), so each
// carries a `path` — the left rail navigates straight to it.
//
// Transcribed from each app's own webapp nav (routes.tsx / route.ts /
// Sidebar). Finance app roles (USER / EMPLOYEE / LEAD / FINANCE) map onto
// One WSO2 capabilities as: USER/EMPLOYEE/all → everyone, LEAD → lead,
// FINANCE → admin (One WSO2 has no dedicated Finance privilege number).
// Each app's own backend still enforces its real role scheme; these
// capability gates just decide what shows in the rail.

import { CreditCardIcon, ReceiptTextIcon, StethoscopeIcon } from "@wso2/oxygen-ui-icons-react";
import { CC_PATH } from "@features/finance/cc/ccPaths";
import { expenseFinancePaths } from "@features/finance/expense/expenseFinancePaths";
import { opdFinancePaths } from "@features/finance/opd/opdFinancePaths";
import { isPreviewEnabled } from "@config/previewFeatures";
import type { MenuApp } from "@constants/appMenu";

/**
 * Claims — under **Me**. Filing and tracking your own is something every
 * employee does.
 */
export const ME_FINANCE_APPS: readonly MenuApp[] = [
  {
    // Approving moved to Finance → Claim approval: it is work done for other
    // people, and this menu is for what you do for yourself.
    //
    // One app where there were two. Expense and OPD claims are both things you
    // file for yourself and track, and their histories are the same shape, so
    // they are one entry with a tab each rather than four entries between them.
    // The forms differ enough that adding a claim asks which type first.
    key: "claims",
    name: "Claims",
    icon: ReceiptTextIcon,
    purpose: "Expense and OPD claims — file one and track what you have filed.",
    items: [
      { id: "claims", label: "Claims", desc: "Expense and OPD claims you have filed.", path: "/me/claims" },
    ],
  },
];

// Every item id across the three apps — lets the rail dispatch gating to
// useFinanceGate (each app's OWN backend roles) instead of the coarse
// people-app capabilities, regardless of which perspective section it's
// rendered under.
/**
 * Credit card — under **Finance**. Unlike claims, a corporate card is not
 * something everyone has, so the app is not part of the set every employee
 * needs; it sits with the other finance operations instead.
 */
export const FINANCE_PERSPECTIVE_APPS: readonly MenuApp[] = [
  // Held back as a whole: New Claim, Claim History and both Approvals stages
  // all disappear together, not one route at a time.
  ...(isPreviewEnabled("expenseClaims")
    ? ([{
    key: "expense",
    name: "Expense Claims",
    icon: ReceiptTextIcon,
    purpose: "File an expense claim, track the ones you submitted, and decide on the ones waiting on you.",
    items: [
      // New Claim carries its own flag on top of the app's: Me → Claims
      // already offers a new-claim flow, and showing a second entry point
      // under Finance before the two are reconciled would leave people with
      // two ways in and no way to tell which one they want. Spread in rather
      // than filtered out, so with the flag off the item does not exist at
      // all — the rail sections and favourites both derive from this list.
      // It is NOT the whole story: the Finance overview builds its tiles by
      // hand and asks `useFinanceGate` by item id, so that surface is gated
      // there too.
      ...(isPreviewEnabled("expenseSubmitter")
        ? [
            { id: "expense-new", label: "New Claim", desc: "File a new expense claim.", path: expenseFinancePaths.new },
          ]
        : []),
      { id: "expense-history", label: "Claim History", desc: "Claims you have submitted, and where each one has got to.", path: expenseFinancePaths.history },
      // Approving sits beside filing, where the source app's own sidebar keeps
      // it — and in its order, lead before finance, which is the order a claim
      // travels. Each entry stands on its own backend flag, so somebody holding
      // both sees both and somebody holding neither sees neither.
      {
        id: "expense-lead-approvals",
        label: "Lead Approvals",
        desc: "Expense claims from the people you lead, waiting on your decision.",
        requires: ["lead", "admin"],
        path: expenseFinancePaths.leadApprovals,
      },
      {
        id: "expense-finance-approvals",
        label: "Finance Approvals",
        desc: "Expense claims that passed their lead and are waiting on finance.",
        requires: ["lead", "admin"],
        path: expenseFinancePaths.financeApprovals,
      },
    ],
    }] as MenuApp[])
    : []),
  ...(isPreviewEnabled("opdClaims")
    ? ([{
    // OPD has been a tab under Me → Claims and nothing else, which is right for
    // filing your own but left the app with no front door of its own the way
    // Expense Claims has. Only Claim History lives here today; New Claim stays
    // under Me until the two are reconciled, so there is one way in and no
    // guessing which.
    key: "opd",
    name: "OPD Claims",
    icon: StethoscopeIcon,
    purpose: "Track the outpatient medical claims you have submitted.",
    // One screen today and it will not stay that way. Collapsing to a leaf now
    // would teach the wrong shape and make the item vanish as a concept the day
    // a second one lands.
    alwaysGroup: true,
    items: [
      {
        id: "opd-history",
        label: "Claim History",
        desc: "OPD claims you have submitted, and where each one has got to.",
        // Not a coarse capability: the OPD backend decides this, and refuses
        // the whole app to anyone holding neither of its roles. `requires` only
        // forces useFinanceGate to answer for the id — see its `opd-history`
        // case, which asks the OPD backend rather than people-app.
        requires: ["employee"],
        path: opdFinancePaths.history,
      },
    ],
    }] as MenuApp[])
    : []),
  {
    key: "cc",
    name: "Credit Card Expenses",
    icon: CreditCardIcon,
    purpose: "Reconcile and submit corporate credit-card transactions for approval.",
    items: [
      { id: "cc-dashboard", label: "Dashboard", desc: "Unsubmitted spend, how long it has been sitting, and what has been claimed.", path: `${CC_PATH}/dashboard` },
      { id: "cc-new", label: "Pending Submissions", desc: "Unsubmitted card transactions to categorise and submit.", path: `${CC_PATH}/new` },
      { id: "cc-pending", label: "Pending Approvals", desc: "Submissions awaiting approval.", path: `${CC_PATH}/pending` },
      { id: "cc-approve", label: "Approve Submissions", desc: "Review and approve your team's submitted card transactions.", requires: ["lead", "admin"], path: `${CC_PATH}/approve` },
      { id: "cc-history", label: "History", desc: "Your submitted past card transactions.", path: `${CC_PATH}/history` },
      { id: "cc-settings", label: "Settings", desc: "Upload and reconcile bank statements (finance).", requires: ["admin"], path: `${CC_PATH}/settings` },
    ],
  },
];

/** Every finance-domain app, wherever it is surfaced. */
export const FINANCE_APPS: readonly MenuApp[] = [
  ...ME_FINANCE_APPS,
  ...FINANCE_PERSPECTIVE_APPS,
];

export const FINANCE_ITEM_IDS: ReadonlySet<string> = new Set([
  ...FINANCE_APPS.flatMap((app) => app.items.map((it) => it.id)),
  // Claim approval is not an item of any one app — it spans two of them — so it
  // is named here rather than derived. Without it the rail would fall back to
  // the people-app capabilities, which have no word for "expense finance
  // approver" and would show the entry to the wrong people.
  "claim-approval",
]);

// Eyebrow descriptors for FinanceShell, derived from the registry above so the
// chip on every finance screen can't drift from the app's own name and icon.
function eyebrowFor(key: string): { icon: MenuApp["icon"]; label: string } {
  // No `!` here. An app can legitimately be absent from the registry — a
  // preview feature whose flag is off is not in the list at all — and this
  // runs at module load, so asserting would take the whole app down with a
  // TypeError before anything rendered, not just lose a chip.
  //
  // The fallback is never seen in practice: if an app is hidden, the screens
  // that wear its eyebrow are unreachable too.
  const app = FINANCE_APPS.find((a) => a.key === key);
  return app
    ? { icon: app.icon, label: app.name }
    : { icon: ReceiptTextIcon, label: "Finance" };
}

export const FINANCE_EYEBROW = {
  // Both claim forms wear the Claims eyebrow: they are two ways into one app
  // now, and their own titles say which type is being filed.
  claims: eyebrowFor("claims"),
  cc: eyebrowFor("cc"),
  // Literal rather than eyebrowFor(...): this app sits behind a preview
  // flag, and with it off the lookup would fall back to the generic
  // "Finance" chip — wrong for a route still reachable directly by URL.
  expense: { icon: ReceiptTextIcon, label: "Expense Claims" },
  opd: { icon: StethoscopeIcon, label: "OPD Claims" },
} as const;
