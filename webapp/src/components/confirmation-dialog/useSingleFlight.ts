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

import { useRef } from "react";

/**
 * Guards a `ConfirmationDialog`'s `confirmAction` (or any other fire-and-
 * forget action a dialog hands off without awaiting) against a double
 * submit. `ConfirmationDialog` closes synchronously the instant Confirm is
 * clicked, before the mutation it kicked off has resolved, so nothing in the
 * dialog itself can disable a second click — a quick second press has to be
 * refused by the caller instead. `run` refuses a second call while the first
 * is still in flight, and always clears the guard afterward, success or not.
 *
 * Same `useRef` pending-flag pattern `BankAccountRequestDialog` already uses
 * for its own submit button, pulled out here once several call sites across
 * this app's admin actions (Approve, Reject, Deactivate, Resign, threshold
 * Update, Add Bank) started repeating it by hand.
 */
export function useSingleFlight() {
  const inFlight = useRef(false);

  return function run(action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    void action().finally(() => {
      inFlight.current = false;
    });
  };
}
