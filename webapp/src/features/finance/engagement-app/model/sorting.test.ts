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

import { describe, expect, it } from "vitest";
import { columnAccessors, sortRows } from "./sorting";

interface Row {
  readonly id: string;
  readonly name?: string;
  readonly amount?: number;
}

const rows: Row[] = [
  { id: "a", name: "banana", amount: 30 },
  { id: "b", name: "Apple", amount: 5 },
  { id: "c", amount: 12 },
  { id: "d", name: "cherry" },
  { id: "e", name: "apple2", amount: 5 },
];
const by = {
  name: (r: Row) => r.name,
  amount: (r: Row) => r.amount,
  id: (r: Row) => r.id,
};
const ids = (rs: readonly Row[]) => rs.map((r) => r.id).join("");

describe("sortRows", () => {
  it("keeps the order given for no key or an unknown one", () => {
    expect(ids(sortRows(rows, "", by))).toBe("abcde");
    expect(ids(sortRows(rows, "nothing", by))).toBe("abcde");
    expect(ids(sortRows(rows, "-nothing", by))).toBe("abcde");
  });

  it("sorts text without regard to case, ascending and descending", () => {
    expect(ids(sortRows(rows, "name", by))).toBe("beadc");
    expect(ids(sortRows(rows, "-name", by))).toBe("daebc");
  });

  it("compares numbers by value, keeps equal rows in their order and puts blanks last either way", () => {
    expect(ids(sortRows(rows, "amount", by))).toBe("becad");
    expect(ids(sortRows(rows, "-amount", by))).toBe("acbed");
  });

  it("reads digits inside text by value", () => {
    const list = [{ id: "E10" }, { id: "E2" }, { id: "E1" }];
    expect(sortRows(list, "id", by).map((r) => r.id)).toEqual(["E1", "E2", "E10"]);
  });

  it("does not change the list it is given", () => {
    const copy = [...rows];
    sortRows(rows, "-amount", by);
    expect(rows).toEqual(copy);
  });
});

describe("columnAccessors", () => {
  it("collects the columns that can sort a list held in the browser", () => {
    const get = columnAccessors<Row>([
      { sortKey: "name", sortValue: (r) => r.name },
      { sortKey: "server-only" },
      { sortValue: (r) => r.id },
    ]);
    expect(Object.keys(get)).toEqual(["name"]);
  });
});
