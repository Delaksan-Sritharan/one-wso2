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

import { useState } from "react";
import type { Column, TableSort } from "../components/EaTable";
import { columnAccessors, sortRows } from "./sorting";

/** A list held whole in the browser, sorted by the clicked column: the rows to show and the `sorting` a table takes. */
export function useSortedRows<T>(rows: readonly T[], columns: readonly Column<T>[]): { rows: T[]; sorting: TableSort } {
  const [sort, setSort] = useState("");
  return { rows: sortRows(rows, sort, columnAccessors(columns)), sorting: { sort, onSort: setSort } };
}
