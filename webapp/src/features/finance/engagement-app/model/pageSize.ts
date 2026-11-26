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

import { useCallback, useState } from "react";

/** The rows-per-page choices every list offers. */
export const PAGE_SIZES: readonly number[] = [5, 10, 15, 25];
/** Rows per page on a list until the reader picks another size. */
export const LIST_PAGE_SIZE = 25;

const keyOf = (id: string) => `engagement-app.${id}.pageSize`;

/** The size kept in this browser for list `id`, or `fallback` when none is kept, storage is blocked or it holds a size we don't offer. */
export function readPageSize(id: string, fallback: number = LIST_PAGE_SIZE): number {
  try {
    const n = Number(localStorage.getItem(keyOf(id)));
    return PAGE_SIZES.includes(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

/** Keeps `size` for list `id`; a blocked storage (a private window) leaves the choice for this visit only. */
export function writePageSize(id: string, size: number): void {
  try {
    localStorage.setItem(keyOf(id), String(size));
  } catch {
    // Not kept.
  }
}

/** A list's rows per page, kept per list in this browser. */
export function usePageSize(id: string, fallback: number = LIST_PAGE_SIZE): [number, (size: number) => void] {
  const [size, setSize] = useState(() => readPageSize(id, fallback));
  const choose = useCallback(
    (next: number) => {
      setSize(next);
      writePageSize(id, next);
    },
    [id],
  );
  return [size, choose];
}
