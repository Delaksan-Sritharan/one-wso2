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
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PurchaseRequest } from "../../types";
import HandlingPanel from "./HandlingPanel";

const names = ["assign", "unassign", "priority", "addCollaborator", "removeCollaborator"] as const;
const mutations = vi.hoisted(() => ({ assign: vi.fn(), unassign: vi.fn(), priority: vi.fn(), addCollaborator: vi.fn(), removeCollaborator: vi.fn() }));
const resets = vi.hoisted(() => ({ assign: vi.fn(), unassign: vi.fn(), priority: vi.fn(), addCollaborator: vi.fn(), removeCollaborator: vi.fn() }));
const state = vi.hoisted(() => ({ team: {} as Record<string, unknown>, directory: {} as Record<string, unknown>, refetch: vi.fn() }));
const showSuccess = vi.hoisted(() => vi.fn());
vi.mock("@context/notifications/NotificationsContext", () => ({ useNotifications: () => ({ showSuccess }) }));
vi.mock("../../api/useProcurement", () => {
  const hook = (mutate: unknown, reset: unknown) => () => ({ mutate, reset, isPending: false, isError: false, error: null });
  return {
    useAssignRequest: hook(mutations.assign, resets.assign),
    useUnassignRequest: hook(mutations.unassign, resets.unassign),
    useSetPriority: hook(mutations.priority, resets.priority),
    useAddCollaborator: hook(mutations.addCollaborator, resets.addCollaborator),
    useRemoveCollaborator: hook(mutations.removeCollaborator, resets.removeCollaborator),
    useProcurementTeam: () => state.team,
    useDirectorySearch: () => state.directory,
  };
});

const person = (name: string, email: string) => ({ id: email, name, email });
const SAM = person("Sam Lee", "sam@example.com");
const TEAM = [person("Pat Kim", "pat@example.com"), SAM, person("Alex Morgan", "alex@example.com"), person("Lead", "lead@example.com"), person("Second", "second@example.com"), person("Robin Shaw", "robin@example.com")];
const loaded = (data: unknown) => ({ data, isLoading: false, isFetching: false, isError: false, error: null, refetch: state.refetch });

const request = (patch: Partial<PurchaseRequest>) =>
  ({
    id: "7",
    status: "approved",
    assignee: "",
    priority: null,
    collaborators: [],
    requester: { id: "alex@example.com", name: "Alex Morgan", email: "alex@example.com" },
    teamLead: { id: "lead@example.com", name: "Lead", email: "lead@example.com" },
    additionalApprovers: ["second@example.com"],
    ...patch,
  }) as PurchaseRequest;

beforeEach(() => {
  [...Object.values(mutations), ...Object.values(resets), state.refetch, showSuccess].forEach((m) => m.mockClear());
  // A saved action succeeds at once, so what the panel does on success can be seen.
  Object.values(mutations).forEach((m) => m.mockImplementation((_value: unknown, options?: { onSuccess?: () => void }) => options?.onSuccess?.()));
  state.team = loaded(TEAM);
  state.directory = loaded([]);
});

describe("HandlingPanel", () => {
  it("is titled Assignment and says whether the request is assigned", () => {
    const { rerender } = render(<HandlingPanel request={request({})} me="pat@example.com" />);
    expect(screen.getByRole("heading", { name: "Assignment" })).toBeInTheDocument();
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
    rerender(<HandlingPanel request={request({ status: "assigned", assignee: "sam@example.com" })} me="pat@example.com" />);
    expect(screen.getByText("Assigned")).toBeInTheDocument();
  });

  it("offers to assign an unassigned request to the user, and not to unassign it", async () => {
    render(<HandlingPanel request={request({})} me="pat@example.com" />);
    expect(screen.queryByRole("button", { name: "Unassign" })).toBeNull();
    await userEvent.setup().click(screen.getByRole("button", { name: "Assign to me" }));
    expect(mutations.assign).toHaveBeenCalledWith(undefined, expect.anything());
    expect(showSuccess).toHaveBeenCalledWith("You are now assigned to this request. The requester has been notified by email.");
  });

  it("offers to take over a request someone else handles, and to unassign it", async () => {
    const user = userEvent.setup();
    render(<HandlingPanel request={request({ status: "assigned", assignee: "sam@example.com" })} me="pat@example.com" />);
    await user.click(screen.getByRole("button", { name: "Take over" }));
    await user.click(screen.getByRole("button", { name: "Unassign" }));
    expect(mutations.assign).toHaveBeenCalledWith(undefined, expect.anything());
    expect(mutations.unassign).toHaveBeenCalled();
    // Only taking over says anything: unassigning is not followed by a message.
    expect(showSuccess).toHaveBeenCalledTimes(1);
  });

  it("does not offer a request the user already handles to themselves again", () => {
    render(<HandlingPanel request={request({ status: "assigned", assignee: "Pat@example.com" })} me="pat@example.com" />);
    expect(screen.queryByRole("button", { name: /Take over|Assign to me/ })).toBeNull();
  });

  it("assigns the person chosen as Assignee only when Assign is pressed, since assigning sends an email", async () => {
    const user = userEvent.setup();
    render(<HandlingPanel request={request({})} me="pat@example.com" />);
    expect(screen.getByRole("button", { name: "Assign" })).toBeDisabled();
    await user.click(screen.getByRole("combobox", { name: "Assignee" }));
    await user.click(await screen.findByRole("option", { name: "Sam Lee (sam@example.com)" }));
    expect(mutations.assign).not.toHaveBeenCalled();
    expect(screen.getByText("Sam Lee and the requester will be notified by email when you press Assign.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Assign" }));
    expect(mutations.assign).toHaveBeenCalledWith("sam@example.com", expect.anything());
    expect(showSuccess).toHaveBeenCalledWith("Request assigned to Sam Lee. An email notification has been sent to them and the requester.");
    expect(screen.getByRole("button", { name: "Assign" })).toBeDisabled();
  });

  it("names the priorities High, Medium and Normal, and sets one without a message", async () => {
    const user = userEvent.setup();
    render(<HandlingPanel request={request({})} me="pat@example.com" />);
    await user.click(screen.getByRole("combobox", { name: "Priority" }));
    expect((await screen.findAllByRole("option")).map((o) => o.textContent)).toEqual(["P1 — High", "P2 — Medium", "P3 — Normal"]);
    await user.click(screen.getByRole("option", { name: "P2 — Medium" }));
    expect(mutations.priority).toHaveBeenCalledWith("P2");
    expect(showSuccess).not.toHaveBeenCalled();
  });

  it("shows the current assignee, which does not need assigning again, and drops a pending choice when it is cleared", async () => {
    const user = userEvent.setup();
    render(<HandlingPanel request={request({ status: "assigned", assignee: "sam@example.com" })} me="pat@example.com" />);
    expect(screen.getByRole("combobox", { name: "Assignee" })).toHaveValue("Sam Lee (sam@example.com)");
    expect(screen.getByRole("button", { name: "Assign" })).toBeDisabled();
    await user.click(screen.getByRole("combobox", { name: "Assignee" }));
    await user.click(await screen.findByRole("option", { name: "Robin Shaw (robin@example.com)" }));
    expect(screen.getByRole("button", { name: "Assign" })).toBeEnabled();
    await user.click(screen.getByTitle("Clear"));
    expect(screen.getByRole("combobox", { name: "Assignee" })).toHaveValue("Sam Lee (sam@example.com)");
    expect(screen.getByRole("button", { name: "Assign" })).toBeDisabled();
    expect(mutations.assign).not.toHaveBeenCalled();
    expect(mutations.unassign).not.toHaveBeenCalled();
  });

  it("lists the team except the requester, the team lead and the approvers, whom the backend refuses", async () => {
    const user = userEvent.setup();
    render(<HandlingPanel request={request({})} me="robin@example.com" />);
    await user.click(screen.getByRole("combobox", { name: "Assignee" }));
    expect((await screen.findAllByRole("option")).map((o) => o.textContent)).toEqual(["Pat Kim (pat@example.com)", "Sam Lee (sam@example.com)", "Robin Shaw (robin@example.com)"]);
  });

  it("says when the team could not be loaded, offers a Retry, and leaves the other actions alone", async () => {
    state.team = { data: undefined, isLoading: false, isError: true, error: new Error("Team unavailable."), refetch: state.refetch };
    const user = userEvent.setup();
    render(<HandlingPanel request={request({})} me="pat@example.com" />);
    expect(screen.getByText(/Team unavailable\./)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Assignee" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(state.refetch).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Assign to me" }));
    expect(mutations.assign).toHaveBeenCalledWith(undefined, expect.anything());
  });

  it.each([["the requester", "alex@example.com"], ["the team lead", "lead@example.com"], ["an additional approver", "Second@example.com"]])(
    "offers no handling to %s, and says why",
    async (_who, me) => {
      render(<HandlingPanel request={request({ status: "assigned", assignee: "sam@example.com", collaborators: ["kim@example.com"] })} me={me} />);
      expect(screen.getByText(/you can't handle it/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Take over|Assign to me/ })).toBeNull();
      expect(screen.getByRole("button", { name: "Unassign" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Assign" })).toBeDisabled();
      expect(screen.getByRole("combobox", { name: "Assignee" })).toBeDisabled();
      expect(screen.getByRole("combobox", { name: "Priority" })).toHaveAttribute("aria-disabled", "true");
      expect(screen.getByRole("combobox", { name: "Collaborators" })).toBeDisabled();
    },
  );

  it("clears the other actions' messages when an action starts, so an old failure cannot hide a new one", async () => {
    const user = userEvent.setup();
    render(<HandlingPanel request={request({})} me="pat@example.com" />);
    await user.click(screen.getByRole("combobox", { name: "Priority" }));
    await user.click(await screen.findByRole("option", { name: "P1 — High" }));
    for (const name of names.filter((n) => n !== "priority")) expect(resets[name], name).toHaveBeenCalled();
    expect(resets.priority).not.toHaveBeenCalled();
  });
});

describe("HandlingPanel, collaborators", () => {
  it("shows the collaborators a request has, and takes one off", async () => {
    const user = userEvent.setup();
    render(<HandlingPanel request={request({ collaborators: ["kim@example.com", "jo@example.com"] })} me="pat@example.com" />);
    expect(screen.getByText("kim@example.com")).toBeInTheDocument();
    expect(screen.getByText("jo@example.com")).toBeInTheDocument();
    await user.click(screen.getAllByTestId("CancelIcon")[0]);
    expect(mutations.removeCollaborator).toHaveBeenCalledWith("kim@example.com", expect.anything());
    expect(showSuccess).toHaveBeenCalledWith("kim@example.com has been removed as a collaborator from this request.");
  });

  it("adds the person picked from the directory, and lists nobody until three characters are typed", async () => {
    state.directory = loaded([person("Drew Parker", "drew.parker@example.com")]);
    const user = userEvent.setup();
    render(<HandlingPanel request={request({})} me="pat@example.com" />);
    const field = screen.getByRole("combobox", { name: "Collaborators" });
    await user.type(field, "dr");
    expect(screen.queryByRole("listbox")).toBeNull();
    await user.type(field, "e");
    await user.click(await screen.findByRole("option", { name: "Drew Parker (drew.parker@example.com)" }));
    expect(mutations.addCollaborator).toHaveBeenCalledWith("drew.parker@example.com", expect.anything());
    expect(showSuccess).toHaveBeenCalledWith("drew.parker@example.com has been added as a collaborator on this request.");
  });

  it("offers no clear-all on the collaborators, so each is taken off one at a time", async () => {
    const user = userEvent.setup();
    render(<HandlingPanel request={request({ collaborators: ["kim@example.com", "jo@example.com"] })} me="pat@example.com" />);
    await user.click(screen.getByRole("combobox", { name: "Collaborators" }));
    expect(screen.queryByTitle("Clear")).toBeNull();
    expect(screen.getAllByTestId("CancelIcon")).toHaveLength(2);
    await user.click(screen.getAllByTestId("CancelIcon")[1]);
    expect(mutations.removeCollaborator).toHaveBeenCalledTimes(1);
    expect(mutations.removeCollaborator).toHaveBeenCalledWith("jo@example.com", expect.anything());
  });

  it("stops offering people once the request has twenty collaborators", async () => {
    state.directory = loaded([person("Drew Parker", "drew.parker@example.com")]);
    const user = userEvent.setup();
    const twenty = Array.from({ length: 20 }, (_, i) => `c${i}@example.com`);
    render(<HandlingPanel request={request({ collaborators: twenty })} me="pat@example.com" />);
    await user.type(screen.getByRole("combobox", { name: "Collaborators" }), "dre");
    expect(await screen.findByRole("option", { name: "Drew Parker (drew.parker@example.com)" })).toHaveAttribute("aria-disabled", "true");
  });
});
