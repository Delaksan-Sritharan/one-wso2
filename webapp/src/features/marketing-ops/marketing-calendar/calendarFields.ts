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

import { categoryStyle } from "./calendarCategories";
import type { CalendarItem } from "./marketingCalendarTypes";

// What the details drawer shows for an item and what the List's CSV export
// writes, so the two always use the same labels in the same order.

export interface Field {
  label: string;
  value: string | readonly string[] | undefined;
  // "date": a YYYY-MM-DD shown long. "text": an abstract or email body, shown as
  // written with its line breaks — plain text, never HTML or markdown. "link":
  // a link when it is an https URL, text otherwise.
  kind?: "date" | "text" | "link";
}

// The heading and the rows under it, per category, in the order the marketing
// team listed them. The heading is each list's first field (Title, or the Event
// Name), so it isn't repeated as a row.
export function itemFields(item: CalendarItem): { heading: string; fields: Field[] } {
  const date: Field = { label: categoryStyle(item.category).dateLabel, value: item.date, kind: "date" };
  const bu: Field = { label: "BU", value: item.bu };
  const region: Field = { label: "Region", value: item.region };

  switch (item.category) {
    case "content":
      return {
        heading: item.title,
        fields: [
          { label: "Author", value: item.details.author },
          { label: "Content type", value: item.details.contentType },
          { label: "Format", value: item.details.format },
          { label: "Target persona", value: item.details.targetPersona },
          date,
          bu,
          { label: "Abstract", value: item.details.abstract, kind: "text" },
        ],
      };
    case "event":
      return {
        heading: item.details.eventName ?? item.title,
        fields: [
          { label: "Event Start Date", value: item.details.startDate, kind: "date" },
          { label: "Event End Date", value: item.details.endDate, kind: "date" },
          { label: "Event Type", value: item.details.eventType },
          { label: "Salesforce Campaign", value: item.details.salesforceCampaign, kind: "link" },
          bu,
          region,
        ],
      };
    case "social":
      return {
        heading: item.title,
        fields: [
          date,
          { label: "Platform", value: item.details.platform },
          { label: "Handle", value: item.details.handle },
          bu,
        ],
      };
    case "email":
      return {
        heading: item.title,
        fields: [
          date,
          bu,
          region,
          { label: "Subject line", value: item.details.subjectLine },
          { label: "Sender", value: item.details.sender },
          { label: "Email body copy", value: item.details.bodyCopy, kind: "text" },
        ],
      };
    case "release":
      return {
        heading: item.title,
        fields: [
          { label: "Product name", value: item.details.productName },
          { label: "Version", value: item.details.version },
          bu,
          { label: "Release type", value: item.details.releaseType },
          { label: "Tier", value: item.details.tier },
          { label: "Website Availability Date", value: item.details.websiteDate, kind: "date" },
          date,
        ],
      };
  }
}
