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

import { describe, expect, it, vi } from "vitest";
import { fileToBase64 } from "./fileToBase64";

const decode = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

describe("fileToBase64", () => {
  it("encodes binary bytes, not text, with no data URL prefix", async () => {
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x00, 0xff, 0x80]);
    const text = await fileToBase64(new File([bytes], "note.pdf", { type: "application/pdf" }));
    expect(text).toBe("JVBERi0A/4A=");
    expect(decode(text)).toEqual(bytes);
  });

  it("encodes an empty file as empty text", async () => {
    expect(await fileToBase64(new File([], "empty.pdf"))).toBe("");
  });

  it("rejects when the file can't be read, so the submit shows an error", async () => {
    const failingReader = (error: DOMException | null) =>
      class {
        error = error;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        readAsDataURL() {
          queueMicrotask(() => this.onerror?.());
        }
      };
    try {
      const readError = new DOMException("The file was moved.", "NotReadableError");
      vi.stubGlobal("FileReader", failingReader(readError));
      await expect(fileToBase64(new Blob(["x"]))).rejects.toBe(readError);
      vi.stubGlobal("FileReader", failingReader(null));
      await expect(fileToBase64(new Blob(["x"]))).rejects.toThrow("The file could not be read.");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("round-trips a file larger than one chunk, every byte value included", async () => {
    const bytes = new Uint8Array(100_003).map((_, i) => (i * 7) % 256);
    const text = await fileToBase64(new Blob([bytes]));
    expect(decode(text)).toEqual(bytes);
  });
});
