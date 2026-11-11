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

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

const fetchWithReauth = vi.fn();
vi.mock("@api/http", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@api/http")>()),
  fetchWithReauth: (...a: unknown[]) => fetchWithReauth(...a),
}));
vi.mock("@config/apiConfig", () => ({
  leaveServiceUrls: { sickNote: (id: number) => `https://leave.test/leaves/${id}/sick-note` },
}));

const { describeError } = await import("@api/errors");
const { HttpError } = await import("@api/http");
const { downloadSickNote, extensionForContentType } = await import("./sickNoteDownload");

describe("extensionForContentType", () => {
  it("maps the three accepted types and nothing else", () => {
    expect(extensionForContentType("application/pdf")).toBe("pdf");
    expect(extensionForContentType("image/jpeg")).toBe("jpg");
    expect(extensionForContentType("image/png")).toBe("png");
    expect(extensionForContentType("Application/PDF")).toBe("pdf");
    expect(extensionForContentType("text/html")).toBe("");
    expect(extensionForContentType("constructor")).toBe("");
    expect(extensionForContentType("__proto__")).toBe("");
    expect(extensionForContentType("")).toBe("");
  });
});

describe("downloadSickNote", () => {
  let click: Mock;
  let downloadName: string | undefined;
  beforeEach(() => {
    vi.useFakeTimers();
    fetchWithReauth.mockReset();
    URL.createObjectURL = vi.fn(() => "blob:note");
    URL.revokeObjectURL = vi.fn();
    downloadName = undefined;
    click = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloadName = this.download;
      click();
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("saves the bytes as sick-note-<id>.<ext> and revokes the URL only after a delay", async () => {
    fetchWithReauth.mockResolvedValue(
      new Response(new Blob(["%PDF"], { type: "application/pdf" }), {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      }),
    );
    await downloadSickNote(12, "tok");

    expect(fetchWithReauth).toHaveBeenCalledWith("https://leave.test/leaves/12/sick-note", { method: "GET" }, "tok");
    expect(click).toHaveBeenCalledTimes(1);
    expect(downloadName).toBe("sick-note-12.pdf");
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:note");
  });

  it("saves an unexpected type as bare bytes with no extension", async () => {
    fetchWithReauth.mockResolvedValue(
      new Response(new Blob(["<script>alert(1)</script>"], { type: "text/html" }), {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }),
    );
    await downloadSickNote(5, "tok");

    expect(downloadName).toBe("sick-note-5");
    expect((URL.createObjectURL as Mock).mock.calls[0][0].type).toBe("application/octet-stream");
  });

  it("throws an HttpError whose message is the body's on a non-OK response", async () => {
    fetchWithReauth.mockResolvedValue(
      new Response(JSON.stringify({ message: "Sick note was deleted" }), { status: 404 }),
    );
    const err = await downloadSickNote(1, "tok").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as InstanceType<typeof HttpError>).status).toBe(404);
    expect(describeError(err)).toBe("Sick note was deleted");
    expect(click).not.toHaveBeenCalled();
  });

  it("gives the status when the body has no message", async () => {
    fetchWithReauth.mockResolvedValue(new Response("boom", { status: 500 }));
    const err = await downloadSickNote(1, "tok").catch((e: unknown) => e);
    expect(describeError(err)).toBe("Something went wrong (HTTP 500).");
  });
});
