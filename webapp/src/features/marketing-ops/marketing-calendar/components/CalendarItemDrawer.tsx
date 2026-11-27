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

import { Box, Button, Chip, Drawer, IconButton, Link, Typography } from "@wso2/oxygen-ui";
import { ExternalLinkIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import { categoryChipColor, categoryStyle } from "../calendarCategories";
import { longDate } from "../calendarDates";
import { itemFields, type Field } from "../calendarFields";
import type { CalendarItem } from "../marketingCalendarTypes";

// One item's details in a drawer on the right. The fields are chosen by the
// item's own category, so an item opened from the All view reads the same as
// from its tab. A field with no value is left out rather than shown as a dash.
export default function CalendarItemDrawer({
  item,
  onClose,
}: {
  // Open while an item is set.
  item: CalendarItem | null;
  onClose: () => void;
}) {
  return (
    <Drawer
      anchor="right"
      open={item !== null}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: "100%", sm: 400 }, p: 3 } } }}
    >
      {item && <ItemDetails item={item} onClose={onClose} />}
    </Drawer>
  );
}

function ItemDetails({ item, onClose }: { item: CalendarItem; onClose: () => void }) {
  const style = categoryStyle(item.category);
  const paint = categoryChipColor(style, "outlined");
  const { heading, fields } = itemFields(item);
  const shownFields = fields.filter((field) => field.value !== undefined && field.value.length > 0);
  const state = item.state === "open" ? "Open" : "Closed";

  return (
    <>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Chip label={style.label} color={paint.color} variant="outlined" size="small" sx={paint.sx} />
        <IconButton size="small" aria-label="Close details" onClick={onClose}>
          <XIcon size={18} />
        </IconButton>
      </Box>

      <Typography variant="h6" component="h2" sx={{ fontWeight: 600, mb: 0.5 }}>
        {heading}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {item.status ? `${item.status} · ${state}` : state}
      </Typography>

      {shownFields.length > 0 && (
        <Box component="dl" sx={{ m: 0, mb: 3 }}>
          {shownFields.map((field) => (
            <Box key={field.label} sx={{ py: 0.75, borderBottom: 1, borderColor: "divider" }}>
              <Typography component="dt" variant="caption" color="text.secondary">
                {field.label}
              </Typography>
              <Typography
                component="dd"
                variant="body2"
                sx={{ m: 0, overflowWrap: "anywhere", whiteSpace: field.kind === "text" ? "pre-wrap" : undefined }}
              >
                <FieldValue field={field} />
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* Only https links are written into an href — docs/conventions.md. */}
      {isHttpsUrl(item.url) && (
        <Button
          component="a"
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          variant="outlined"
          size="small"
          startIcon={<ExternalLinkIcon size={16} />}
        >
          Open in GitHub
        </Button>
      )}
    </>
  );
}

function FieldValue({ field }: { field: Field }) {
  const { value } = field;
  if (value === undefined) return null;
  if (typeof value !== "string") return value.join(", ");
  if (field.kind === "date") return longDate(value);
  if (field.kind === "link" && isHttpsUrl(value)) {
    return (
      <Link href={value} target="_blank" rel="noopener noreferrer">
        {value}
      </Link>
    );
  }
  return value;
}

function isHttpsUrl(url: string): boolean {
  return /^https:\/\//i.test(url);
}
