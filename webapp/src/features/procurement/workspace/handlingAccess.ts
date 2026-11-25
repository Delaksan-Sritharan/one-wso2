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


import type { PurchaseRequest } from "../types";

/** The people the backend does not let handle a request: its requester, its team lead and its additional approvers. */
export function refusedEmails(request: PurchaseRequest): Set<string> {
  return new Set([request.requester.email, request.teamLead?.email ?? "", ...request.additionalApprovers].map((email) => email.toLowerCase()));
}

export function raisedOrApproves(request: PurchaseRequest, email: string): boolean {
  return refusedEmails(request).has(email.toLowerCase());
}
