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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// PAR is behind a preview flag, so the registry depends on `window.config` and
// has to be imported fresh per state rather than once at the top of the file.
async function load(preview: { par?: boolean } = {}) {
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

describe("PAR's People Ops rail entry", () => {
  it("is there once staging switches the flag on", async () => {
    const { PEOPLE_OPS_SECTIONS } = await load({ par: true });
    expect(PEOPLE_OPS_SECTIONS.map((s) => s.id)).toContain("people-par");
  });

  it("is gone when the flag is off", async () => {
    const { PEOPLE_OPS_SECTIONS } = await load({ par: false });
    expect(PEOPLE_OPS_SECTIONS.map((s) => s.id)).not.toContain("people-par");
  });

  // Production sets no preview config at all — absent has to mean off, or the
  // feature ships itself the day it merges.
  it("is gone when nothing is configured", async () => {
    const { PEOPLE_OPS_SECTIONS } = await load();
    expect(PEOPLE_OPS_SECTIONS.map((s) => s.id)).not.toContain("people-par");
  });

  it("leaves the sections that are not gated alone", async () => {
    const { PEOPLE_OPS_SECTIONS } = await load();
    expect(PEOPLE_OPS_SECTIONS.map((s) => s.id)).toContain("people-org-chart");
  });
});
