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

// Who can do what in Echo, decided against meet-app's OWN privilege numbers
// rather than the four One WSO2 capabilities derived from people-app. Same
// arrangement as useFinanceGate and useLeaveGate: `requires` in the registry is
// a coarse hint, and this is the real answer.
//
// Nothing here is access control. The meet-app backend enforces every rule
// below on its own — it refuses a cancellation from anyone who is neither the
// host nor an admin, and answers 403 on every endpoint for a caller in no
// authorised group. This exists so the UI doesn't offer an action that is going
// to be refused, which is a courtesy, not a control.

import { useMemo } from "react";
import { REVOPS_PRIVILEGE, type Meeting } from "./revOpsTypes";
import { useRevOpsUserInfo } from "./useRevOpsData";

export interface RevOpsGate {
  /** True once /user-info has answered, either way. */
  isResolved: boolean;
  /** meet-app ADMIN (privilege 762). */
  isAdmin: boolean;
  /** The signed-in caller's work email, for the host comparison. */
  workEmail: string | null;
  /** Whether this caller may cancel this meeting. */
  canCancel: (meeting: Meeting) => boolean;
}

export function useRevOpsGate(): RevOpsGate {
  const { data, isLoading } = useRevOpsUserInfo();

  return useMemo(() => {
    const privileges = data?.privileges ?? [];
    const isAdmin = privileges.includes(REVOPS_PRIVILEGE.ADMIN);
    const workEmail = data?.workEmail ?? null;

    return {
      isResolved: !isLoading,
      isAdmin,
      workEmail,
      // Three conditions, all from the standalone app and all still true of the
      // backend:
      //   - a cancelled meeting cannot be cancelled again;
      //   - a meeting that has already happened cannot be called off;
      //   - and you must be its host, or an admin.
      //
      // `timeStatus` is the server's own verdict rather than a comparison
      // against the browser clock, so a tab left open overnight cannot start
      // offering to cancel yesterday's meetings.
      //
      // Fails CLOSED while /user-info is still in flight or has failed: with no
      // identity there is no host to match and no admin flag, so the action is
      // hidden rather than offered and then refused.
      canCancel: (meeting: Meeting): boolean => {
        if (meeting.meetingStatus === "CANCELLED") return false;
        if (meeting.timeStatus === "PAST") return false;
        if (isAdmin) return true;
        return Boolean(workEmail) && meeting.host === workEmail;
      },
    };
  }, [data, isLoading]);
}
