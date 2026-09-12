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

// The monthly opt-in / opt-out windows.
//
// Both are expressed as two DAYS OF THE MONTH, not dates, and either can wrap:
// the default opt-in window is day 25 → day 5, which spans a month boundary.
// Getting that wrap wrong is the one bug this file exists to prevent, so every
// function here is pure and takes `now` as an argument — no function below
// reads the clock. The page reads it once and passes it down, which is what
// makes these rules testable at all.
//
// These windows apply to SELF-SERVICE only. An admin acting on someone else's
// behalf bypasses them — the service says so explicitly ("Admins acting on
// behalf of another employee bypass the opt-in date window") — so the admin
// screen must not consult this file.

/**
 * Is `day` inside the window `[startDay, endDay]`?
 *
 * When `startDay <= endDay` the window sits inside one month and the test is an
 * ordinary range. When `startDay > endDay` the window wraps into the next month
 * and the test inverts to a union: on or after the start, OR on or before the
 * end.
 */
export function isWithinDayRange(startDay: number, endDay: number, day: number): boolean {
  return startDay <= endDay
    ? day >= startDay && day <= endDay
    : day >= startDay || day <= endDay;
}

/** The same test against a point in time, using the local day of the month. */
export function isWindowOpen(startDay: number, endDay: number, now: Date): boolean {
  return isWithinDayRange(startDay, endDay, now.getDate());
}

/**
 * The window as a sentence: "25 Sep to 5 Oct".
 *
 * A wrapping window names the NEXT month for its end day, which is the whole
 * point of spelling the months out — "25 to 5" alone reads as a typo.
 *
 * Replaces the original app's `calculateAvailabilityDates`, which built two
 * `Date`s and printed them through `toLocaleDateString()`. That produced
 * "9/25/2026" for a US locale and "25/09/2026" for a UK one, from a rule that
 * has no year in it at all — the window is the 25th of whatever month it is
 * now. Naming the day and month directly says the recurring rule rather than
 * one arbitrary instance of it.
 */
export function periodLabel(startDay: number, endDay: number, now: Date): string {
  const thisMonth = now.toLocaleString("en-US", { month: "short" });
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleString("en-US", {
    month: "short",
  });
  const endMonth = startDay <= endDay ? thisMonth : nextMonth;
  return `${startDay} ${thisMonth} to ${endDay} ${endMonth}`;
}

/**
 * Which window governs the next action for a given subscription state, and
 * whether it is open.
 *
 * Subscribed → the next thing you can do is opt OUT; not subscribed → opt IN.
 * Pairing the two decisions here keeps the caller from having to get the same
 * subscribed/not-subscribed branch right in three places (the button's enabled
 * state, its label, and the notice that explains the window).
 */
export interface ActionWindow {
  /** "opt in" or "opt out" — the action this window governs. */
  action: "opt in" | "opt out";
  open: boolean;
  /** The governing window, spelled out: "25 Sep to 5 Oct". */
  label: string;
  /** The OTHER window, for the confirmation dialog's "you can undo this
   *  between …" line. */
  reverseLabel: string;
}

export function actionWindow(
  meta: {
    optInStartDay: number;
    optInEndDay: number;
    optOutStartDay: number;
    optOutEndDay: number;
  },
  isSubscribed: boolean,
  now: Date,
): ActionWindow {
  const optIn = { start: meta.optInStartDay, end: meta.optInEndDay } as const;
  const optOut = { start: meta.optOutStartDay, end: meta.optOutEndDay } as const;
  const governing = isSubscribed ? optOut : optIn;
  const reverse = isSubscribed ? optIn : optOut;
  return {
    action: isSubscribed ? "opt out" : "opt in",
    open: isWindowOpen(governing.start, governing.end, now),
    label: periodLabel(governing.start, governing.end, now),
    reverseLabel: periodLabel(reverse.start, reverse.end, now),
  };
}
