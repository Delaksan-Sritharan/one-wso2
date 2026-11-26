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
import { readableOn } from "./format";

describe("readableOn", () => {
  it("puts dark text on light fills and white on dark ones", () => {
    expect(readableOn("#f59e0b")).toBe("#111827");
    expect(readableOn("#84cc16")).toBe("#111827");
    expect(readableOn("#ffffff")).toBe("#111827");
    expect(readableOn("#1e3a8a")).toBe("#fff");
    expect(readableOn("#6d28d9")).toBe("#fff");
    expect(readableOn("#000000")).toBe("#fff");
  });

  it("keeps white for a colour it cannot read", () => {
    expect(readableOn("rebeccapurple")).toBe("#fff");
  });
});
