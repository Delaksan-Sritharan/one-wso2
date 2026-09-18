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
 * The rules behind New Claim, kept out of the component.
 *
 * Every one of these is decidable without a DOM — what a bill may cost, which
 * year a claim belongs to, whether a saved draft can be restored onto what is
 * already on screen. Ported from `pages/NewClaim.tsx` and
 * `components/form/ExpenseForm.tsx`, whose versions are tangled into a Formik
 * schema and a Redux-backed page and so were never testable on their own.
 */

import type { OpdTransaction } from "../opdTypes";

/** `ExpenseForm.tsx:213` — the Description field's limit. */
export const COMMENT_MAX = 100;

/**
 * Copy, verbatim from the source, gathered in one place.
 *
 * Kept here rather than inline so the screen and its tests quote the same
 * string: the port's earlier OPD screen reworded several of these, which made
 * it impossible to tell a deliberate change from a typo.
 */
export const OPD_COPY = {
  /** `pages/NewClaim.tsx:222-224` */
  emptyTitle: "Let's get started!",
  emptySubtitle: "Submit your OPD claim now",
  addFirstBill: "Add OPD Claim",
  restoreDraft: "Restore Draft",
  /** `ExpenseForm.tsx:197,264` */
  addDialogTitle: "Add OPD Claim",
  editDialogTitle: "Update OPD Claim",
  addConfirm: "Add",
  editConfirm: "Update",
  /** `ExpenseForm.tsx:138` */
  sameYear: "All transactions in a claim must belong to the same year.",
  /** `ExpenseForm.tsx:92` */
  amountPositive: "Amount must be greater than 0",
  required: "Required",
  /** `FileUploadArea.tsx:126` */
  badFileType: "Invalid file type. Please upload a JPG, PNG or PDF file",
  /** `pages/NewClaim.tsx` — the three confirmations and the draft outcomes. */
  draftDeletionTitle: "Draft Deletion Warning",
  draftDeletionBody:
    "Adding a new claim will delete your draft. Are you sure you want to proceed?",
  changeYearTitle: "Change Year Warning",
  changeYearBody: "Changing the year will delete current claim items. Do you want to proceed?",
  submitTitle: "Claim Submission Confirmation",
  draftMultiYear: "Draft contains transactions from multiple years. Restore aborted.",
  draftOtherYear:
    "Cannot restore draft: existing claim contains a different transaction year.",
  draftRestored: "Draft restored successfully",
} as const;

/** The four-digit year a bill's ISO date falls in (`NewClaim.tsx:80`). */
export function yearOf(isoDate: string): string {
  return isoDate.substring(0, 4);
}

/** What the bills on screen come to — the "Total Amount" row. */
export function billsTotal(items: OpdTransaction[]): number {
  return items.reduce((sum, it) => sum + it.amount, 0);
}

/**
 * The most a bill may be, given what is already claimed and listed.
 *
 * `ExpenseForm.tsx:75-87`. The subtlety is `editingIndex`: while a bill is
 * being corrected its own amount has not been spent, so counting it would
 * refuse the very value already in the field — edit a bill, change nothing,
 * press Update, and the form would reject itself.
 */
export function maxAllowedAmount(
  remaining: number,
  items: OpdTransaction[],
  editingIndex: number | null,
): number {
  const listed = items.reduce(
    (sum, it, i) => (editingIndex !== null && i === editingIndex ? sum : sum + it.amount),
    0,
  );
  return remaining - listed;
}

/** `ExpenseForm.tsx:98-101` — the cap in the message is written to 2dp. */
export function amountCapMessage(max: number): string {
  return `Amount cannot exceed available limit of ${max.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Whether a bill dated `isoDate` may join `items`.
 *
 * `ExpenseForm.tsx:129-144`. The date picker's bounds already steer this, but
 * the field is typeable, so the rule is enforced rather than implied — the
 * backend files a claim against ONE year's balance, and a claim spanning two
 * is mis-filed rather than refused (see `opd-claims.md` §7: which of the two
 * the backend does is unverified, so the frontend must not find out).
 *
 * The first bill decides the year; an empty list accepts anything.
 */
export function breaksSameYearRule(items: OpdTransaction[], isoDate: string): boolean {
  if (items.length === 0) return false;
  return yearOf(items[0].date) !== yearOf(isoDate);
}

/**
 * Why a saved draft cannot be restored, or null when it can.
 *
 * `NewClaim.tsx:79-100`, in its order: a draft spanning two years is refused
 * outright, and one whose year differs from bills already entered is refused
 * against those bills. Both are returned as the source's own wording.
 */
export function draftRestoreRefusal(
  draft: OpdTransaction[],
  items: OpdTransaction[],
): string | null {
  if (draft.length === 0) return null;
  const draftYear = yearOf(draft[0].date);
  if (!draft.every((it) => yearOf(it.date) === draftYear)) return OPD_COPY.draftMultiYear;
  if (items.length > 0 && yearOf(items[0].date) !== draftYear) return OPD_COPY.draftOtherYear;
  return null;
}

/**
 * How full the year's allowance is, for the progress bar.
 *
 * `ClaimOverviewer.tsx:38-40` divides claimed by the limit. Clamped here
 * because the source is not: a limit of 0 gives it `Infinity` and a bar that
 * renders off the end, and a corrected claim can leave claimed above the limit.
 */
export function spentPercent(claimed: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(100, Math.max(0, (claimed / limit) * 100));
}
