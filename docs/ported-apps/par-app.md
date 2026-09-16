# PAR (Performance Appraisal Review) — functional specification

**Status:** the employee-facing half of par-app is ported and live under People Ops. The Lead Portal is
partially ported — Direct Reports and Top 5%/20% Allocation are done; Additional Reports, Report
Chain, and Employee History are not, planned for a follow-up PR (§8.6). Admin Portal and F2F
scheduling are not started. Written from the source and cross-checked against the running staging app
(screenshots) — this is the reference for verifying the port and for writing test cases against it,
not a proposal.

**Source of truth for behaviour:** `digiops-hr/apps/par-app/webapp/src` — `OngoingCycleView.tsx` and
its panels/components for the four tabs below (`views/ongoingCycleView/`, `components/common/
RequestFeedbackTab.tsx`, `ProvideFeedbackTab.tsx`, `OfferFeedbackView.tsx`, `views/parHistory/
ParHistory.tsx`) — and `par-app/backend` (`service.bal` for the endpoint surface, `manager.bal` for
cycle lifecycle, `modules/types/types.bal` for states, roles and field-level authorization).

**In One WSO2:** `/people-ops/performance`, a tab group (`features/par/`) under the People Ops
perspective — **Employee Feedback**, **Request 360° Feedback**, **Provide 360° Feedback**, and
**History**, each a real route (`employee-feedback` / `request-360` / `provide-360` / `history`).
The Lead Portal lives one level down at `/people-ops/performance/lead`, gated on par-app's own
`Role.TEAM_LEAD` (`ParRequiresTeamLeadRoute`) — so far **Direct Reports** and **Top 5%/20%
Allocation** (`direct-reports` / `allocation`). Backend is par-app's own Ballerina service, configured
as `ONE_WSO2_PAR_BACKEND_URL`.

---

## 1. Purpose and users

Every employee goes through a PAR cycle: write a self-assessment, take part in 360° feedback (both
asking colleagues to review you and reviewing colleagues who asked you), and see your record once
your lead has rated you. There is no separate people-management surface here — that's the Lead/Admin
Portal, not yet ported (see §7).

**Who sees which tabs** is decided by one fact: whether the employee has a lead
(`OngoingCycleView.tsx`'s `employeeInfo.leadEmail !== null`, ported as `useParHasLead` reading
par-app's own `GET /employees/{email}`). Someone with a lead gets all four tabs; someone without one
(e.g. the top of a reporting chain) gets only **Provide 360° Feedback** and **History** — there is
nothing to self-assess or request reviewers for if nobody above you administers your cycle. The gate
fails *open*: until the fetch has actually confirmed `leadEmail === null`, every tab shows. This is a
UX-only visibility decision, not the access boundary — every screen's own API calls enforce who may
read or write what, regardless of which tabs the client renders.

## 2. Screens and features

### 2.1 Employee Feedback (`ParEmployeeFeedbackTab.tsx`)

The self-assessment for the current cycle (`ParInputForm.tsx`/`ParStatusView.tsx`/`EmployeePar.tsx`).

- **PENDING** (never started): a centered "Start" button, disabled once the deadline has passed.
- **DRAFT**: the form is shown directly — the cycle's configured question, then a rich-text answer
  (`ParRichTextField.tsx`), autosaving 1s after you stop typing. Save draft / Share buttons sit below;
  both stay visible and simply disable past the deadline rather than disappearing. Past the deadline,
  the field itself becomes read-only text instead of the editor, but the form and its buttons remain.
- **SHARED / SHARED_BLOCKED**: replaced by the finalized view (`ParRatingSummary.tsx`) — your
  submitted answer, your lead's rating/comment once *they've* shared (never before), and a PDF export
  of the record. An **Unshare** button reverts you to DRAFT so you can revise — offered only while
  your lead hasn't shared their side yet.

### 2.2 Request 360° Feedback (`ParRequestFeedbackTab.tsx`)

The reviewers you've asked (or your lead asked, on your behalf) this cycle — a plain list of
addresses, no status column (the backend hardcodes a placeholder status for your own reviewer list,
so a real column would just read "Unavailable" forever). A fixed "+" FAB opens the picker
(`Par360RequestDialog.tsx`): search-and-multi-select over the org, excluding yourself, your own lead,
and anyone already on the list. An info alert always shows the deadline; the FAB disables past it.

### 2.3 Provide 360° Feedback (`ParProvideFeedbackTab.tsx`)

Two sub-views, toggled by tabs with counts — **Requested Feedback** (someone asked you to review
them) and **Voluntary Feedback** (review someone who didn't ask). Each row is "Provide feedback" while
`PENDING`/`DRAFT`, or "View" once decided; the action disappears entirely past the deadline. A
voluntary request still `PENDING` once the deadline passes shows "Abandoned" instead of a status chip.
A fixed "+" FAB (Voluntary tab only) opens the offer picker (`Par360OfferDialog.tsx`): anyone in the
cycle, minus yourself and anyone already requesting/requested, confirmed before it's recorded.

Giving a review (`Par360ReviewDialog.tsx`, shared by both sub-views): the cycle's configured question
and rating scale, a rich-text comment, autosaving 5s after you stop typing. Share and Decline are both
behind their own confirmation dialog (irreversible once recorded). Declining asks for a reason instead
of a rating. Voluntary/offered reviews hide Decline — there was no request to decline.

### 2.4 History (`ParHistoryTab.tsx`)

Past (closed) cycles, in a table — click one to see that cycle's record (the same read-only summary
as Employee Feedback's finalized view, including the PDF export). A standing notice explains that
history is only available from 2024 H2 onward.

## 3. Business rules

1. **Deadlines** are per-field on the cycle (`parEmployeeDeadline`, `parThreeSixtyRatingDeadline`) and
   evaluated as end-of-day in the browser's own timezone. Every screen disables rather than hides its
   actions once passed, except Provide 360°'s per-row action, which the source hides entirely.
2. **Comments are rich text**, base64-of-URI-encoded on the wire (the backend rejects anything else),
   sanitized through the same DOMPurify allowlist on both save and render.
3. **The finalized summary only ever shows once your own status is SHARED/SHARED_BLOCKED.** A lapsed
   but never-shared draft stays the (now read-only) form — never the PDF-downloadable summary.
4. **Lead's feedback (rating, special rating, comment) is only visible once actually shared** — its
   presence in the response *is* the signal; the backend omits it entirely until then.
5. **Unshare** is offered only while your own status is SHARED and your lead's is not, and never past
   the deadline.
6. **PAR-rating and special-rating codes are mapped to display text** (`TOP5P` → "Top 5%", `NOT_ASSIGNED`
   → "Not Assigned", etc. — `util/parLabels.ts`) on screen, but *not* in the PDF export, which writes a
   real code raw and only substitutes text for the placeholder — matching the source's own PDF exactly
   rather than "improving" on it.

## 4. API contract

All requests carry the signed-in user's bearer token plus `x-user-timezone-offset`
(`digiopsHeaders()`); base URL is `ONE_WSO2_PAR_BACKEND_URL`.

| Endpoint | Purpose |
|---|---|
| `GET /employees/{workEmail}` | `leadEmail` — drives the tab-set gate |
| `GET /par-cycles?email=&status=` | The caller's OPEN or CLOSED cycles |
| `GET /par-cycles/{id}/employees/{email}/par-ratings` | Own rating record for a cycle |
| `PATCH .../par-ratings/{id}` | Save draft / share / unshare (self-editable fields only — backend enforces this) |
| `GET/POST .../employees/{email}/reviewers` | Reviewers you've named (GET), add more (POST) |
| `GET .../employees/{email}/review-requests` | Requests waiting on you as a reviewer |
| `GET/PATCH .../employees/{email}/review` | Your review of one employee — draft, share, decline |
| `GET /par-cycles/{id}/participants` | Cycle-scoped name+email list, for the voluntary-offer picker |
| `GET /par-cycles/{id}/teams?leadEmail=` | Every team a lead owns (team picker) |
| `GET /par-cycles/{id}/teams/{teamId}` | One team's roster |
| `PATCH /reminders/schedule-360-reminders` | No body; sends 360° reminders to the calling lead's own reports |
| `GET /par-cycles/{id}/special-rating-groups-quota?leadEmail=` | The calling lead's Top 5%/20% quota allocations |

## 5. Test checklist

- [ ] An employee with a lead sees all four tabs; one without sees only Provide 360° and History.
- [ ] Employee Feedback: PENDING shows a disabled-after-deadline Start button; DRAFT shows the form;
      typing autosaves after 1s with a "Draft saved" flash; Save/Share disable but don't hide past the
      deadline; Share opens a confirmation naming your lead.
- [ ] Once shared, the finalized view shows your answer, your lead's rating/comment (only once *they*
      share), and a working PDF download.
- [ ] Unshare is visible only while your status is SHARED and your lead's isn't; using it returns you
      to an editable draft.
- [ ] Request 360°: the picker excludes yourself, your own lead, and existing reviewers; the FAB
      disables past the deadline.
- [ ] Provide 360°: Requested/Voluntary tabs show correct counts; a lapsed voluntary PENDING request
      reads "Abandoned"; declining requires a reason and a confirmation; offering voluntary feedback
      excludes yourself and existing requests and asks for confirmation first.
- [ ] History: past cycles list, oldest data is explained by the notice, opening one shows the same
      read-only summary as a shared Employee Feedback record.
- [ ] Lead Portal is reachable only by a team lead in the active cycle; a non-lead is redirected away
      even by direct URL, and nobody sees a flash of the portal while the lookup is in flight.
- [ ] Direct Reports: a lead with one team skips the picker; bulk Share only enables when every
      selected row is DRAFT and reports pass/fail counts correctly; opening a member's review shows
      the exact Save Draft/Share rules (Share stays disabled until the employee's own status leaves
      PENDING).
- [ ] Top 5%/20% Allocation: rows group correctly by quota id; the search box highlights matches
      across every card; a 1/0 (Top 5%/Top 20%) quota shows "1" for both with the small-team warning.

## 6. Deviations from the source app

| # | Change | Why |
|---|---|---|
| 1 | No employee name or photo anywhere (reviewer lists, "Shared by", the voluntary picker, PDF headers) — email addresses stand in throughout. | No whole-org employee directory (name + thumbnail) is available to this app the way source's Redux `employeeMap` is; the correct par-app endpoints this port uses (`/participants`, `/reviewers`) don't carry one either. |
| 2 | No live numeric autosave countdown — a plain "Draft saved" / "Saving draft…" flash instead. | Cosmetic difference only; the autosave timing itself (1s / 5s) matches source exactly. |
| 3 | Tab bar is label-only, no per-tab icons. | The shared routed-tab type this app's tab bars use doesn't carry an icon field; a one-off addition just for PAR was reverted to keep that type consistent app-wide. |
| 4 | `parEmployeeAcceptanceStatus`/`parEmployeeAcceptanceComment` exist in the type but nothing sends them. | Matches source exactly — there is no accept/reject control anywhere in the running app despite the backend supporting the fields. |

## 8. Lead Portal

**Source of truth:** `views/leadPortal/LeadPortal.tsx` and its panels (`panels/LeadOngoingPanel.tsx`,
`panels/TeamSummary.tsx`, the lead-only path of `components/Review.tsx`/`LeadReviewPanel.tsx`,
`components/common/SpecialRatingAllocationView.tsx`), gated in source by `Role.TEAM_LEAD`
(`route.ts`, `/lead-portal`) — sourced from par-app's own `GET /employees/{email}`'s `isTeamLead`
field, which is scoped to the *active* PAR cycle (`isLeadInActiveParCycle`), not a standing role.

### 8.1 Direct Reports (`ParLeadDirectReportsTab.tsx`)

Ports `LeadOngoingPanel.tsx` + `MultiTeamSummary.tsx` (team picker; a lead with exactly one team skips
straight to it) and `TeamSummary.tsx` (`ParLeadTeamRoster.tsx` — one team's roster): completion cards,
member search, bulk **Share** (a client-side loop over the same per-record `PATCH`, matching source's
own `bulkUpdateParRatingOfEmployee` thunk — there is no real bulk endpoint), **Copy Emails**, and
**Send 360° Reminder**. Opening a member's row (`ParLeadReviewPanel.tsx`, the lead-only path of
`LeadReviewPanel.tsx`) gives rating + Top 5%/20% special-rating selection with its confirmation
checkbox, a rich-text lead comment with 5s autosave, deadline gating on `parLeadDeadline`, and the
exact Save Draft/Share enable rules (Share additionally waits for `parEmployeeStatus !== PENDING` —
the employee must have at least started their own side).

Not ported here: evidence attachments (`parPerformanceNoticeAck`'s Google Drive picker — a capability
nothing else in this app has), and every `isAdminAuditViewOn`/`isAdminHistoryViewOn`-gated branch
(force-edit-after-share, share-on-behalf-of-employee, admin comment) — those are Admin Portal, out of
scope for this portal. Also not ported: "Sync an Employee" (`TeamSummary.tsx`'s temporary
org-chart-search dialog for this cycle), and the "360 Reviews"/"F2F" sub-tabs `Review.tsx` also hosts
alongside "Lead's Feedback" (§8.6).

### 8.2 Top 5%/20% Allocation (`ParLeadAllocationTab.tsx`)

Ports `SpecialRatingAllocationView.tsx` (`isAdminView=false`): `GET
/par-cycles/{id}/special-rating-groups-quota?leadEmail=` returns one row per (business unit,
department, team) combination a quota group covers; rows sharing a `parQuotaId` are grouped
client-side into one card each, showing the quota name and Top 5%/Top 20% counts, with a search box
that highlights matching business-unit/department/team text across every card. A quota whose Top 5%
is 1 and Top 20% is 0 is a small-team special case — the Top 20% chip displays "1" too (not the real
0), alongside a warning explaining the pair represents one combined slot, not two.

## 9. Not yet ported

- **F2F scheduling** — a fifth tab of the Employee Portal in source (`F2fPanel.tsx`), needs the
  Google Calendar availability + Meet-booking integration, not wired to anything here yet.
- **Lead Portal — Additional Reports, Report Chain, Employee History** (`EmployeeReportView.tsx`,
  `ReportChainView.tsx`, `EmployeeHistoryView.tsx`) — planned for a follow-up PR once Direct Reports
  and Allocation (§8) have landed.
- **Lead Portal — evidence attachments and every Admin-only branch** of the Direct Reports review
  screen (see §8.1).
- **Admin Portal** — source's `/admin-portal` (`views/adminPortal/`): create/configure cycles, assign
  special-rating quotas, monitor org-wide completion, generate reports, send/schedule reminders, global
  configuration.
- **One unified "no cycle" state.** Source gates all four Employee Portal tabs behind a single check
  (`OngoingCycleView.tsx`) that replaces the whole tab body with one notice when there's no active
  cycle; this port instead repeats a similar (but not identically worded) message independently in
  each tab file (Employee Portal and Lead Portal alike). Functionally equivalent today, but worth
  consolidating the next time this area is touched rather than leaving further copies to drift.
