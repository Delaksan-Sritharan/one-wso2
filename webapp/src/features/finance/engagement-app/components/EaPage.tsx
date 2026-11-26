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

import { useEffect, useRef, type JSX, type ReactNode } from "react";
import { Link as RouterLink, useLocation } from "react-router";
import { Box, IconButton, Link, Stack, Typography } from "@wso2/oxygen-ui";
import { ArrowLeftIcon, SearchIcon } from "@wso2/oxygen-ui-icons-react";
import { useDocumentTitle } from "@hooks/useDocumentTitle";
import GlobalSearch from "../search/GlobalSearch";
import { ENGAGEMENT_APP_PATH, engagementPaths } from "../engagementPaths";
import { backTarget, rememberVisit } from "../model/backTarget";

/** The frame every Engagement App screen draws: the title with its status chips, one or two plain sentences under it, and the screen's actions on the right of the title block (FinanceShell's look, with the Claims page's actions placement). */
export default function EaPage({
  title,
  documentTitle,
  subtitle,
  chips,
  actions,
  back,
  collapsedSearch = false,
  children,
}: {
  readonly title: ReactNode;
  /** The browser tab's title, when `title` is not plain text. */
  readonly documentTitle?: string;
  readonly subtitle?: ReactNode;
  readonly chips?: ReactNode;
  readonly actions?: ReactNode;
  readonly back?: { readonly to: string; readonly label: string };
  /** A list page has its own search box: the header's shrinks to an icon (the `/` key and the icon still open it). */
  readonly collapsedSearch?: boolean;
  readonly children: ReactNode;
}): JSX.Element {
  useDocumentTitle(documentTitle ?? (typeof title === "string" ? title : undefined));
  const { pathname, search } = useLocation();
  // The search box rides every Finance screen but the results page, which has its own field.
  const searchable = pathname.startsWith(`${ENGAGEMENT_APP_PATH}/`) && pathname !== engagementPaths.search();
  useEffect(() => rememberVisit(pathname + search), [pathname, search]);
  const searchBox = useRef<HTMLDivElement>(null);
  return (
    <Box sx={{ minWidth: 0 }}>
      {back ? (
        <Link
          component={RouterLink}
          to={backTarget(back.to, pathname)}
          // An explicit colour: some themes (Choreo Labs) draw a colourless link as body text.
          color="primary"
          variant="body2"
          underline="none"
          sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, mb: 1, fontWeight: 600 }}
        >
          <ArrowLeftIcon size={14} /> {back.label}
        </Link>
      ) : null}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2.25, flexWrap: { xs: "wrap", md: "nowrap" } }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.75 }}>
            <Typography component="h1" variant="h5">
              {title}
            </Typography>
            {chips}
          </Stack>
          {subtitle ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: "95ch" }}>
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        {searchable && collapsedSearch ? (
          <>
            <IconButton aria-label="Search Engagement App" size="small" onClick={() => searchBox.current?.querySelector("input")?.focus()} sx={{ display: { xs: "none", md: "inline-flex" } }}>
              <SearchIcon size={18} />
            </IconButton>
            {/* Kept in the page but out of sight until it has focus, so `/` keeps working. */}
            <Box
              ref={searchBox}
              sx={{
                position: "absolute",
                width: 1,
                height: 1,
                overflow: "hidden",
                clipPath: "inset(50%)",
                "&:focus-within": { position: "static", width: { xs: "100%", md: "auto" }, height: "auto", overflow: "visible", clipPath: "none" },
              }}
            >
              <GlobalSearch />
            </Box>
          </>
        ) : searchable ? (
          <GlobalSearch />
        ) : null}
        {actions ? (
          <Stack direction="row" spacing={1} sx={{ flexShrink: 0, alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
            {actions}
          </Stack>
        ) : null}
      </Box>
      {children}
    </Box>
  );
}
