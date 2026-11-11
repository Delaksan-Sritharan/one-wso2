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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import { describe, expect, it, vi } from "vitest";

const backend = vi.hoisted(() => ({ url: "" }));
vi.mock("@config/apiConfig", () => ({
  get infraBackendUrl() {
    return backend.url;
  },
}));

const { isLocalInfraBackend, infraLocalAssertionHeaders } = await import("./infraLocalBackend");

describe("isLocalInfraBackend", () => {
  it("accepts http://localhost with a port", () => {
    expect(isLocalInfraBackend("http://localhost:8090")).toBe(true);
  });

  it("rejects remote hosts", () => {
    expect(isLocalInfraBackend("https://infra.example.com")).toBe(false);
  });

  it("rejects localhost lookalike hosts", () => {
    expect(isLocalInfraBackend("http://localhost.example.com")).toBe(false);
  });

  it("rejects empty or invalid URLs", () => {
    expect(isLocalInfraBackend("")).toBe(false);
    expect(isLocalInfraBackend("not-a-url")).toBe(false);
  });
});

describe("infraLocalAssertionHeaders", () => {
  it("attaches x-jwt-assertion for http://localhost", () => {
    backend.url = "http://localhost:8090";
    expect(infraLocalAssertionHeaders("id-token")).toEqual({
      "x-jwt-assertion": "id-token",
    });
  });

  it("omits the header for a localhost lookalike host", () => {
    backend.url = "http://localhost.example.com";
    expect(infraLocalAssertionHeaders("id-token")).toBeUndefined();
  });

  it("omits the header for remote hosts", () => {
    backend.url = "https://infra.example.com";
    expect(infraLocalAssertionHeaders("id-token")).toBeUndefined();
  });
});
