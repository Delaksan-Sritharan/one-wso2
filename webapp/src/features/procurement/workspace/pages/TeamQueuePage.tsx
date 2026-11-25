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
import { Link as RouterLink, useNavigate } from "react-router";
import {
  Alert,
  Button,
  Link,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import { describeError } from "@api/errors";
import FilterChips from "../../components/FilterChips";
import { RequestStatusChip } from "../../components/ProcurementChips";
import { useProcurementMe, useTeamQueue } from "../../api/useProcurement";
import { workspacePaths } from "../workspacePaths";
import type { RequestStatus } from "../../types";

const CATEGORY_LABEL = { IT: "IT", "NON-IT": "Non-IT", EVENTS: "Marketing & Events" } as const;
const ALL = "all";
const MINE = "mine";
type QueueView = typeof ALL | "approved" | "assigned" | typeof MINE;
const SHOWS: { value: QueueView; label: string }[] = [
  { value: ALL, label: "All" },
  { value: "approved", label: "Waiting to be assigned" },
  { value: "assigned", label: "Assigned" },
  { value: MINE, label: "Assigned to me" },
];

export default function TeamQueuePage() {
  const [show, setShow] = useState<QueueView>(ALL);
  const me = useProcurementMe();
  const mine = show === MINE;
  // "Assigned to me" needs the user's email, so it waits for it and the other chips do not.
  const queue = useTeamQueue(
    { status: show === ALL ? undefined : ((mine ? "assigned" : show) as RequestStatus), assignee: mine ? me.data?.email : undefined },
    !mine || Boolean(me.data),
  );
  const navigate = useNavigate();
  const waitingForMe = mine && !me.data && !me.isError;
  const identityFailed = mine && !me.data && me.isError;
  // Under "Assigned to me" with no identity yet, the query may still hold the rows of "Assigned", which are not the user's.
  const rows = mine && !me.data ? undefined : queue.data;

  return (
    <>
      <FilterChips label="Show" options={SHOWS} value={show} onChange={setShow} />
      {identityFailed && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => void me.refetch()}>
              Retry
            </Button>
          }
        >
          Your requests could not be found because who you are could not be read. {describeError(me.error)}
        </Alert>
      )}
      {!identityFailed && queue.isError && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => void queue.refetch()}>
              Retry
            </Button>
          }
        >
          {describeError(queue.error)}
        </Alert>
      )}
      {!identityFailed && (waitingForMe || (queue.isPending && !queue.isError)) && <Skeleton variant="rounded" height={200} />}
      {!identityFailed && rows && rows.length === 0 && <Typography color="text.secondary">No requests match</Typography>}
      {!identityFailed && rows && rows.length > 0 && (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Reference</TableCell>
                <TableCell>Request</TableCell>
                <TableCell>Requester</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Assigned to</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow
                  key={r.id}
                  hover
                  sx={{ cursor: "pointer" }}
                  onClick={(e) => {
                    if (!(e.target as HTMLElement).closest("a")) navigate(workspacePaths.request(r.id));
                  }}
                >
                  <TableCell>
                    <Link component={RouterLink} to={workspacePaths.request(r.id)} underline="none" sx={{ fontWeight: 500 }}>
                      {r.reference ?? "Draft"}
                    </Link>
                  </TableCell>
                  <TableCell sx={{ overflowWrap: "anywhere" }}>{r.title}</TableCell>
                  <TableCell sx={{ overflowWrap: "anywhere" }}>{r.requester.name}</TableCell>
                  <TableCell>{CATEGORY_LABEL[r.category]}</TableCell>
                  <TableCell>{r.priority ?? "Not set"}</TableCell>
                  <TableCell sx={{ overflowWrap: "anywhere" }}>{r.assignee || "Nobody"}</TableCell>
                  <TableCell>
                    <RequestStatusChip status={r.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </>
  );
}
