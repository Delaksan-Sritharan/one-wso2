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

import { useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { describeError } from "@api/errors";
import { useOfferToReview, useParticipants } from "../api/usePar360";
import { useOwnReports } from "../api/useLeadTeams";
import type { ParCycle } from "../api/types";
import type { Leadership360CurrentSurvey, Leadership360Leader } from "../api/leadership360Types";
import {
  pickableForNewFeedback,
  pickerPeople,
  type GiveFeedbackItem,
  type PickerPerson,
} from "../util/par360Feedback";
import { isDeadlinePassed } from "../util/parDeadline";

export type FeedbackStart =
  // `offered`: nobody asked you.
  | { kind: "PAR"; email: string; name: string; offered?: boolean }
  | { kind: "LEADERSHIP"; leader: Leadership360Leader };

// Provide Feedback's person search, on the tab itself as on the Active cycle's 360° step: everyone in the
// cycle and the leadership team, except a lead's own reports, whose feedback goes in the lead's review.
// Picking someone starts it. Who they are decides the form: Leadership 360° for a member of the leadership
// team, PAR feedback for anyone else. PAR feedback nobody asked for is an offer, confirmed first, since it
// adds you to their reviewers.
export default function Par360GiveFeedbackPicker({
  workEmail,
  cycle,
  held = false,
  workedWith,
  survey,
  leaders,
  items,
  disabled = false,
  onStart,
}: {
  workEmail: string;
  cycle: ParCycle;
  /** No cycle is taking feedback: it's held for the next one. */
  held?: boolean;
  /** Your lead, who asked you and who you asked: listed first. */
  workedWith: (string | null | undefined)[];
  /** The open Leadership 360° survey, if any. */
  survey?: Leadership360CurrentSurvey;
  /** The leadership team. */
  leaders: Leadership360Leader[];
  /** Your Provide Feedback list, for where you are with each leader. */
  items: GiveFeedbackItem[];
  /** While the list or the leadership team is still loading, or the leadership team couldn't be. */
  disabled?: boolean;
  onStart: (start: FeedbackStart) => void;
}) {
  const [person, setPerson] = useState<PickerPerson | null>(null);
  const [confirming, setConfirming] = useState(false);
  const participants = useParticipants(cycle.parCycleId);
  const offer = useOfferToReview(cycle.parCycleId, workEmail);
  const ownReports = useOwnReports(workEmail, cycle.parCycleId, held);
  const parClosed = isDeadlinePassed(cycle.parThreeSixtyRatingDeadline);
  const leaderByEmail = useMemo(() => new Map(leaders.map((l) => [l.workEmail.toLowerCase(), l])), [leaders]);

  const people = useMemo(() => {
    const byEmail = new Map<string, { email: string; name: string; jobRole?: string | null }>();
    for (const p of participants.data ?? []) {
      byEmail.set(p.workEmail.toLowerCase(), { email: p.workEmail, name: p.employeeName });
    }
    for (const l of leaders) {
      byEmail.set(l.workEmail.toLowerCase(), { email: l.workEmail, name: l.employeeName, jobRole: l.jobRole });
    }
    return pickerPeople({
      selfEmail: workEmail,
      people: [...byEmail.values()].filter(
        (p) =>
          pickableForNewFeedback(p.email, items) &&
          (leaderByEmail.has(p.email.toLowerCase()) || !ownReports.emails.has(p.email.toLowerCase())),
      ),
      workedWith,
    });
  }, [participants.data, leaders, leaderByEmail, ownReports.emails, workEmail, workedWith, items]);

  const isLeader = (p: PickerPerson) => leaderByEmail.has(p.email.toLowerCase());
  // Everyone else listed is someone nobody asked you about: PAR 360° feedback for them is an offer,
  // and none can be offered once the 360° deadline has passed.
  const options = people.filter((p) => isLeader(p) || !parClosed);

  // What to say next to a leader. They stay listed after feedback (named feedback can be given again).
  const labelOf = (p: PickerPerson): string | undefined => {
    if (!isLeader(p)) return undefined;
    if (!survey) return "Leadership 360° closed";
    const given = items.some(
      (i) => i.kind === "LEADERSHIP" && i.state === "submitted" && i.email.toLowerCase() === p.email.toLowerCase(),
    );
    return given ? "Leadership 360° · Submitted" : "Leadership 360°";
  };

  // The search is empty again whenever no one is being started.
  const reset = () => {
    setConfirming(false);
    setPerson(null);
  };

  const choose = (p: PickerPerson | null) => {
    offer.reset();
    if (!p) return reset();
    const leader = leaderByEmail.get(p.email.toLowerCase());
    if (leader) {
      reset();
      onStart({ kind: "LEADERSHIP", leader });
    } else {
      setPerson(p);
      setConfirming(true);
    }
  };

  return (
    <Stack spacing={1}>
      {/* The leadership team stays listed when the cycle's people can't be loaded. */}
      {participants.error && (
        <Alert severity="error">Couldn't load people to choose from. {describeError(participants.error)}</Alert>
      )}
      {/* Until a lead's own reports are known one of them could be picked, so the search waits for them. */}
      <Autocomplete
        size="small"
        options={options}
        loading={participants.isLoading || ownReports.isLoading}
        disabled={disabled || ownReports.isLoading}
        value={person}
        onChange={(_e, p) => choose(p)}
        groupBy={(p) => (p.suggested ? "People you work with" : "Everyone")}
        getOptionLabel={(p) => p.name}
        getOptionDisabled={(p) => isLeader(p) && !survey}
        isOptionEqualToValue={(a, b) => a.email === b.email}
        renderOption={(props, p) => {
          const label = labelOf(p);
          return (
            <li {...props} key={p.email}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2">{p.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {p.jobRole ?? p.email}
                  </Typography>
                </Box>
                {label && (
                  <Typography variant="caption" color="text.secondary">
                    {label}
                  </Typography>
                )}
              </Box>
            </li>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="Search people"
            slotProps={{ htmlInput: { ...params.inputProps, "aria-label": "Search people" } }}
          />
        )}
        noOptionsText="No one found"
      />
      <Typography variant="caption" color="text.secondary">
        For a member of the leadership team it's Leadership 360° feedback,{" "}
        {held ? "with your name, counting toward their next PAR cycle" : "and you can stay anonymous"}. For anyone else
        it's PAR 360° feedback, which their lead reads with your name. People already in your list aren't shown here:
        respond to them or continue there.
      </Typography>

      {/* Stays open while an offer is being made: the feedback form opens from here once it's made. */}
      <Dialog open={confirming && person !== null} onClose={() => !offer.isPending && reset()} maxWidth="sm" fullWidth>
        <DialogTitle>Provide Feedback</DialogTitle>
        <DialogContent>
          {person && (
            <Stack spacing={2} sx={{ pt: 0.5 }}>
              <Typography variant="body2">
                {held
                  ? `Offer feedback for ${person.name}? They didn't ask you. It counts toward their next PAR cycle, and their lead reads your answers with your name.`
                  : `Offer feedback for ${person.name}'s ${cycle.parCycleName} PAR? They didn't ask you. Their lead reads your answers with your name.`}
              </Typography>
              {offer.isError && <Alert severity="error">{describeError(offer.error)}</Alert>}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={reset} disabled={offer.isPending}>
            Back
          </Button>
          <Button
            variant="contained"
            disabled={offer.isPending || !person}
            onClick={() =>
              person &&
              offer.mutate(
                { employeeEmail: person.email },
                {
                  onSuccess: () => {
                    reset();
                    onStart({ kind: "PAR", email: person.email, name: person.name, offered: true });
                  },
                },
              )
            }
          >
            {offer.isPending ? "Offering…" : "Offer feedback"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
