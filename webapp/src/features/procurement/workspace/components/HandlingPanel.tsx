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
import { Alert, Autocomplete, Box, Button, Chip, Stack, TextField, Typography } from "@wso2/oxygen-ui";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import {
  useAddCollaborator,
  useAssignRequest,
  useDirectorySearch,
  useProcurementTeam,
  useRemoveCollaborator,
  useSetPriority,
  useUnassignRequest,
} from "../../api/useProcurement";
import { OptionField, SelectField } from "../../request-form/formFields";
import { MIN_DIRECTORY_QUERY } from "../../request-form/requestFormModel";
import type { Person, Priority, PurchaseRequest } from "../../types";
import { raisedOrApproves } from "../handlingAccess";

const PRIORITIES: Priority[] = ["P1", "P2", "P3"];
const PRIORITY_LABELS: Record<Priority, string> = { P1: "P1 — High", P2: "P2 — Medium", P3: "P3 — Normal" };

/** The most collaborators the backend keeps on a request. */
const MAX_COLLABORATORS = 20;

const personLabel = (person: Person): string => `${person.name} (${person.email})`;
const fromEmail = (email: string): Person => ({ id: email, name: email, email });

/** Where the Procurement team sets who handles an approved request, how urgent it is, and who else may read it. */
export default function HandlingPanel({ request, me }: { request: PurchaseRequest; me: string }) {
  const assign = useAssignRequest(request.id);
  const unassign = useUnassignRequest(request.id);
  const setPriority = useSetPriority(request.id);
  const addCollaborator = useAddCollaborator(request.id);
  const removeCollaborator = useRemoveCollaborator(request.id);
  const team = useProcurementTeam();
  const { showSuccess } = useNotifications();
  // Who is picked in Assignee and not assigned yet: assigning sends an email, so it waits for the Assign button.
  const [chosen, setChosen] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const search = useDirectorySearch(query, false);
  const mutations = [assign, unassign, setPriority, addCollaborator, removeCollaborator];
  const failure = mutations.find((m) => m.isError);
  const saving = mutations.some((m) => m.isPending);
  const mine = request.assignee.toLowerCase() === me.toLowerCase();
  // The backend does not let the requester or an approver of a request handle it.
  const own = raisedOrApproves(request, me);
  const busy = saving || own;
  // The backend does not give a request to the people who raised or approve it.
  const refused = new Set([request.requester.email, request.teamLead?.email ?? "", ...request.additionalApprovers].map((email) => email.toLowerCase()));
  const candidates = (team.data ?? [])
    .filter((person) => !refused.has(person.email.toLowerCase()))
    .map((person) => ({ value: person.email, label: personLabel(person) }));
  // Kept the same array between renders: the search box would otherwise take each render for a new value and clear what was typed.
  const nameOf = (email: string): string => (team.data ?? []).find((p) => p.email.toLowerCase() === email.toLowerCase())?.name ?? email;
  const pending = chosen !== "" && chosen.toLowerCase() !== request.assignee.toLowerCase();
  const collaborators = useMemo(() => request.collaborators.map(fromEmail), [request.collaborators]);
  const full = collaborators.length >= MAX_COLLABORATORS;
  const options = [...(search.data ?? []), ...collaborators].filter(
    (person, index, all) => all.findIndex((other) => other.email.toLowerCase() === person.email.toLowerCase()) === index,
  );
  // Only the action just taken can show a failure: an earlier action's message is cleared when another starts.
  const start = (current: (typeof mutations)[number], run: () => void) => {
    mutations.filter((m) => m !== current).forEach((m) => m.reset());
    run();
  };
  const assignChosen = () =>
    start(assign, () =>
      assign.mutate(chosen, {
        onSuccess: () => {
          setChosen("");
          showSuccess(`Request assigned to ${nameOf(chosen)}. An email notification has been sent to them and the requester.`);
        },
      }),
    );
  const assignToMe = () =>
    start(assign, () =>
      assign.mutate(undefined, { onSuccess: () => showSuccess("You are now assigned to this request. The requester has been notified by email.") }),
    );
  const unassignRequest = () =>
    start(unassign, () => unassign.mutate());
  const changePriority = (priority: Priority) =>
    start(setPriority, () => setPriority.mutate(priority));
  const changeCollaborators = (next: Person[]) => {
    const has = (list: Person[], person: Person) => list.some((other) => other.email.toLowerCase() === person.email.toLowerCase());
    const added = next.find((person) => !has(collaborators, person));
    const removed = collaborators.find((person) => !has(next, person));
    if (added) {
      start(addCollaborator, () => addCollaborator.mutate(added.email, { onSuccess: () => showSuccess(`${added.email} has been added as a collaborator on this request.`) }));
    } else if (removed) {
      start(removeCollaborator, () =>
        removeCollaborator.mutate(removed.email, { onSuccess: () => showSuccess(`${removed.email} has been removed as a collaborator from this request.`) }),
      );
    }
  };

  return (
    <Stack spacing={2} sx={{ p: 2.5, border: 1, borderColor: "divider", borderRadius: 1.5 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ pb: 1.5, borderBottom: 1, borderColor: "divider" }}>
        <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
          Assignment
        </Typography>
        <Chip size="small" variant="outlined" color={request.status === "assigned" ? "success" : "warning"} label={request.status === "assigned" ? "Assigned" : "Unassigned"} />
      </Stack>
      {own && <Alert severity="info">You raised or approve this request, so you can't handle it.</Alert>}
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "minmax(0, 1fr) minmax(0, 2fr) auto" } }}>
        <SelectField
          label="Priority"
          placeholder="Select priority"
          options={PRIORITIES}
          labels={PRIORITY_LABELS}
          value={request.priority ?? ""}
          disabled={busy}
          onChange={(priority) => changePriority(priority as Priority)}
        />
        <OptionField
          label="Assignee"
          placeholder={team.isLoading ? "Loading…" : "Not assigned"}
          emptyText="No Procurement team members"
          choices={candidates}
          value={chosen || request.assignee}
          disabled={busy || team.isError}
          onChange={setChosen}
        />
        <Button variant="contained" disabled={busy || !pending} onClick={assignChosen} sx={{ alignSelf: "end", height: 40 }}>
          Assign
        </Button>
      </Box>
      {pending && (
        <Typography variant="caption" color="text.secondary">
          {nameOf(chosen)} and the requester will be notified by email when you press Assign.
        </Typography>
      )}
      {team.isError && (
        <Alert
          severity="warning"
          action={
            <Button color="inherit" size="small" onClick={() => void team.refetch()}>
              Retry
            </Button>
          }
        >
          The Procurement team could not be loaded. {describeError(team.error)}
        </Alert>
      )}
      <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
        {!mine && !own && (
          <Button variant="contained" disabled={busy} onClick={assignToMe}>
            {request.assignee ? "Take over" : "Assign to me"}
          </Button>
        )}
        {request.status === "assigned" && (
          <Button color="inherit" variant="outlined" disabled={busy} onClick={unassignRequest}>
            Unassign
          </Button>
        )}
      </Stack>
      <Stack spacing={0.5}>
        <Typography variant="body2" color="text.secondary">
          Collaborators
        </Typography>
        <Autocomplete
          multiple
          filterSelectedOptions
          forcePopupIcon={false}
          size="small"
          // The list opens only once there is something to search for, so clicking the empty box shows nothing.
          open={open && query.trim().length >= MIN_DIRECTORY_QUERY}
          onOpen={() => setOpen(true)}
          onClose={() => setOpen(false)}
          options={options}
          value={collaborators}
          disabled={busy}
          loading={search.isFetching}
          getOptionLabel={(person) => person.email}
          renderOption={(props, person) => (
            <li {...props} key={person.email}>
              {person.name === person.email ? person.email : personLabel(person)}
            </li>
          )}
          isOptionEqualToValue={(a, b) => a.email.toLowerCase() === b.email.toLowerCase()}
          getOptionDisabled={(person) => full && !collaborators.some((c) => c.email === person.email)}
          filterOptions={(all) => all}
          noOptionsText={full ? `A request has at most ${MAX_COLLABORATORS} collaborators` : "No matching employee"}
          onChange={(_, next) => changeCollaborators(next)}
          onInputChange={(_, next, reason) => setQuery(reason === "input" ? next : "")}
          renderTags={(value, getTagProps) =>
            value.map((person, index) => {
              const { key, ...tag } = getTagProps({ index });
              return <Chip key={key} size="small" variant="outlined" label={person.email} {...tag} />;
            })
          }
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder={collaborators.length ? "" : "Search by email"}
              slotProps={{ htmlInput: { ...params.inputProps, "aria-label": "Collaborators" } }}
            />
          )}
        />
        {search.isError && <Alert severity="error">{describeError(search.error)}</Alert>}
      </Stack>
      {failure && <Alert severity="error">{describeError(failure.error)}</Alert>}
    </Stack>
  );
}
