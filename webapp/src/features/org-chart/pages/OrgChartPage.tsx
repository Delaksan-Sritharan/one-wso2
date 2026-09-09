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

// The company's reporting hierarchy, as a collapsible outline.
//
// Ported from the standalone org-chart app, whose canvas-and-pan-zoom UI is
// deliberately NOT carried over. Its original
// four-endpoint, lazy-per-manager backend contract isn't available either —
// this now reads the people-app backend's employee directory
// (useEmployeeDirectory) in one request and builds the whole tree client-side
// (buildOrgTree). The full functional spec, including why the interaction
// model changed, is in docs/ported-apps/org-chart.md — read that rather than
// reconstructing the rules from this file.
//
// Row visibility (`openEmails`) is lifted here so Expand all / Reset view can
// act on every row at once.
import { useMemo, useState } from "react";
import { Alert, Box, Button, Skeleton, Typography } from "@wso2/oxygen-ui";
import { Download, NetworkIcon } from "@wso2/oxygen-ui-icons-react";
import { HttpError } from "@api/http";
import { describeError } from "@api/errors";
import { isOrgChartConfigured, useEmployeeDirectory } from "../api/useOrgChart";
import { buildOrgTree, indexByEmail } from "../util/buildOrgTree";
import { ancestorChain } from "../util/expandPathToEmployee";
import { departmentStats } from "../util/departmentColors";
import { downloadOrgChartHtml } from "../util/exportOrgChartHtml";
import type { OrgChartNode } from "../api/orgChartTypes";
import OrgChartRow from "../components/OrgChartRow";
import OrgChartSidebar from "../components/OrgChartSidebar";
import OrgChartShell from "../components/OrgChartShell";

function collectExpandableEmails(node: OrgChartNode, into: Set<string>): void {
  if (node.children.length === 0) return;
  into.add(node.workEmail);
  node.children.forEach((child) => collectExpandableEmails(child, into));
}

export default function OrgChartPage() {
  const configured = isOrgChartConfigured();
  const directory = useEmployeeDirectory();

  // Rows other than the root that the user has explicitly opened. The root
  // is tracked separately (rootClosed) rather than seeded into this set once
  // its email is known — that would mean deriving state from data that loads
  // asynchronously via an effect, which just to open one row on first load
  // isn't worth the extra render it costs.
  const [openEmails, setOpenEmails] = useState<Set<string>>(new Set());
  const [rootClosed, setRootClosed] = useState(false);
  // The one department currently isolated, or null to show everyone.
  // Single-select: picking a department hides every row that isn't either a
  // member of it or a Chairman-path ancestor leading to one — a harder cut
  // than the old dim-only filter (see the visibleEmails comment below).
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [hideInterns, setHideInterns] = useState(false);
  const [highlightEmail, setHighlightEmail] = useState<string>();

  const tree = useMemo(() => (directory.data ? buildOrgTree(directory.data) : null), [directory.data]);
  const byEmail = useMemo(() => indexByEmail(directory.data ?? []), [directory.data]);

  // "Department" here is the directory's `team` field — see
  // util/departmentColors.ts for why.
  const stats = useMemo(
    () => departmentStats((directory.data ?? []).map((employee) => ({ department: employee.team }))),
    [directory.data],
  );

  // Every workEmail that should render while a department is isolated: each
  // member of that department, plus everyone on their path back to whichever
  // root they hang off (the Chairman, or their own stray root) — reusing the
  // same upward walk search-jump uses, since "keep the path to the root
  // visible" is exactly the same problem. null means no filter: show
  // everyone. A row not in this set is fully hidden, not dimmed — including
  // an ancestor's OTHER children in unrelated departments (a deliberate
  // change from the original dim-only design; see docs/ported-apps/org-chart.md §3).
  const visibleEmails = useMemo(() => {
    if (!selectedDepartment || !directory.data) return null;
    const visible = new Set<string>();
    directory.data
      .filter((employee) => employee.team === selectedDepartment)
      .forEach((employee) => ancestorChain(employee.workEmail, byEmail).forEach((email) => visible.add(email)));
    return visible;
  }, [selectedDepartment, directory.data, byEmail]);

  const visibleStrayRoots = useMemo(
    () => (tree ? tree.strayRoots.filter((stray) => !visibleEmails || visibleEmails.has(stray.workEmail)) : []),
    [tree, visibleEmails],
  );

  // The root counts as open unless the user closed it — folded into the same
  // Set shape OrgChartRow already expects, computed at render time rather
  // than stored, so there's nothing to keep in sync via an effect.
  const effectiveOpenEmails = useMemo(() => {
    const rootEmail = tree?.root.workEmail;
    if (!rootEmail || rootClosed || openEmails.has(rootEmail)) return openEmails;
    return new Set(openEmails).add(rootEmail);
  }, [openEmails, tree?.root.workEmail, rootClosed]);

  // The service refuses every endpoint outside its authorised group — see
  // docs/ported-apps/org-chart.md §4 — so one notice covers the whole page.
  const forbidden = directory.error instanceof HttpError && directory.error.status === 403;

  const handleToggle = (workEmail: string) => {
    if (tree && workEmail === tree.root.workEmail) {
      setRootClosed((prev) => !prev);
      return;
    }
    setOpenEmails((prev) => {
      const next = new Set(prev);
      if (next.has(workEmail)) next.delete(workEmail);
      else next.add(workEmail);
      return next;
    });
  };

  const handleSelectDepartment = (department: string | null) => {
    setSelectedDepartment((prev) => (prev === department ? null : department));
  };

  const handleExpandAll = () => {
    if (!tree) return;
    setRootClosed(false);
    const next = new Set<string>();
    collectExpandableEmails(tree.root, next);
    tree.strayRoots.forEach((stray) => collectExpandableEmails(stray, next));
    setOpenEmails(next);
  };

  // Always the full tree — deliberately ignores the current department
  // filter/collapse state, since a downloaded file is for sharing the whole
  // org chart with someone else, not a snapshot of what's on screen right now.
  // Async and can take a few seconds: it fetches and downscales every
  // available employee photo (while we're still authenticated) so the file
  // is genuinely self-contained — see exportOrgChartHtml.ts.
  const [isPreparingDownload, setIsPreparingDownload] = useState(false);
  const handleDownload = async () => {
    if (!directory.data) return;
    setIsPreparingDownload(true);
    try {
      await downloadOrgChartHtml(directory.data);
    } finally {
      setIsPreparingDownload(false);
    }
  };

  const handleReset = () => {
    setSelectedDepartment(null);
    setHideInterns(false);
    setHighlightEmail(undefined);
    setRootClosed(false);
    setOpenEmails(new Set());
  };

  const handleSelectSearchResult = (workEmail: string) => {
    const chain = ancestorChain(workEmail, byEmail);
    if (chain.length === 0) return;
    // A department filter would otherwise hide the very result being jumped
    // to, if they're not in the isolated department.
    setSelectedDepartment(null);
    setOpenEmails((prev) => new Set([...prev, ...chain]));
    setRootClosed(false);
    setHighlightEmail(workEmail);
    // Two ticks after the state above: one for React to render the newly
    // opened rows, one for the browser to lay them out, before scrolling.
    window.setTimeout(() => {
      document.querySelector(`[data-work-email="${workEmail}"]`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 60);
    window.setTimeout(() => setHighlightEmail(undefined), 2000);
  };

  return (
    <OrgChartShell
      eyebrow={{ icon: NetworkIcon, label: "Org Chart" }}
      title="Org chart"
      subtitle="The company's reporting hierarchy, from the Chairman down."
      configured={configured}
      configKey="ONE_WSO2_PEOPLE_BACKEND_URL"
      action={
        tree && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<Download size={16} />}
            onClick={() => void handleDownload()}
            disabled={isPreparingDownload}
          >
            {isPreparingDownload ? "Preparing…" : "Download"}
          </Button>
        )
      }
    >
      {forbidden ? (
        <Alert severity="warning">
          You don&apos;t have access to the org chart. Ask the internal apps team to add you.
        </Alert>
      ) : directory.isLoading ? (
        <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 1.5 }} />
      ) : directory.isError ? (
        <Alert severity="error">Couldn&apos;t load the org chart. {describeError(directory.error)}</Alert>
      ) : !tree ? (
        <Alert severity="error">Couldn&apos;t find the company&apos;s root (Chairman) in the directory.</Alert>
      ) : (
        <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start" }}>
          <OrgChartSidebar
            totalCount={directory.data?.length ?? 0}
            departmentStats={stats}
            selectedDepartment={selectedDepartment}
            onSelectDepartment={handleSelectDepartment}
            directory={directory.data ?? []}
            strayCount={tree.strayRoots.length}
            onSelectSearchResult={handleSelectSearchResult}
            hideInterns={hideInterns}
            onToggleHideInterns={() => setHideInterns((value) => !value)}
            onExpandAll={handleExpandAll}
            onReset={handleReset}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {!visibleEmails || visibleEmails.has(tree.root.workEmail) ? (
              <OrgChartRow
                node={tree.root}
                depth={0}
                openEmails={effectiveOpenEmails}
                onToggle={handleToggle}
                visibleEmails={visibleEmails}
                hideInterns={hideInterns}
                highlightEmail={highlightEmail}
              />
            ) : (
              <Typography variant="body2" color="text.disabled">
                Nobody in {selectedDepartment} is reachable from the Chairman.
              </Typography>
            )}
            {visibleStrayRoots.length > 0 && (
              <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: "divider" }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                  {visibleStrayRoots.length} more, reporting to a manager who has left the company:
                </Typography>
                {visibleStrayRoots.map((stray) => (
                  <OrgChartRow
                    key={stray.workEmail}
                    node={stray}
                    depth={0}
                    openEmails={effectiveOpenEmails}
                    onToggle={handleToggle}
                    visibleEmails={visibleEmails}
                    hideInterns={hideInterns}
                    highlightEmail={highlightEmail}
                  />
                ))}
              </Box>
            )}
          </Box>
        </Box>
      )}
    </OrgChartShell>
  );
}
