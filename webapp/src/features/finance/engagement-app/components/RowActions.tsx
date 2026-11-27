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

import { useState, type JSX } from "react";
import { Box, Button, IconButton, Menu, MenuItem } from "@wso2/oxygen-ui";
import { EllipsisVerticalIcon } from "@wso2/oxygen-ui-icons-react";
import type { RowAction } from "./EaTable";

/** How a table row shows its actions: the one flagged primary is the button and the rest share the menu. With none flagged, one action is a button and two or more all go in the menu. */
export function rowActionLayout(actions: readonly RowAction[]): { readonly button?: RowAction; readonly menu: readonly RowAction[] } {
  const primary = actions.find((a) => a.primary);
  if (primary) return { button: primary, menu: actions.filter((a) => a !== primary) };
  return actions.length === 1 ? { button: actions[0], menu: [] } : { menu: actions };
}

/** A record's actions on its own page: the primary one filled, the rest in a menu, on the right. */
export default function RowActions({
  primary,
  menu,
  label,
}: {
  readonly primary?: RowAction;
  readonly menu: readonly RowAction[];
  readonly label: string;
}): JSX.Element | null {
  if (!primary && !menu.length) return null;
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
      {primary ? (
        <Button variant="contained" disabled={primary.disabled} startIcon={primary.icon} onClick={primary.onClick} sx={{ fontWeight: 600 }}>
          {primary.label}
        </Button>
      ) : null}
      {menu.length ? <RowMenu items={menu} label={label} /> : null}
    </Box>
  );
}

export function RowMenu({ items, label }: { items: readonly RowAction[]; label: string }): JSX.Element {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <IconButton size="small" aria-label={`More actions for ${label}`} onClick={(e) => setAnchor(e.currentTarget)}>
        <EllipsisVerticalIcon size={16} />
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {items.map((it) => (
          <MenuItem
            key={it.label}
            disabled={it.disabled}
            onClick={() => {
              setAnchor(null);
              it.onClick();
            }}
            sx={{ fontSize: 13, ...(it.danger ? { color: "error.main" } : {}) }}
          >
            {it.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
