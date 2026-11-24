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
import { MemoryRouter, Route, Routes } from "react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { QueueItem } from "../../types";
import TeamQueuePage from "./TeamQueuePage";

const row = (id: string, patch: Partial<QueueItem> = {}): QueueItem => ({
  id,
  reference: `PR-2026-0000${id}`,
  title: `Title ${id}`,
  category: "NON-IT",
  status: "approved",
  priority: null,
  assignee: "",
  requester: { id: "alex@example.com", name: "Alex Morgan", email: "alex@example.com" },
  updatedAt: "2026-10-28T09:12:00.000Z",
  ...patch,
});

const asked = vi.hoisted(() => vi.fn());
vi.mock("../../api/useProcurement", () => ({
  useTeamQueue: (filter: unknown) => {
    asked(filter);
    return {
      data: [
        row("1"),
        row("2", { status: "assigned", priority: "P1", assignee: "pat@example.com" }),
        row("3", { status: "assigned", priority: "P3", assignee: "sam@example.com" }),
      ],
      isPending: false,
      isError: false,
    };
  },
  useProcurementMe: () => ({ data: { email: "Pat@example.com" }, isPending: false, isError: false }),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/procurement/requests"]}>
      <Routes>
        <Route path="/procurement/requests" element={<TeamQueuePage />} />
        <Route path="/procurement/requests/:requestId" element={<h1>Handling page</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("TeamQueuePage", () => {
  it("lists each request with its priority and who handles it", () => {
    renderPage();
    expect(screen.getByText("Not set")).toBeInTheDocument();
    expect(screen.getByText("P1")).toBeInTheDocument();
    expect(screen.getByText("pat@example.com")).toBeInTheDocument();
    expect(screen.getByText("Nobody")).toBeInTheDocument();
  });

  it("opens the request from a click anywhere on its row", async () => {
    renderPage();
    await userEvent.setup().click(screen.getByText("Title 1"));
    expect(screen.getByRole("heading", { name: "Handling page" })).toBeInTheDocument();
  });

  it("shows only the requests the user holds under Assigned to me, asking the backend for the assigned ones", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(screen.getByText("Title 1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Assigned to me" }));
    expect(asked).toHaveBeenLastCalledWith({ status: "assigned" });
    expect(screen.getByText("Title 2")).toBeInTheDocument();
    expect(screen.queryByText("Title 1")).toBeNull();
    expect(screen.queryByText("Title 3")).toBeNull();
    await user.click(screen.getByRole("button", { name: "All" }));
    expect(screen.getByText("Title 3")).toBeInTheDocument();
  });

  it("asks for one stage when a chip is picked, and for none with All", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Assigned" }));
    expect(asked).toHaveBeenLastCalledWith({ status: "assigned" });
    await user.click(screen.getByRole("button", { name: "All" }));
    expect(asked).toHaveBeenLastCalledWith({ status: undefined });
  });
});
