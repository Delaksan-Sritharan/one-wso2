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
import type { Theme } from "@wso2/oxygen-ui";
import { progressBlue } from "./parProgressBlue";

const theme = (withRing: boolean) =>
  ({
    palette: { info: { main: "#0B1633" }, ...(withRing && { Button: { focusRing: "#1F4FFF" } }) },
    vars: {
      palette: {
        info: { main: "var(--oxygen-palette-info-main)" },
        ...(withRing && { Button: { focusRing: "var(--oxygen-palette-Button-focusRing)" } }),
      },
    },
  }) as unknown as Theme;

describe("progressBlue", () => {
  it("is the theme's focus-ring blue, following light and dark, with a calmer blue for light", () => {
    expect(progressBlue(theme(true))).toEqual({
      colour: "var(--oxygen-palette-Button-focusRing)",
      light: "#2C62B8",
    });
  });

  it("is the info colour in a theme without one", () => {
    expect(progressBlue(theme(false))).toEqual({ colour: "var(--oxygen-palette-info-main)", light: "#0B1633" });
  });
});
