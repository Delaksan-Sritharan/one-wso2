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
import { AUTH_ORIGINS_ENV, buildCsp, parseAuthOrigins } from "@config/csp";

// The policy ships as a <meta> tag on the production build only, so these are
// the only checks that run before a browser sees it.
const directive = (csp: string, name: string): string => {
  const found = csp.split("; ").find((part) => part.startsWith(`${name} `));
  if (!found) throw new Error(`no ${name} directive`);
  return found.slice(name.length + 1);
};

describe("buildCsp: default allowlist", () => {
  it("lets the sign-in SDK reach and frame Asgardeo", () => {
    const csp = buildCsp();
    expect(directive(csp, "connect-src")).toContain("https://*.asgardeo.io");
    expect(directive(csp, "frame-src")).toContain("https://*.asgardeo.io");
  });

  // A wso2.com-hosted IdP discovers fine through connect-src but was not
  // allowed to frame, so silent sign-in failed while every other call worked.
  it("frames wso2.com wherever it already connects", () => {
    const csp = buildCsp();
    expect(directive(csp, "connect-src")).toContain("https://*.wso2.com");
    expect(directive(csp, "frame-src")).toContain("https://*.wso2.com");
  });

  // Amplify post cards show the campaign image from LinkedIn's media CDN.
  it("loads LinkedIn post images from media.licdn.com only", () => {
    const csp = buildCsp();
    const linkedInImageSources = directive(csp, "img-src").split(" ").filter((source) => source.includes("licdn"));
    expect(linkedInImageSources).toEqual(["https://media.licdn.com"]);
    expect(directive(csp, "connect-src")).not.toContain("licdn.com");
  });
});

describe("buildCsp: extra sign-in origins", () => {
  it("adds each origin to connect-src and frame-src, and nowhere else", () => {
    const csp = buildCsp(["https://id.internal.example.com"]);
    expect(directive(csp, "connect-src")).toContain("https://id.internal.example.com");
    expect(directive(csp, "frame-src")).toContain("https://id.internal.example.com");
    expect(directive(csp, "media-src")).not.toContain("id.internal.example.com");
    expect(directive(csp, "img-src")).not.toContain("id.internal.example.com");
  });

  it("keeps a non-default port, which a wso2.com wildcard would not cover", () => {
    const csp = buildCsp(["https://id.example.com:9443"]);
    expect(directive(csp, "frame-src")).toContain("https://id.example.com:9443");
  });

  it("adds an origin once even when listed twice", () => {
    const csp = buildCsp(["https://id.example.com", "https://id.example.com"]);
    expect(directive(csp, "frame-src").match(/id\.example\.com/g)).toHaveLength(1);
  });
});

describe("parseAuthOrigins", () => {
  it("returns nothing when the variable is unset or empty", () => {
    expect(parseAuthOrigins(undefined)).toEqual([]);
    expect(parseAuthOrigins("  ")).toEqual([]);
  });

  it("splits, trims and de-duplicates the list", () => {
    expect(parseAuthOrigins(" https://a.example.com , https://b.example.com:8443 ,https://a.example.com")).toEqual([
      "https://a.example.com",
      "https://b.example.com:8443",
    ]);
  });

  // A bad value must stop the build: silently dropping it ships a policy that
  // breaks sign-in, and silently widening it ships a hole.
  it.each([
    ["plain http", "http://id.example.com"],
    ["a wildcard", "https://*.example.com"],
    ["a path", "https://id.example.com/oauth2"],
    ["a bare host", "id.example.com"],
    ["a trailing slash", "https://id.example.com/"],
    ["a scheme-less port", "id.example.com:9443"],
  ])("rejects %s", (_label, value) => {
    expect(() => parseAuthOrigins(value)).toThrow(AUTH_ORIGINS_ENV);
  });
});
