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

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PersonTwo } from "./PersonChip";

const faces: Record<string, { photo?: string }> = { "a@wso2.com": { photo: "https://photos.test/a.png" } };
vi.mock("../api/usePeopleFaces", () => ({ usePeopleFaces: () => (email: string) => faces[email.toLowerCase()] ?? {} }));

describe("PersonTwo", () => {
  it("shows the directory photo beside the name and keeps the lines under it", () => {
    const { container } = render(<PersonTwo name="Ann Lee" email="a@wso2.com" sub={"a@wso2.com\nSri Lanka"} />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://photos.test/a.png");
    expect(screen.getByText("Ann Lee")).toBeTruthy();
    expect(screen.getByText(/Sri Lanka/)).toBeTruthy();
  });

  it("falls back to initials for someone not in the directory", () => {
    const { container } = render(<PersonTwo name="Bob Ray" email="b@agency.com" />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("BR")).toBeTruthy();
  });
});
