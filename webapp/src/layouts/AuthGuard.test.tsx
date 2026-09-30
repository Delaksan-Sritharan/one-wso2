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

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mutable so each test sets the SDK state it needs before rendering.
const auth = vi.hoisted(() => ({ isSignedIn: false, isLoading: false, signIn: vi.fn() }));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => auth }));

import AuthGuard from "./AuthGuard";
import { SIGN_IN_LOOP_WINDOW_MS, SIGN_IN_REDIRECT_KEY } from "./signInLoopGuard";

function renderAt(path = "/me") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AuthGuard />}>
          <Route path="/me" element={<div>the app</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

const redirectedAgo = (ms: number) => sessionStorage.setItem(SIGN_IN_REDIRECT_KEY, String(Date.now() - ms));

beforeEach(() => {
  sessionStorage.clear();
  auth.isSignedIn = false;
  auth.isLoading = false;
  auth.signIn.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("AuthGuard and the sign-in loop", () => {
  it("sends a signed-out user to sign in, and records that it did", () => {
    renderAt();

    expect(auth.signIn).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(SIGN_IN_REDIRECT_KEY)).not.toBeNull();
  });

  // THE loop: back from a sign-in moments ago and still signed out. Another
  // redirect would bounce straight back through a live SSO session, forever.
  it("does not redirect again when the user came back still signed out", () => {
    redirectedAgo(2_000);
    renderAt();

    expect(auth.signIn).not.toHaveBeenCalled();
    expect(screen.getByText(/couldn.t sign you in/i)).toBeInTheDocument();
  });

  it("signs in again only when the user asks", () => {
    redirectedAgo(2_000);
    renderAt();

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(auth.signIn).toHaveBeenCalledTimes(1);
  });

  it("redirects as usual once the last sign-in is outside the window", () => {
    redirectedAgo(SIGN_IN_LOOP_WINDOW_MS + 1_000);
    renderAt();

    expect(auth.signIn).toHaveBeenCalledTimes(1);
  });

  // Otherwise signing out soon after signing in would be refused its redirect.
  it("clears the record once signed in", () => {
    redirectedAgo(2_000);
    auth.isSignedIn = true;
    renderAt();

    expect(screen.getByText("the app")).toBeInTheDocument();
    expect(sessionStorage.getItem(SIGN_IN_REDIRECT_KEY)).toBeNull();
  });

  // The SDK is still exchanging the code on the returning page load. That is a
  // sign-in in progress, not a failed one.
  it("waits while the SDK is still loading instead of calling it a loop", () => {
    redirectedAgo(2_000);
    auth.isLoading = true;
    renderAt();

    expect(screen.queryByText(/couldn.t sign you in/i)).toBeNull();
    expect(auth.signIn).not.toHaveBeenCalled();
  });
});
