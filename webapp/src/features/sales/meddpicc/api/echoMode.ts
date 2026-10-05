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

// Whether the MEDDPICC screens talk to echo-backend or to the demo fixtures.
//
// Demo mode is on when ONE_WSO2_ECHO_BACKEND_URL is blank, or when the page was
// opened with `?echoMock=1` (contract §4). The query flag is remembered for the
// tab: the Sales screens navigate between themselves with plain links, which
// drop the query string, and a demo that switched to live data on its second
// click would be a demo of something else. `?echoMock=0` turns it back off.

import { isEchoBackendConfigured } from "@config/apiConfig";

const STORAGE_KEY = "one-wso2.sales.echoMock";

function readQueryFlag(): "on" | "off" | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("echoMock");
  if (value === "1" || value === "true") return "on";
  if (value === "0" || value === "false") return "off";
  return null;
}

/** Every storage call is guarded: a private window or blocked storage must not break the page. */
function remembered(): boolean {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function remember(on: boolean): void {
  try {
    if (on) window.sessionStorage.setItem(STORAGE_KEY, "1");
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Not remembered; the flag still applies to this page load.
  }
}

/** True when the MEDDPICC hooks serve fixtures instead of calling the backend. */
export function isEchoMockMode(): boolean {
  if (!isEchoBackendConfigured()) return true;
  const flag = readQueryFlag();
  if (flag !== null) {
    remember(flag === "on");
    return flag === "on";
  }
  return remembered();
}
