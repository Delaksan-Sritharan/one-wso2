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

import { Box, Button, Card, Typography } from "@wso2/oxygen-ui";
import { Link as RouterLink } from "react-router";
import PerspectiveHeader from "@components/perspective-header/PerspectiveHeader";
import { PEOPLE_OPS_SECTIONS, type PerspectiveSection } from "@constants/perspectives";
import { useUserInfo } from "@api/useUserInfo";
import { useSubscriptionGate } from "@features/subscriptions/api/useSubscriptionGate";
import { isSriLankaWorkLocation } from "@utils/locationGate";
import SectionHeader from "../components/SectionHeader";

// This perspective's prior content (People/Visitor/Careers app menus, the
// mock hiring/performance dashboard) was retired per restructuring
// feedback. What's left is the set of reports being ported from people-app.
// Read straight from PEOPLE_OPS_SECTIONS rather than restating them here, so
// the rail's entries and these cards cannot drift apart.
//
// A section that has a `path` has shipped and gets an "Open" card; one that
// doesn't is still a placeholder. That means landing the next report is a
// one-line change in the registry, not an edit in two places.
const REPORTS = PEOPLE_OPS_SECTIONS;

const EMPTY_IDS: ReadonlySet<string> = new Set();
/** Links only a subscription admin should be offered. */
const ADMIN_ONLY_IDS: ReadonlySet<string> = new Set(["people-subscriptions-manage"]);

/**
 * Sections that don't belong on this page AT ALL outside Sri Lanka, as
 * opposed to `ADMIN_ONLY_IDS` above (one link within an otherwise-visible
 * section). Rendered as a full card omission, not folded into `hiddenIds` —
 * `SectionCard` reads "no links left" as "not shipped yet" and shows a
 * "check back once it ships" placeholder, which is the wrong sentence for a
 * Colombo-office perk that will never apply outside it.
 */
const SRI_LANKA_ONLY_SECTION_IDS: ReadonlySet<string> = new Set(["people-subscriptions"]);

export default function PeopleOpsPage() {
  // Same call the rail already makes (people-app's /user-info) — sharing the
  // React Query cache key means this costs no extra request. See SideRail's
  // matching comment for why `undefined` (unresolved) reads as "not Sri
  // Lanka" rather than as "unknown, assume yes": failing closed here just
  // omits a card, where failing open would advertise a Colombo-only perk to
  // someone outside it.
  const userInfo = useUserInfo();
  const isSriLankaEmployee = isSriLankaWorkLocation(userInfo.data?.workLocation);

  // Subscriptions' manage-on-behalf screen is the one link on this page whose
  // audience is narrower than the page's own. The admin reports above it are
  // shown to everyone and explained by PeopleOpsShell on arrival, which is the
  // established pattern here — but those gate on a people-app privilege the
  // rail can already read from /user-info, whereas this one gates on the
  // SUBSCRIPTION service's own Asgardeo groups. Offering it to everyone would
  // advertise a screen most people cannot use, so it is filtered here as well
  // as in the rail. The query is the same one the rail already made, so this
  // costs no extra request.
  const subscriptionGate = useSubscriptionGate();

  const visibleReports = isSriLankaEmployee
    ? REPORTS
    : REPORTS.filter((r) => !SRI_LANKA_ONLY_SECTION_IDS.has(r.id));

  return (
    <Box>
      <PerspectiveHeader
        eyebrow="People Ops perspective"
        title="People Operations"
        subtitle="Reports and tools for the People Ops team."
      />

      {visibleReports.map((r) => (
        <Box key={r.id}>
          <SectionHeader id={r.id}>
            {r.icon ? <r.icon size={14} /> : null}
            {r.label}
          </SectionHeader>
          <Card variant="outlined" sx={{ p: 3, maxWidth: 480 }}>
            <SectionCard
              section={r}
              hiddenIds={
                subscriptionGate.isAdmin && !subscriptionGate.isResolving
                  ? EMPTY_IDS
                  : ADMIN_ONLY_IDS
              }
            />
          </Card>
        </Box>
      ))}
    </Box>
  );
}

// A section's card: a link per shipped screen, or a placeholder. Three shapes,
// because the registry has three: a leaf that is a route, a group whose
// children are routes, and a leaf that hasn't shipped yet.
function SectionCard({
  section,
  hiddenIds,
}: {
  section: PerspectiveSection;
  /** Ids to leave out for this caller — see the note in PeopleOpsPage. */
  hiddenIds: ReadonlySet<string>;
}) {
  // A group (Master data) links to each child rather than itself — the group
  // has no route of its own.
  const links = section.children?.length
    ? section.children.filter((c) => c.path && !hiddenIds.has(c.id))
    : section.path && !hiddenIds.has(section.id)
      ? [section]
      : [];

  if (links.length === 0) {
    return (
      <>
        <Typography sx={{ fontWeight: 600, mb: 0.75 }}>Coming soon</Typography>
        <Typography variant="body2" color="text.secondary">
          {section.label} isn't available yet — check back once it ships.
        </Typography>
      </>
    );
  }

  return (
    <>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {section.description ??
          (section.children?.length
            ? "Reference data used across the app."
            : "Preview against your filters, then export the full dataset as CSV.")}
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {links.map((link) => (
          <Button
            key={link.id}
            component={RouterLink}
            to={link.path!}
            variant="outlined"
            size="small"
          >
            Open {link.label.toLowerCase()}
          </Button>
        ))}
      </Box>
    </>
  );
}
