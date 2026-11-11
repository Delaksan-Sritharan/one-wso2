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

import { describe, expect, it } from "vitest";
import { CC_SNACK, ruleWording } from "./ccUiText";

// Behaviour tests don't catch a reworded message, so these pin each one word for word.
describe("card-expense success messages keep their wording", () => {
  it.each([
    ["updateCardLabel", "Successfully updated the label"],
    ["saveEdit", "Successfully saved the edited transaction"],
    ["uploadAttachment", "Successfully uploaded the attachment"],
    ["removeAttachment", "Successfully removed the attachment"],
    ["submitTransaction", "Successfully submitted the transaction"],
    ["approveSubmission", "Successfully approved the submission"],
    ["processBankStatement", "Successfully processed the bank statement"],
    ["uploadNewTransactions", "Successfully saved the new transactions"],
  ] as const)("%s", (key, expected) => {
    expect(CC_SNACK.success[key]).toBe(expected);
  });

  it("has no messages beyond these", () => {
    // A new message is added here too, so it's added deliberately.
    expect(Object.keys(CC_SNACK.success).sort()).toEqual([
      "approveSubmission",
      "processBankStatement",
      "removeAttachment",
      "saveEdit",
      "submitTransaction",
      "updateCardLabel",
      "uploadAttachment",
      "uploadNewTransactions",
    ]);
  });
});

// The backend says "tagging rule", and "auto tagging rule" for a system rule; the UI says neither.
describe("ruleWording", () => {
  it.each([
    [
      "A tagging rule with the same card, supplier and account has an overlapping amount range.",
      "A rule with the same card, supplier and account has an overlapping amount range.",
    ],
    [
      "An auto tagging rule can't be deleted. It can be deactivated instead.",
      "A system rule can't be deleted. It can be deactivated instead.",
    ],
    [
      "The card, supplier and account of an auto tagging rule can't be changed.",
      "The card, supplier and account of a system rule can't be changed.",
    ],
    ["Insufficient privileges to create an auto-tagging rule.", "Insufficient privileges to create a system rule."],
    ["Error retrieving the tagging rules.", "Error retrieving the rules."],
    ["Tagging rule not found.", "Rule not found."],
    ["Bad supplier.", "Bad supplier."],
  ])("rewords %j", (server, shown) => {
    expect(ruleWording(server)).toBe(shown);
  });
});
