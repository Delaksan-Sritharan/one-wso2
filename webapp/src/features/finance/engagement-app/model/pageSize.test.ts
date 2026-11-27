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

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LIST_PAGE_SIZE, PAGE_SIZES, readPageSize, usePageSize, writePageSize } from "./pageSize";

describe("page size", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("offers 5, 10, 15 and 25, and a list starts at 25", () => {
    expect(PAGE_SIZES).toEqual([5, 10, 15, 25]);
    expect(readPageSize("engagements")).toBe(LIST_PAGE_SIZE);
    expect(LIST_PAGE_SIZE).toBe(25);
  });

  it("keeps the choice per list", () => {
    writePageSize("engagements", 10);
    expect(readPageSize("engagements")).toBe(10);
    expect(readPageSize("invoices")).toBe(25);
    expect(localStorage.getItem("engagement-app.engagements.pageSize")).toBe("10");
  });

  it("ignores a size it does not offer and honours the list's own default", () => {
    localStorage.setItem("engagement-app.transactions.pageSize", "7");
    expect(readPageSize("transactions", 10)).toBe(10);
  });

  it("falls back to the default when storage is blocked, and still takes the choice for the visit", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { result } = renderHook(() => usePageSize("engagements"));
    expect(result.current[0]).toBe(25);
    act(() => result.current[1](5));
    expect(result.current[0]).toBe(5);
  });
});
