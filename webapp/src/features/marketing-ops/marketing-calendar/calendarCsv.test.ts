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
import { calendarCsv, csvFileName } from "./calendarCsv";
import type { CalendarCategory, CalendarItem } from "./marketingCalendarTypes";
import { SAMPLE_ITEMS, sampleItem } from "./testing/fixtures";

// The CSV's lines, without the BOM and the final line break.
function lines(csv: string): string[] {
  expect(csv.startsWith("﻿")).toBe(true);
  expect(csv.endsWith("\r\n")).toBe(true);
  return csv.slice(1, -2).split("\r\n");
}

const ofCategory = (category: CalendarCategory) => SAMPLE_ITEMS.filter((item) => item.category === category);

describe("calendarCsv", () => {
  it("writes each type's drawer fields as columns, between the title and Status, State and the issue link", () => {
    const headers = Object.fromEntries(
      (["content", "event", "social", "email", "release"] as const).map((category) => [
        category,
        lines(calendarCsv(ofCategory(category)))[0],
      ]),
    );
    expect(headers).toEqual({
      content:
        "Title,Author,Content type,Format,Target persona,Publish Date,BU,Abstract,Status,State,GitHub Issue",
      event:
        "Event Name,Event Start Date,Event End Date,Event Type,Salesforce Campaign,BU,Region,Status,State,GitHub Issue",
      social: "Title,Post Date,Platform,Handle,BU,Status,State,GitHub Issue",
      email: "Title,Send Date,BU,Region,Subject line,Sender,Email body copy,Status,State,GitHub Issue",
      release:
        "Title,Product name,Version,BU,Release type,Tier,Website Availability Date,Marketing Launch Date," +
        "Status,State,GitHub Issue",
    });
  });

  it("writes one row per item, in the order given, with empty cells for missing values", () => {
    // Rows end in \r\n; the abstract's own line break stays inside its quoted cell.
    const [, whitepaper, unbuilt, ...rest] = lines(calendarCsv([sampleItem("42:content"), sampleItem("81:content")]));
    expect(whitepaper).toBe(
      "[Whitepaper] Securing agent-to-API traffic,writer@example.com,SEO/GEO,Whitepaper,Architect,2026-11-12,API," +
        '"Fake abstract for calendar testing.\nIt has a second line.",Planned,Open,' +
        "https://github.com/Plan2-Go/marketing-team/issues/42",
    );
    expect(unbuilt).toBe(
      "Content brief: Event-driven agents explained,,,,,2026-11-09,Agent,Fake abstract from the unbuilt form.," +
        "Planned,Open,https://github.com/Plan2-Go/marketing-team/issues/81",
    );
    expect(rest).toEqual([]);
  });

  it("uses an event's name as its first cell", () => {
    const event = sampleItem("45:event");
    const name = event.category === "event" ? event.details.eventName : undefined;
    expect(name).toBeTruthy();
    expect(lines(calendarCsv([event]))[1].startsWith(`${name},`)).toBe(true);
  });

  it("quotes cells with commas, quotes or line breaks, and joins lists", () => {
    const item = withTitle(sampleItem("42:content"), 'Say "hi", then go');
    const row = lines(calendarCsv([{ ...item, bu: ["API", "IAM"] }]))[1];
    expect(row.startsWith('"Say ""hi"", then go",')).toBe(true);
    expect(row).toContain(',"API, IAM",');
  });

  it("keeps a cell that starts like a formula from running, but leaves numbers alone", () => {
    const cell = (title: string) => lines(calendarCsv([withTitle(sampleItem("42:content"), title)]))[1].split(",")[0];
    expect(cell("=1+1")).toBe("'=1+1");
    expect(cell("+44 call")).toBe("'+44 call");
    expect(cell("-sale")).toBe("'-sale");
    expect(cell("@here")).toBe("'@here");
    expect(cell("-5")).toBe("-5");
    expect(cell("2026 plan")).toBe("2026 plan");
  });

  it("is empty when there is nothing to export", () => {
    expect(calendarCsv([])).toBe("");
  });
});

describe("csvFileName", () => {
  it("names the tab and the range", () => {
    expect(csvFileName("social", { from: "2026-11-01", to: "2026-11-30" })).toBe(
      "marketing-calendar-social-2026-11-01-to-2026-11-30.csv",
    );
    expect(csvFileName("release", { from: "2026-11-15", to: "2027-01-10" })).toBe(
      "marketing-calendar-releases-2026-11-15-to-2027-01-10.csv",
    );
  });
});

function withTitle(item: CalendarItem, title: string): CalendarItem {
  return { ...item, title };
}
