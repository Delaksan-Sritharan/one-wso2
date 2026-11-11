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

import { afterEach, describe, expect, it } from "vitest";
import { isPreviewEnabled } from "./previewFeatures";

const original = window.config;

function setFlags(flags: Record<string, boolean | undefined> | undefined) {
  window.config = {
    ...(original ?? {}),
    ONE_WSO2_PREVIEW_FEATURES: flags,
  } as Window["config"];
}

afterEach(() => {
  window.config = original;
});

describe("isPreviewEnabled", () => {
  // A deployment that names nothing shows nothing: prod is safe because nobody
  // wrote `amplify: true`, not because someone remembered `false`.
  it("is off when the deployment lists no features", () => {
    setFlags(undefined);
    expect(isPreviewEnabled("amplify")).toBe(false);
  });

  it("is off unless the flag is exactly true", () => {
    setFlags({ amplify: undefined });
    expect(isPreviewEnabled("amplify")).toBe(false);
  });

  // `amplify` is a preview key like the others: off unless the deployment sets it.
  it("turns Amplify on when the deployment sets it", () => {
    setFlags({ amplify: true });
    expect(isPreviewEnabled("amplify")).toBe(true);
  });

  it("keeps the flags independent of each other", () => {
    setFlags({ amplify: true, nda: false });
    expect(isPreviewEnabled("amplify")).toBe(true);
    expect(isPreviewEnabled("nda")).toBe(false);
  });
});
