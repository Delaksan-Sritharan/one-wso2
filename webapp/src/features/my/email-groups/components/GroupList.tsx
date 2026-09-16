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

import {
  Box,
  Checkbox,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  Typography,
} from "@wso2/oxygen-ui";
import { MailPlusIcon, MailXIcon } from "@wso2/oxygen-ui-icons-react";
import type { ReactNode } from "react";
import type { GroupCategory, MyGroupRow } from "../api/emailGroupTypes";
import { splitIntoColumns } from "../util/columns";

/** Both lists' column count. */
const COLUMN_COUNT = 2;

// One row: the group's address on the left, its action chip(s) pinned to
// the right on the SAME line, and an optional leading checkbox (public,
// joinable rows only). Shared by both lists on the page so they read as one
// consistent list rather than two components with two different rhythms.
//
// Deliberately NOT MUI's `secondaryAction` (which absolutely-positions its
// content over a fixed slice of the row's width, independent of how much
// room the name actually needs): a real flex row instead, where the name is
// the one flexible item — it takes whatever space is left after the fixed-
// width chip(s), and shrinks to an ellipsis rather than the two colliding
// when there isn't enough of it.
function GroupRow({
  name,
  checkbox,
  trailing,
}: {
  name: string;
  checkbox?: { checked: boolean; onChange: () => void };
  trailing?: ReactNode;
}) {
  return (
    <ListItem
      // Clicking the row toggles the checkbox, same as the source app — the
      // hit target for "select this one" is the whole row, not just the tiny
      // box. Rows with no checkbox (My Groups) aren't clickable.
      onClick={checkbox ? checkbox.onChange : undefined}
      sx={{ cursor: checkbox ? "pointer" : "default", py: 0.75, alignItems: "center", gap: 1 }}
    >
      {checkbox && (
        <ListItemIcon sx={{ minWidth: 32 }}>
          <Checkbox
            edge="start"
            checked={checkbox.checked}
            tabIndex={-1}
            disableRipple
            onChange={checkbox.onChange}
            onClick={(e) => e.stopPropagation()}
          />
        </ListItemIcon>
      )}
      {/* Ellipsis rather than the old break-anywhere wrap: a long address
          shrinks to fit whatever room the chip(s) leave it, rather than
          pushing them off the row — the native `title` gives the full
          address on hover. */}
      <Typography
        title={name}
        sx={{
          flex: 1,
          minWidth: 0,
          fontSize: 13.5,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {name}
      </Typography>
      {trailing && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexShrink: 0 }}>
          {trailing}
        </Box>
      )}
    </ListItem>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <Typography variant="body2" color="text.secondary" sx={{ py: 2, px: 1, fontStyle: "italic" }}>
      {text}
    </Typography>
  );
}

/**
 * Lays out `items` into up to `COLUMN_COUNT` side-by-side columns — the
 * whole list at once (one column stacked full-width on a phone, side by side
 * from tablet up), rather than paging. Separated by plain whitespace rather
 * than a rule: a vertical line looked fine centred in a wide gap, but with
 * columns this narrow it either crowded one side's text or the other
 * depending which column it was biased toward — whitespace alone reads as
 * separate groups just as clearly.
 *
 * On a phone the "columns" stack into one column, and a divider is added
 * between them there (hidden again from the breakpoint they sit side by
 * side) so the seam between one column's rows and the next still reads as a
 * boundary rather than an unrelated gap in the middle of one list.
 */
function GroupColumns<T>({
  items,
  keyOf,
  renderRow,
}: {
  items: readonly T[];
  keyOf: (item: T) => string;
  renderRow: (item: T) => ReactNode;
}) {
  const columns = splitIntoColumns(items, COLUMN_COUNT);
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: `repeat(${COLUMN_COUNT}, minmax(0, 1fr))` },
        columnGap: { md: 3 },
      }}
    >
      {columns.map((column, colIndex) => (
        <Box key={colIndex}>
          <List dense disablePadding>
            {column.map((item, i) => (
              <div key={keyOf(item)}>
                {renderRow(item)}
                {i < column.length - 1 && <Divider component="li" />}
              </div>
            ))}
          </List>
          {colIndex < columns.length - 1 && column.length > 0 && (
            <Divider sx={{ display: { xs: "block", md: "none" } }} />
          )}
        </Box>
      ))}
    </Box>
  );
}

const CATEGORY_LABEL: Record<GroupCategory, string> = {
  default: "Default",
  private: "Private",
  public: "Public",
};

/**
 * "My Groups" — every group the caller is already subscribed to, tagged with
 * where it came from. Default and private rows are read-only; a public row
 * carries the one Unsubscribe action this page offers (the joinable
 * directory below only ever shows groups the caller hasn't joined).
 */
export function MyGroupsList({
  rows,
  onUnsubscribe,
  showCategoryTag,
}: {
  rows: readonly MyGroupRow[];
  onUnsubscribe: (name: string) => void;
  /**
   * The category chip only earns its place under the "All" filter, where a
   * row's origin isn't otherwise obvious. Under "Default"/"Public"/"Private"
   * every row is already that one thing — repeating it on every row would
   * just be the section's own filter choice, echoed back at the reader once
   * per row.
   */
  showCategoryTag: boolean;
}) {
  if (rows.length === 0) return <EmptyRow text="No groups match your search." />;
  return (
    <GroupColumns
      items={rows}
      keyOf={(row) => `${row.category}:${row.name}`}
      renderRow={(row) => (
        <GroupRow
          name={row.name}
          trailing={
            <>
              {showCategoryTag && (
                <Chip label={CATEGORY_LABEL[row.category]} size="small" variant="outlined" />
              )}
              {row.category === "public" && (
                <Chip
                  label="Unsubscribe"
                  size="small"
                  variant="outlined"
                  color="error"
                  icon={<MailXIcon size={13} />}
                  onClick={() => onUnsubscribe(row.name)}
                  sx={{ cursor: "pointer" }}
                />
              )}
            </>
          }
        />
      )}
    />
  );
}

/**
 * The public directory, narrowed to groups the caller hasn't joined — a
 * checkbox for bulk selection, plus an immediate per-row Subscribe action.
 */
export function PublicGroupList({
  groups,
  selected,
  onToggleSelect,
  onSubscribe,
}: {
  groups: readonly { name: string }[];
  selected: ReadonlySet<string>;
  onToggleSelect: (name: string) => void;
  onSubscribe: (name: string) => void;
}) {
  if (groups.length === 0) return <EmptyRow text="No groups match your search." />;
  return (
    <GroupColumns
      items={groups}
      keyOf={(g) => g.name}
      renderRow={(g) => (
        <GroupRow
          name={g.name}
          checkbox={{ checked: selected.has(g.name), onChange: () => onToggleSelect(g.name) }}
          trailing={
            <Chip
              label="Subscribe"
              size="small"
              variant="outlined"
              color="success"
              icon={<MailPlusIcon size={13} />}
              onClick={(e) => {
                e.stopPropagation();
                onSubscribe(g.name);
              }}
              sx={{ cursor: "pointer" }}
            />
          }
        />
      )}
    />
  );
}
