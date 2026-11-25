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
import { Alert, Autocomplete, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, TextField, Typography } from "@wso2/oxygen-ui";
import { PencilIcon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useChangeTeamLead, useDirectorySearch } from "../api/useProcurement";
import { MIN_DIRECTORY_QUERY } from "../request-form/requestFormModel";
import type { Person, PurchaseRequest } from "../types";

const personLabel = (person: Person): string => `${person.name} (${person.email})`;

/** The pop-up for naming another team lead. Saving emails both the current team lead and the new one. */
function TeamLeadForm({ request, onClose }: { request: PurchaseRequest; onClose: () => void }) {
  const change = useChangeTeamLead(request.id);
  const { showSuccess } = useNotifications();
  const [chosen, setChosen] = useState<Person | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  // Only leads can approve, so only leads are offered.
  const search = useDirectorySearch(query, true);
  // The backend does not take the requester, the team lead the request has, or an additional approver.
  const refused = new Set([request.requester.email, request.teamLead?.email ?? "", ...request.additionalApprovers].map((email) => email.toLowerCase()));
  const options = [...(search.data ?? []), ...(chosen ? [chosen] : [])].filter(
    (person, index, all) => all.findIndex((other) => other.email.toLowerCase() === person.email.toLowerCase()) === index,
  );
  const save = () => {
    if (!chosen) return;
    change.mutate(chosen.email, {
      onSuccess: () => {
        showSuccess(`Team lead changed to ${chosen.name}. Both team leads have been notified by email.`);
        onClose();
      },
    });
  };

  return (
    <>
      <DialogTitle>Change team lead</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {request.teamLead ? `The request is with ${personLabel(request.teamLead)}. ` : ""}Name another team lead to decide on it instead.
        </DialogContentText>
        <Autocomplete
          size="small"
          // The list opens only once there is something to search for, so clicking the empty box shows nothing.
          open={open && query.trim().length >= MIN_DIRECTORY_QUERY}
          onOpen={() => setOpen(true)}
          onClose={() => setOpen(false)}
          options={options}
          value={chosen}
          disabled={change.isPending}
          loading={search.isFetching}
          getOptionLabel={personLabel}
          isOptionEqualToValue={(a, b) => a.email.toLowerCase() === b.email.toLowerCase()}
          getOptionDisabled={(person) => refused.has(person.email.toLowerCase())}
          filterOptions={(all) => all}
          noOptionsText="No matching team lead"
          onChange={(_, next) => {
            setChosen(next);
            if (!change.isPending) change.reset();
          }}
          onInputChange={(_, next, reason) => setQuery(reason === "input" ? next : "")}
          renderInput={(params) => <TextField {...params} label="New team lead" placeholder="Search by email" />}
        />
        {search.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {describeError(search.error)}
          </Alert>
        )}
        {chosen && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
            {request.teamLead ? `${request.teamLead.name} and ` : ""}
            {chosen.name} will be notified by email when you save.
          </Typography>
        )}
        {change.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {describeError(change.error)}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button color="inherit" disabled={change.isPending} onClick={onClose}>
          Cancel
        </Button>
        <Button variant="contained" disabled={change.isPending || !chosen} onClick={save}>
          {change.isPending ? "Saving…" : "Save team lead"}
        </Button>
      </DialogActions>
    </>
  );
}

/**
 * A pencil on the Requester card that opens a pop-up for naming another team lead. It shows only to the requester,
 * and only while the request waits for its first decision, which is when the backend takes the change.
 *
 * @param me - Email of the signed-in user
 */
export default function TeamLeadEdit({ request, me }: { request: PurchaseRequest; me: string }) {
  const [open, setOpen] = useState(false);
  const canChange =
    request.requester.email.toLowerCase() === me.toLowerCase() && request.status === "submitted" && request.teamLeadDecision.decision === "pending";
  if (!canChange) return null;
  return (
    <>
      <IconButton size="small" aria-label="Change team lead" onClick={() => setOpen(true)}>
        <PencilIcon size={16} />
      </IconButton>
      {open && (
        <Dialog open fullWidth maxWidth="sm" onClose={() => setOpen(false)}>
          <TeamLeadForm request={request} onClose={() => setOpen(false)} />
        </Dialog>
      )}
    </>
  );
}
