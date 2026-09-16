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

// Reads from the email-group-manager backend. Three plain `string[]`
// endpoints — default groups, the full catalog, and the caller's own
// memberships — combined client-side into the GroupCatalog the page renders;
// see util/groupCatalog.ts for the derivation.

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { emailGroupsServiceUrls, isEmailGroupsBackendConfigured } from "@config/apiConfig";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { buildGroupCatalog } from "../util/groupCatalog";
import { emailGroupRetry } from "../util/emailGroupError";
import type { GroupCatalog } from "./emailGroupTypes";

export { isEmailGroupsBackendConfigured };

/** Everything every query here needs, gathered once. */
function useEmailGroupsQueryBasis() {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const ready = isSignedIn && isEmailGroupsBackendConfigured() && Boolean(userSub);
  return { getAccessToken, subState, retryIdentity, userSub, ready };
}

function useGroupNamesQuery(key: string, url: string) {
  const { getAccessToken, subState, retryIdentity, userSub, ready } = useEmailGroupsQueryBasis();
  const query = useQuery<string[]>({
    queryKey: [key, userSub],
    enabled: ready,
    queryFn: async () => authedGet<string[]>(url, await getAccessToken()),
    staleTime: 5 * 60 * 1000,
    // The list of names the caller belongs to is the one that should feel
    // current on returning to the page — the app-wide client's
    // `refetchOnMount: false` would otherwise leave a stale membership list
    // showing after a subscribe/unsubscribe made from elsewhere (or from a
    // second tab).
    refetchOnMount: key === "email-groups-user",
    retry: emailGroupRetry,
  });
  return foldIdentityError(query, subState, retryIdentity);
}

/** Groups every employee is in automatically. Rarely changes — cached longer. */
export function useDefaultGroups() {
  return useGroupNamesQuery("email-groups-default", emailGroupsServiceUrls.defaultGroups);
}

/** The full subscribable directory. */
export function useAllGroups() {
  return useGroupNamesQuery("email-groups-all", emailGroupsServiceUrls.allGroups);
}

/** The caller's own current memberships. */
export function useUserGroups() {
  return useGroupNamesQuery("email-groups-user", emailGroupsServiceUrls.userGroups);
}

/**
 * The three queries above, combined into the shape the page renders.
 *
 * `isLoading` is true until all three have a first answer — the catalog is
 * meaningless with any one of them missing (an unsubscribed catalog group
 * looks identical to a subscribed one before `userGroups` has loaded). Each
 * query keeps its own `isError`/`refetch` so the page can retry only the one
 * that actually failed.
 */
export function useEmailGroupCatalog() {
  const defaultGroups = useDefaultGroups();
  const allGroups = useAllGroups();
  const userGroups = useUserGroups();

  const catalog = useMemo<GroupCatalog | undefined>(() => {
    if (!defaultGroups.data || !allGroups.data || !userGroups.data) return undefined;
    return buildGroupCatalog(defaultGroups.data, allGroups.data, userGroups.data);
  }, [defaultGroups.data, allGroups.data, userGroups.data]);

  return {
    catalog,
    isLoading: defaultGroups.isPending || allGroups.isPending || userGroups.isPending,
    isFetching: defaultGroups.isFetching || allGroups.isFetching || userGroups.isFetching,
    defaultGroups,
    allGroups,
    userGroups,
  };
}
