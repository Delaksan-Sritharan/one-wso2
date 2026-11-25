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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PurchaseRequest } from "../types";
import TeamLeadEdit from "./TeamLeadEdit";

const change = vi.hoisted(() => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, isError: false, error: null as unknown }));
const showSuccess = vi.hoisted(() => vi.fn());
const directory = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("@context/notifications/NotificationsContext", () => ({ useNotifications: () => ({ showSuccess }) }));
vi.mock("../api/useProcurement", () => ({
  useChangeTeamLead: () => change,
  useDirectorySearch: () => directory.value,
}));

const person = (name: string, email: string) => ({ id: email, name, email });
const request = (patch: Partial<PurchaseRequest> = {}): PurchaseRequest =>
  ({
    id: "7",
    status: "submitted",
    requester: person("Me Myself", "me@example.com"),
    teamLead: person("Lee Lead", "lead@example.com"),
    additionalApprovers: ["second@example.com"],
    teamLeadDecision: { decision: "pending", notes: "", decidedAt: null, decidedBy: "", isOverride: false },
    ...patch,
  }) as PurchaseRequest;

beforeEach(() => {
  change.mutate.mockReset().mockImplementation((_value: unknown, options?: { onSuccess?: () => void }) => options?.onSuccess?.());
  change.reset.mockReset();
  showSuccess.mockReset();
  change.isPending = false;
  change.isError = false;
  change.error = null;
  directory.value = {
    data: [person("Drew Parker", "drew.parker@example.com"), person("Lee Lead", "lead@example.com"), person("Second Lead", "second@example.com"), person("Me Myself", "me@example.com")],
    isFetching: false,
    isError: false,
    error: null,
  };
});

const open = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: "Change team lead" }));
  return screen.getByRole("dialog", { name: "Change team lead" });
};

describe("TeamLeadEdit", () => {
  it("is a pencil for the requester of a request that waits for its first decision", () => {
    render(<TeamLeadEdit request={request()} me="Me@example.com" />);
    expect(screen.getByRole("button", { name: "Change team lead" })).toBeInTheDocument();
  });

  it.each([
    ["someone who is not the requester", { me: "lead@example.com", patch: {} }],
    ["a request already decided", { me: "me@example.com", patch: { status: "approved" as const, teamLeadDecision: { decision: "approved" as const, notes: "", decidedAt: "2026-11-01T00:00:00Z", decidedBy: "lead@example.com", isOverride: false } } }],
    ["a rejected request", { me: "me@example.com", patch: { status: "rejected" as const } }],
    ["a draft", { me: "me@example.com", patch: { status: "draft" as const } }],
  ])("is not offered for %s", (_what, { me, patch }) => {
    render(<TeamLeadEdit request={request(patch)} me={me} />);
    expect(screen.queryByRole("button", { name: "Change team lead" })).toBeNull();
  });

  it("says who has the request, and offers nothing to save until a team lead is picked", async () => {
    const user = userEvent.setup();
    render(<TeamLeadEdit request={request()} me="me@example.com" />);
    const dialog = await open(user);
    expect(within(dialog).getByText(/The request is with Lee Lead \(lead@example\.com\)/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Save team lead" })).toBeDisabled();
  });

  it("offers the leads found, without the ones the backend refuses: the requester, the current lead and the approvers", async () => {
    const user = userEvent.setup();
    render(<TeamLeadEdit request={request()} me="me@example.com" />);
    await open(user);
    await user.type(screen.getByRole("combobox", { name: "New team lead" }), "lea");
    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(4);
    const enabled = options.filter((o) => o.getAttribute("aria-disabled") !== "true").map((o) => o.textContent);
    expect(enabled).toEqual(["Drew Parker (drew.parker@example.com)"]);
  });

  it("saves the person picked only on Save, tells who is emailed, closes, and reports it", async () => {
    const user = userEvent.setup();
    render(<TeamLeadEdit request={request()} me="me@example.com" />);
    const dialog = await open(user);
    await user.type(screen.getByRole("combobox", { name: "New team lead" }), "dre");
    await user.click(await screen.findByRole("option", { name: "Drew Parker (drew.parker@example.com)" }));
    expect(change.mutate).not.toHaveBeenCalled();
    expect(within(dialog).getByText("Lee Lead and Drew Parker will be notified by email when you save.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Save team lead" }));
    expect(change.mutate).toHaveBeenCalledWith("drew.parker@example.com", expect.anything());
    expect(showSuccess).toHaveBeenCalledWith("Team lead changed to Drew Parker. Both team leads have been notified by email.");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on Cancel without saving", async () => {
    const user = userEvent.setup();
    render(<TeamLeadEdit request={request()} me="me@example.com" />);
    const dialog = await open(user);
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(change.mutate).not.toHaveBeenCalled();
  });

  it("keeps the pop-up open and shows what the backend said when saving fails, such as a request that was decided meanwhile", async () => {
    change.mutate.mockReset();
    change.isError = true;
    change.error = new Error("The request no longer waits for a decision.");
    const user = userEvent.setup();
    render(<TeamLeadEdit request={request()} me="me@example.com" />);
    const dialog = await open(user);
    expect(within(dialog).getByText("The request no longer waits for a decision.")).toBeInTheDocument();
  });
});
