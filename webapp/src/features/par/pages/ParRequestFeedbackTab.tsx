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

import { useState } from "react";
import { Alert, Box, Fab, Skeleton, Table, TableBody, TableCell, TableHead, TableRow, Tooltip } from "@wso2/oxygen-ui";
import { PlusIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useMeProfile } from "@features/my/api/useMeProfile";
import { formatDate } from "@features/my/api/derive";
import { useActiveParCycle, useParEmployeeInfo, useParRating } from "../api/useParData";
import { useReviewers, useRequestReviewers } from "../api/usePar360";
import Par360RequestDialog from "../components/Par360RequestDialog";
import ParEmptyState from "../components/ParEmptyState";
import { isDeadlinePassed } from "../util/parDeadline";

// People Ops → Performance → Request 360° Feedback: par-app's own tab name
// (OngoingCycleView.tsx's ParCycleViewTabs.REQUESTTHREESIXTYREVIEWS) — asks
// colleagues to review you. par-app's RequestFeedbackTab.tsx.
//
// No Status column: getPar360Reviewers hardcodes reviewStatus: SANITIZED
// for every row of your OWN reviewer list (manager.bal's `isSelf` branch),
// so it would show "Unavailable" on every row forever — the source
// (RequestFeedbackTab.tsx:122-137) renders no status column here at all.
export default function ParRequestFeedbackTab() {
  const profile = useMeProfile();
  const workEmail = profile.data?.userInfo.workEmail;
  // par-app's own leadEmail, not people-app's managerEmail — the two can
  // disagree (see useParHasLead).
  const leadEmail = useParEmployeeInfo(workEmail).data?.leadEmail ?? undefined;
  const activeCycles = useActiveParCycle(workEmail);
  const cycle = activeCycles.data?.[0];

  // RequestFeedbackTab.tsx:76 also blocks once the lead has shared their own
  // side (ratings.parLeadStatus === SHARED) — fetch the caller's own record
  // for that, same as the Employee Feedback tab already does.
  const rating = useParRating(cycle?.parCycleId, workEmail);
  const reviewers = useReviewers(cycle?.parCycleId, workEmail);
  const requestReviewers = useRequestReviewers(cycle?.parCycleId, workEmail);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);

  if (profile.isLoading || activeCycles.isLoading) {
    return <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 1.5, maxWidth: 880 }} />;
  }
  if (profile.isError) {
    return (
      <ErrorNotice error={profile.error} onRetry={() => profile.refetch()} retrying={profile.isFetching}>
        Couldn't load your profile.
      </ErrorNotice>
    );
  }
  if (activeCycles.isError) {
    return (
      <ErrorNotice error={activeCycles.error} onRetry={() => activeCycles.refetch()} retrying={activeCycles.isFetching}>
        Couldn't load your PAR cycle.
      </ErrorNotice>
    );
  }
  if (!cycle) {
    return <Alert severity="info">There's no PAR cycle open for you right now.</Alert>;
  }

  const deadlinePassed = isDeadlinePassed(cycle.parThreeSixtyRatingDeadline);
  // RequestFeedbackTab.tsx:76-84 — the lead-shared alert takes priority over
  // the deadline copy, and blocks the action even before the deadline.
  const leadShared = rating.data?.parLeadStatus === "SHARED";
  const blocked = deadlinePassed || leadShared;

  return (
    <Box sx={{ maxWidth: 880 }}>
      {/* RequestFeedbackTab.tsx:74-84 — exact wording, always info severity
          regardless of deadline (unlike ProvideFeedbackTab's own alert). */}
      <Alert severity="info" sx={{ mb: 1.5 }}>
        {leadShared
          ? "Lead has shared the PAR"
          : deadlinePassed
            ? `The deadline for requesting 360° feedback has passed on ${formatDate(cycle.parThreeSixtyRatingDeadline)}.`
            : `Please request feedback before the deadline: ${formatDate(cycle.parThreeSixtyRatingDeadline)}.`}
      </Alert>

      {reviewers.isLoading ? (
        <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1 }} />
      ) : reviewers.isError ? (
        <ErrorNotice error={reviewers.error} onRetry={() => reviewers.refetch()} retrying={reviewers.isFetching}>
          Couldn't load your reviewers.
        </ErrorNotice>
      ) : (reviewers.data ?? []).length === 0 ? (
        // RequestFeedbackTab.tsx:96 — NoDataView, not a generic Alert.
        <ParEmptyState text="No reviewers available" />
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(reviewers.data ?? []).map((r) => (
              <TableRow key={r.reviewerEmail}>
                <TableCell>{r.reviewerEmail}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Par360RequestDialog
        open={requestDialogOpen}
        onClose={() => setRequestDialogOpen(false)}
        selfEmail={workEmail}
        leadEmail={leadEmail}
        existingEmails={(reviewers.data ?? []).map((r) => r.reviewerEmail)}
        onSubmit={(emails) =>
          requestReviewers.mutate(emails, { onSuccess: () => setRequestDialogOpen(false) })
        }
        isSubmitting={requestReviewers.isPending}
        error={requestReviewers.error ?? undefined}
      />

      {/* RequestFeedbackTab.tsx:168-204 — a fixed FAB, not an inline button. */}
      <Box sx={{ position: "fixed", bottom: 100, right: 100, zIndex: 1000 }}>
        <Tooltip title={blocked ? "Action not available" : "Request Feedback"} arrow>
          <span>
            <Fab color="primary" disabled={blocked} onClick={() => setRequestDialogOpen(true)}>
              <PlusIcon />
            </Fab>
          </span>
        </Tooltip>
      </Box>
    </Box>
  );
}
