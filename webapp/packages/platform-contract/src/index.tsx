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

// The contract between the shell and its remotes. The shell implements every
// member and calls registerPlatform() once at boot; a remote calls the wrapper
// functions below and never imports shell internals. Module Federation shares
// this package as a singleton, so the shell and every remote see the same
// registry — that is what lets a remote use the shell's auth session, query
// cache and notifications instead of owning copies.
//
// Changing a member's signature is a breaking change for every remote: treat
// this file like a published library (see "Risks" in the architecture doc).

import type { ComponentType, ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { AlertColor, SxProps, Theme } from "@wso2/oxygen-ui";

export type SubState =
  | { status: "loading" }
  | { status: "ready"; sub: string }
  | { status: "error"; message: string };

export interface AsgardeoUser {
  ready: boolean;
  sub?: string;
  email?: string;
  givenName?: string;
  familyName?: string;
  displayName?: string;
  initials: string;
}

export interface UserInfoLite {
  id: number;
  employeeId: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  employeeThumbnail: string | null;
  designation: string | null;
  workLocation: string | null;
  privileges?: number[];
}

export interface ErrorNoticeProps {
  readonly children: ReactNode;
  readonly error?: unknown;
  readonly onRetry?: () => void;
  readonly retrying?: boolean;
  readonly severity?: AlertColor;
  readonly sx?: SxProps<Theme>;
}

export interface Platform {
  authedGet<T>(url: string, accessToken: string, extraHeaders?: Record<string, string>): Promise<T>;
  authedPatch<T>(
    url: string,
    accessToken: string,
    body: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<T | null>;
  describeError(err: unknown): string;
  httpRetry(failureCount: number, error: unknown): boolean;
  useAccessToken(): () => Promise<string>;
  useAsgardeoSub(): { state: SubState; retry: () => void };
  useAsgardeoUser(): AsgardeoUser;
  useUserInfo(): UseQueryResult<UserInfoLite, Error>;
  foldIdentityError<TData>(
    query: UseQueryResult<TData, Error>,
    identityState: SubState,
    retryIdentity: () => void,
  ): UseQueryResult<TData, Error>;
  useNotifications(): {
    showSuccess: (message: string) => void;
    showError: (message: string) => void;
    showWarning: (message: string) => void;
  };
  ErrorNotice: ComponentType<ErrorNoticeProps>;
}

let current: Platform | undefined;

/** Called once by the shell, before any remote renders. */
export function registerPlatform(platform: Platform): void {
  current = platform;
}

function platform(): Platform {
  if (!current) throw new Error("Platform not registered: the shell must call registerPlatform() before a remote renders.");
  return current;
}

export const authedGet: Platform["authedGet"] = (...a) => platform().authedGet(...a);
export const authedPatch: Platform["authedPatch"] = (...a) => platform().authedPatch(...a);
export const describeError: Platform["describeError"] = (...a) => platform().describeError(...a);
export const httpRetry: Platform["httpRetry"] = (...a) => platform().httpRetry(...a);
export const useAccessToken: Platform["useAccessToken"] = () => platform().useAccessToken();
export const useAsgardeoSub: Platform["useAsgardeoSub"] = () => platform().useAsgardeoSub();
export const useAsgardeoUser: Platform["useAsgardeoUser"] = () => platform().useAsgardeoUser();
export const useUserInfo: Platform["useUserInfo"] = () => platform().useUserInfo();
export const foldIdentityError: Platform["foldIdentityError"] = (...a) => platform().foldIdentityError(...a);
export const useNotifications: Platform["useNotifications"] = () => platform().useNotifications();
export const ErrorNotice: Platform["ErrorNotice"] = (props) => {
  const Impl = platform().ErrorNotice;
  return <Impl {...props} />;
};
