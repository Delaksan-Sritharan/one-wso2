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

import { afterEach, describe, expect, it } from "vitest";
import { isLocalAdminOverride } from "./localAdmin";

// This grants a permission rather than merely revealing an unfinished screen,
// so the guards are the point of the module and not an implementation detail.
// Every case below is one way the flag could otherwise escape a laptop.

function serveFrom(hostname: string): void {
  Object.defineProperty(window, "location", {
    value: { ...window.location, hostname },
    writable: true,
    configurable: true,
  });
}

const realLocation = window.location;

afterEach(() => {
  Object.defineProperty(window, "location", {
    value: realLocation,
    writable: true,
    configurable: true,
  });
  delete window.config?.ONE_WSO2_LOCAL_ADMIN;
});

describe("the local admin override", () => {
  it("grants admin on a developer's own machine when asked to", () => {
    serveFrom("localhost");
    window.config = { ...window.config, ONE_WSO2_LOCAL_ADMIN: true };
    expect(isLocalAdminOverride()).toBe(true);
  });

  it("grants nothing on a loopback host that never asked", () => {
    serveFrom("localhost");
    expect(isLocalAdminOverride()).toBe(false);
  });

  // THE guard. A `config.js` copied from a laptop onto a real deployment is
  // exactly how this would leak, and it is a plausible accident: the file is
  // gitignored, so it gets copied by hand.
  it("grants nothing off a loopback host, however the flag is set", () => {
    window.config = { ...window.config, ONE_WSO2_LOCAL_ADMIN: true };
    for (const host of [
      "one.wso2.com",
      "one-stg.wso2.com",
      // Not a loopback host, whatever it calls itself — a substring match on
      // "localhost" would have handed admin to whoever registered this.
      "localhost.evil.example.com",
      "notlocalhost",
    ]) {
      serveFrom(host);
      expect(isLocalAdminOverride(), `${host} was treated as local`).toBe(false);
    }
  });

  // `=== true`, so a string, a 1, or a stray truthy value does not open it.
  it("takes only a real boolean true", () => {
    serveFrom("localhost");
    for (const value of ["true", 1, {}, "yes"]) {
      window.config = {
        ...window.config,
        ONE_WSO2_LOCAL_ADMIN: value as unknown as boolean,
      };
      expect(isLocalAdminOverride(), `${String(value)} opened the override`).toBe(false);
    }
  });
});
