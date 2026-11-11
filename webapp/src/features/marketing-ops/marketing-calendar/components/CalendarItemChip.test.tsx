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
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { longDate } from "../calendarDates";
import type { CalendarItem } from "../marketingCalendarTypes";
import { sampleItem } from "../testing/fixtures";
import CalendarItemChip from "./CalendarItemChip";

// The tooltip names the item's calendar date: by the category's own name for it,
// and plainly "Date" for an event, whose calendar date is its Due Date.

async function hoverTooltip(item: CalendarItem): Promise<string> {
  render(<CalendarItemChip item={item} onOpen={() => {}} />);
  await userEvent.setup().hover(screen.getByRole("button", { name: item.title }));
  return (await screen.findByRole("tooltip")).textContent ?? "";
}

describe("the chip's tooltip", () => {
  it("labels an event's calendar date (its Due Date) Date, not Event Start Date", async () => {
  
    const base = sampleItem("84:event");
    if (base.category !== "event") throw new Error("not an event");
    const item: CalendarItem = {
      ...base,
      date: "2026-11-04",
      details: { ...base.details, startDate: "2026-11-05", endDate: "2026-11-05" },
    };
    const text = await hoverTooltip(item);
    expect(text).toContain(`Date: ${longDate("2026-11-04")}`);
    expect(text).not.toContain("Event Start Date");
  });

  it.each([
    ["42:content", "Publish Date"],
    ["40:social", "Post Date"],
    ["58:email", "Send Date"],
  ])("labels a %s item's date %s", async (key, label) => {
    const item = sampleItem(key);
    const text = await hoverTooltip(item);
    expect(text).toContain(`${label}: ${longDate(item.date)}`);
  });
});

describe("the chip's title", () => {
  // jsdom can't lay out text, so the two-line clamp itself is checked in a browser.
  it("holds the whole title (CSS clamps it to two lines), and so does the tooltip", async () => {
    const item = sampleItem("58:email");
    const text = await hoverTooltip(item);
    // While the tooltip is open, MUI names the button after it, so find it by role alone.
    expect(screen.getByRole("button")).toHaveTextContent(item.title);
    expect(text).toContain(item.title);
  });

  it("opens the item when clicked", async () => {
    const item = sampleItem("42:content");
    const opened: CalendarItem[] = [];
    render(<CalendarItemChip item={item} onOpen={(i) => opened.push(i)} />);
    await userEvent.setup().click(screen.getByRole("button", { name: item.title }));
    expect(opened).toEqual([item]);
  });
});
