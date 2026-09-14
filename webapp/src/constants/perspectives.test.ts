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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * UMT is behind a preview flag, so the registry is no longer a constant — it
 * depends on `window.config`. Everything here therefore imports it fresh per
 * state rather than at the top of the file.
 */
type Perspectives = typeof import("./perspectives");

async function load(preview: { umt?: boolean } = {}): Promise<Perspectives> {
  vi.resetModules();
  window.config = {
    ...(window.config ?? {}),
    ONE_WSO2_PREVIEW_FEATURES: preview,
  } as Window["config"];
  return import("./perspectives");
}

const originalConfig = window.config;
beforeEach(() => vi.resetModules());
afterEach(() => {
  window.config = originalConfig;
});

const keys = (perspectives: readonly { key: string }[]) => perspectives.map((p) => p.key);

describe("the UMT perspective", () => {
  it("is absent from the registry when the preview flag is off", async () => {
    const { PERSPECTIVES, FUNCTIONAL_PERSPECTIVES, reachablePerspectives } = await load({
      umt: false,
    });
    expect(keys(PERSPECTIVES)).not.toContain("umt");
    expect(keys(FUNCTIONAL_PERSPECTIVES)).not.toContain("umt");
    expect(keys(reachablePerspectives())).not.toContain("umt");
  });

  it("is absent on an absent flag, not only on an explicit false", async () => {
    // Production ships no entry at all; safety must not depend on remembering
    // to write `false`.
    const { PERSPECTIVES } = await load();
    expect(keys(PERSPECTIVES)).not.toContain("umt");
  });

  it("is present, built and routable, when the preview flag is on", async () => {
    const { PERSPECTIVES, reachablePerspectives, findPerspectiveByKey, findPerspectiveByPath } =
      await load({ umt: true });
    expect(keys(PERSPECTIVES)).toContain("umt");
    expect(keys(reachablePerspectives())).toContain("umt");
    expect(findPerspectiveByKey("umt")?.path).toBe("/umt");
    expect(findPerspectiveByPath("/umt")?.key).toBe("umt");
  });

  it("does not disturb the other perspectives whatever the flag says", async () => {
    for (const preview of [{}, { umt: true }]) {
      const { PERSPECTIVES } = await load(preview);
      expect(keys(PERSPECTIVES)).toEqual(
        expect.arrayContaining(["people", "finance", "legal", "csm", "marketing", "me"]),
      );
    }
  });
});
