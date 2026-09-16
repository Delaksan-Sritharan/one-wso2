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

// Writes to the email-group-manager backend: PATCH one group at a time.
//
// The source app's own bulk actions looped client-side, firing the requests
// one after another and refreshing everything only once the whole batch had
// landed — same shape kept here, but as a `mutateAsync` loop the confirm
// dialog drives (see ConfirmGroupActionDialog), rather than baked into the
// mutation itself. That keeps each PATCH independently retryable/observable
// and the "how many groups" question entirely a caller concern.
//
// No retry: a 401/403 or a malformed group name is a final answer, not a
// transient one, and this is a caller-initiated write — retrying it silently
// risks a duplicate attempt against a backend with no idempotency key.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authedPatch } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { emailGroupsServiceUrls } from "@config/apiConfig";
import { useAsgardeoSub } from "@hooks/useAsgardeoSub";
import type { GroupSubscriptionPayload } from "./emailGroupTypes";

/** The user-groups query key for the signed-in subject. */
function useUserGroupsKey(): unknown[] {
  const { state } = useAsgardeoSub();
  return ["email-groups-user", state.status === "ready" ? state.sub : undefined];
}

export function useSubscribeToGroup() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  const userGroupsKey = useUserGroupsKey();
  return useMutation<void, Error, GroupSubscriptionPayload>({
    mutationFn: async (payload) => {
      await authedPatch<unknown>(emailGroupsServiceUrls.subscribe, await getAccessToken(), payload);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: userGroupsKey });
    },
  });
}

export function useUnsubscribeFromGroup() {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  const userGroupsKey = useUserGroupsKey();
  return useMutation<void, Error, GroupSubscriptionPayload>({
    mutationFn: async (payload) => {
      await authedPatch<unknown>(
        emailGroupsServiceUrls.unsubscribe,
        await getAccessToken(),
        payload,
      );
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: userGroupsKey });
    },
  });
}
