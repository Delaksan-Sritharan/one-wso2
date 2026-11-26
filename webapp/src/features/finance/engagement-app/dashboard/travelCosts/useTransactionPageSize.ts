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

import { usePageSize } from "../../model/pageSize";
import { TRANSACTIONS_DEFAULT_PAGE_SIZE } from "./costView";

/** Rows per page in the Transactions widget, kept in this browser. Starts at 10, and falls back to 10 when storage is blocked or holds something else. */
export function useTransactionPageSize(): [number, (size: number) => void] {
  return usePageSize("transactions", TRANSACTIONS_DEFAULT_PAGE_SIZE);
}
