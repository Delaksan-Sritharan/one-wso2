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

import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { longDate } from "../calendarDates";
import type { CalendarItem } from "../marketingCalendarTypes";
import { sampleItem } from "../testing/fixtures";
import ItemList from "./ItemList";

function renderList(items: CalendarItem[], onOpen: (item: CalendarItem) => void = () => {}) {
  render(<ItemList items={items} onOpenItem={onOpen} />);
  return userEvent.setup();
}

describe("the item list", () => {
  it("heads each day that has items, earliest first, keeping each day's items in order", () => {
    // Given out of date order: 30 Nov, 9 Nov, 26 Nov (Blog), 26 Nov (Email), 27 Oct.
    renderList(["55:social", "81:content", "73:content", "58:email", "40:social"].map(sampleItem));
    const headings = screen.getAllByRole("heading").map((heading) => heading.textContent);
    expect(headings).toEqual(["2026-10-27", "2026-11-09", "2026-11-26", "2026-11-30"].map(longDate));

    const rows = screen.getAllByRole("button").map((row) => row.textContent);
    expect(rows).toEqual([
      expect.stringContaining("[Social] LinkedIn: Community call 5"),
      expect.stringContaining("Content brief: Event-driven agents explained"),
      expect.stringContaining("[Blog] Integrator 5.1 launch recap"),
      expect.stringContaining("[Email] Agent platform briefing ME"),
      expect.stringContaining("[Social] Facebook: Solutions team in Nairobi"),
    ]);
  });

  it("shows the whole title and a line of category, Status and BU", () => {
    renderList([sampleItem("42:content")]);
    const row = screen.getByRole("button");
    expect(within(row).getByText("[Whitepaper] Securing agent-to-API traffic")).toBeVisible();
    expect(within(row).getByText("Content · Planned · API")).toBeVisible();
  });

  it("leaves out what an item doesn't have", () => {
    // Year-end thank you: no BU.
    renderList([sampleItem("87:email")]);
    expect(screen.getByText("Email · Planned")).toBeVisible();
  });

  it("opens an item on click and on Enter", async () => {
    const opened: CalendarItem[] = [];
    const items = [sampleItem("42:content"), sampleItem("55:social")];
    const user = renderList(items, (item) => opened.push(item));

    await user.click(screen.getByRole("button", { name: /Securing agent-to-API traffic/ }));
    expect(opened).toEqual([items[0]]);

    screen.getByRole("button", { name: /Solutions team in Nairobi/ }).focus();
    await user.keyboard("{Enter}");
    expect(opened).toEqual([items[0], items[1]]);
  });

  it("draws nothing for no items", () => {
    renderList([]);
    expect(screen.queryByRole("heading")).toBeNull();
  });
});
