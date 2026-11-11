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

import { fetchWithReauth, HttpError } from "@api/http";
import { leaveServiceUrls } from "@config/apiConfig";
import { saveBlob } from "@utils/saveFile";

const EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

// File extension (no dot) for a sick-note content type; "" when unknown.
// Media types are case-insensitive, so the lookup is too, and only the
// map's own keys count, never inherited ones such as "constructor".
export function extensionForContentType(type: string): string {
  const key = type.toLowerCase();
  return Object.hasOwn(EXTENSIONS, key) ? EXTENSIONS[key] : "";
}

// GET /leaves/{id}/sick-note and hand the bytes to the browser as a download.
export async function downloadSickNote(leaveId: number, accessToken: string): Promise<void> {
  const url = leaveServiceUrls.sickNote(leaveId);
  const res = await fetchWithReauth(url, { method: "GET" }, accessToken);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new HttpError(url, res.status, body);
  }
  const blob = await res.blob();
  // saveBlob saves any type it does not know as bare bytes, so a
  // server-influenced type is never rendered in our origin.
  const type = (res.headers.get("Content-Type") ?? blob.type).split(";")[0].trim();
  const ext = extensionForContentType(type);
  saveBlob(new Blob([blob], { type }), ext ? `sick-note-${leaveId}.${ext}` : `sick-note-${leaveId}`);
}
