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

import { useEffect, useState } from "react";

/** How long a response may take before a skeleton or indicator is worth showing: a quicker one would only blink. */
export const SKELETON_DELAY_MS = 150;

/** True once `active` has been true for `ms`. A response that comes sooner never shows the indicator. */
export function useAfterDelay(active: boolean, ms: number = SKELETON_DELAY_MS): boolean {
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setLate(true), ms);
    return () => {
      clearTimeout(t);
      setLate(false);
    };
  }, [active, ms]);
  return active && late;
}
