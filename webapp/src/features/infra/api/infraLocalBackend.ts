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

import { useIdToken } from "@hooks/useIdToken";
import { infraBackendUrl } from "@config/apiConfig";

/** True only for http://localhost[...], not lookalike hosts. */
export function isLocalInfraBackend(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" && parsed.hostname === "localhost";
  } catch {
    return false;
  }
}

export function infraLocalAssertionHeaders(idToken: string) {
  return isLocalInfraBackend(infraBackendUrl)
    ? { "x-jwt-assertion": idToken }
    : undefined;
}

export function useInfraLocalHeaders() {
  const getIdToken = useIdToken();
  return async () => {
    if (!isLocalInfraBackend(infraBackendUrl)) return undefined;
    return infraLocalAssertionHeaders(await getIdToken());
  };
}
