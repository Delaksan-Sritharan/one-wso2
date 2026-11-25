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

import { useState, type ReactNode } from "react";
import { Box, Skeleton, Stack, Typography, type Theme } from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { isPreviewEnabled } from "@config/previewFeatures";
import { useParEmployeeInfo, useParRating } from "../api/useParData";
import { useRequestReviewers, useReviewers } from "../api/usePar360";
import { useReviewCount } from "../api/useReview360";
import { cycleSurvey, useLeadership360Results, useLeadership360Surveys } from "../api/useLeadership360";
import { MIN_360_RESPONSES } from "../api/review360Types";
import type { ParCycle } from "../api/types";
import { Par360RequestPicker } from "./Par360RequestDialog";
import { isDeadlinePassed } from "../util/parDeadline";
import { progressBlue } from "../util/parProgressBlue";

// Your own 360° feedback in a PAR 2.0 cycle: everyone asked for feedback on you,
// by you or your lead, without saying who asked (who submitted, never what they
// wrote), and how many have come in against the 3 needed, feedback offered
// unasked too (only the number: who offered it isn't shown). While feedback can still
// be asked for, the calendar suggestions and the people search are always open
// above that list. Feedback offered unasked goes to your lead alone. A member sees
// no 360° scores: their lead's 360° summary comes with the lead's review. A member
// of the leadership team gets Leadership 360°, which can be anonymous: their list
// shows a named answer as Submitted but leaves an anonymous one at Requested, and
// `beforeRequests` holds their Leadership 360° results.
export default function Par360AboutMe({
  cycle,
  workEmail,
  beforeRequests,
}: {
  cycle: ParCycle;
  workEmail: string;
  beforeRequests?: ReactNode;
}) {
  const leadEmail = useParEmployeeInfo(workEmail).data?.leadEmail ?? undefined;
  const rating = useParRating(cycle.parCycleId, workEmail);
  const reviewers = useReviewers(cycle.parCycleId, workEmail);
  const requestReviewers = useRequestReviewers(cycle.parCycleId, workEmail);
  const leadShared = rating.data?.parLeadStatus === "SHARED";
  // As the tracker counts: Leadership 360° only with its preview on.
  const leader = Boolean(rating.data?.parIsLeadershipEmployee) && isPreviewEnabled("leadership360");
  // A leader's count is the responses to the cycle's Leadership 360° survey; anyone can give it unasked.
  const surveys = useLeadership360Surveys(leader);
  const leadershipResults = useLeadership360Results(
    leader ? cycleSurvey(surveys.data, cycle.parCycleId)?.surveyId : undefined,
    "SELF",
  );
  // A member's count includes feedback offered unasked, which their list leaves out.
  const counting = Boolean(rating.data) && !leader;
  const count = useReviewCount(cycle.parCycleId, workEmail, counting);
  // A new picker, empty, once a request goes through.
  const [requestsSent, setRequestsSent] = useState(0);

  const list = reviewers.data ?? [];
  // A count still loading, or that failed, isn't none: no total shows until it's in.
  const countLoading =
    rating.isLoading ||
    (counting && count.isLoading) ||
    (leader && (surveys.isLoading || leadershipResults.isLoading));
  // Without the PAR record there's no telling which count applies. One still loaded from before a
  // failed refetch is used as it is.
  const countQueries = !rating.data ? [rating] : counting ? [count] : leader ? [surveys, leadershipResults] : [];
  const countFailed = countQueries.find((q) => q.isError && q.data === undefined);
  const received = leader ? (leadershipResults.data?.[0]?.responseCount ?? 0) : (count.data?.received ?? 0);
  const deadlinePassed = isDeadlinePassed(cycle.parThreeSixtyRatingDeadline);
  const blocked = deadlinePassed || leadShared;

  return (
    <Stack spacing={2}>
      {beforeRequests}

      <Typography variant="body2" color="text.secondary">
        Invite colleagues who have worked closely with you during this review cycle to share feedback on your
        contributions, collaboration and areas for development. You are required to receive feedback from at least{" "}
        {MIN_360_RESPONSES} colleagues to complete this section.
      </Typography>
      <Box sx={{ display: "flex", alignItems: "baseline", columnGap: 1.5, rowGap: 0.5, flexWrap: "wrap" }}>
        <Typography sx={{ fontWeight: 600 }}>Feedback requests</Typography>
        {!countLoading && !countFailed && (
          <Typography variant="body2" color="text.secondary">
            {/* Past the minimum, "5 of 3" would read wrong: only the number shows. */}
            <Count n={received} />
            {received < MIN_360_RESPONSES && (
              <>
                {" "}
                of <Count n={MIN_360_RESPONSES} />
              </>
            )}{" "}
            feedback responses received
          </Typography>
        )}
      </Box>
      {countFailed && (
        <ErrorNotice error={countFailed.error} onRetry={() => countFailed.refetch()} retrying={countFailed.isFetching}>
          Couldn't load how much feedback you've received.
        </ErrorNotice>
      )}
      {!blocked && (
        <Box>
          <Par360RequestPicker
            key={requestsSent}
            open
            activeCycle
            selfEmail={workEmail}
            leadEmail={leadEmail}
            existingEmails={list.map((r) => r.reviewerEmail)}
            onSubmit={(reviewerEmails) =>
              requestReviewers.mutate({ reviewerEmails }, { onSuccess: () => setRequestsSent((n) => n + 1) })
            }
            isSubmitting={requestReviewers.isPending}
            error={requestReviewers.error ?? undefined}
            parCycleId={cycle.parCycleId}
          />
        </Box>
      )}
      {reviewers.isLoading ? (
        <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1 }} />
      ) : reviewers.isError ? (
        <ErrorNotice error={reviewers.error} onRetry={() => reviewers.refetch()} retrying={reviewers.isFetching}>
          Couldn't load your reviewers.
        </ErrorNotice>
      ) : (
        // Nothing when no one is asked yet: the count above says so.
        list.length > 0 && (
          <Stack component="ul" spacing={1} sx={{ m: 0, p: 0, listStyle: "none" }}>
            {list.map((r) => (
              <RequestRow key={r.reviewerEmail} name={r.reviewerName ?? r.reviewerEmail}>
                {/* The employee doesn't see drafts: a started one is still Requested. For a leader, only
                    a named answer is Submitted: an anonymous one leaves the request at Requested. */}
                <StatePill
                  state={r.reviewStatus === "REJECTED" ? "declined" : r.reviewStatus === "SHARED" ? "submitted" : "requested"}
                />
              </RequestRow>
            ))}
          </Stack>
        )
      )}
    </Stack>
  );
}

// Someone asked for feedback: their initials, their name and where their feedback stands.
function RequestRow({ name, children }: { name: string; children: ReactNode }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <Box
      component="li"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        py: 1,
        pl: 1,
        pr: 1.5,
        border: 1,
        borderColor: "divider",
        borderRadius: "10px",
      }}
    >
      <Box
        aria-hidden
        sx={(theme) => ({
          width: 28,
          height: 28,
          borderRadius: "50%",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11.5,
          fontWeight: 700,
          color: palette(theme).primary.main,
          bgcolor: soft(palette(theme).primary.main),
        })}
      >
        {initials}
      </Box>
      <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
        {name}
      </Typography>
      {children}
    </Box>
  );
}

// Where a request stands, as a soft pill: Requested, Submitted or Declined.
function StatePill({ state }: { state: "requested" | "submitted" | "declined" }) {
  const label = { requested: "Requested", submitted: "Submitted", declined: "Declined" }[state];
  return (
    <Box
      component="span"
      sx={(theme) => {
        // Waiting for an answer is blue, as an In progress step. Submitted and Declined take their tone's darker
        // shade as text on a light surface, where the main shades are under 4.5:1.
        if (state === "requested") {
          const { colour: blue, light } = progressBlue(theme);
          return {
            ...PILL,
            color: blue,
            bgcolor: soft(blue),
            ...theme.applyStyles("light", { color: light, bgcolor: soft(light) }),
          };
        }
        const tone = ({ submitted: "success", declined: "error" } as const)[state];
        const colour = palette(theme)[tone].main;
        return {
          ...PILL,
          color: colour,
          bgcolor: soft(colour),
          ...theme.applyStyles("light", { color: theme.palette[tone].dark }),
        };
      }}
    >
      {label}
    </Box>
  );
}

const PILL = {
  flexShrink: 0,
  px: 1.25,
  py: 0.25,
  borderRadius: 999,
  fontSize: 12.5,
  fontWeight: 600,
  whiteSpace: "nowrap",
} as const;

// theme.palette holds the light scheme only; theme.vars follows the light/dark switch.
const palette = (theme: Theme) => (theme.vars ?? theme).palette;
const soft = (colour: string) => `color-mix(in srgb, ${colour} 14%, transparent)`;

// A number in the count line: the same text, a little darker and bolder, so it reads at a glance.
function Count({ n }: { n: number }) {
  return (
    <Box component="b" sx={{ color: "text.primary", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
      {n}
    </Box>
  );
}
