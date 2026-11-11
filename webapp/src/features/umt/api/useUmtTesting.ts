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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import { useAsgardeo } from "@asgardeo/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { httpRetry } from "@api/errors";
import { authedGet, authedPost, authedPut } from "@api/http";
import { isUmtBackendConfigured, umtServiceUrls } from "@config/apiConfig";
import { useAccessToken } from "@hooks/useAccessToken";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { UMT_TESTING_LIFECYCLE_STATES, umtShouldPollStagingTestResults } from "../lib/umtTesting";
import type { UmtLifecycleState } from "./umtTypes";
import type { UmtStagingTestResultRecord, UmtStagingTestResultRequest } from "./umtUpdates";

// When a retrigger was last accepted for an update, as epoch ms. It lives in
// the query cache so the results query, shared by the shell and the Testing
// step, can read what the retrigger mutation wrote.
const retriggeredAtKey = (id: string) => ["umt-staging-test-retriggered-at", id] as const;

// Shared by the shell (Proceed-gating) and UmtTestingStep (its own render) —
// same query key, so TanStack dedupes the fetch. Enabled only while
// lifecycleState is in the testing-state family; polls every 3s while
// umtShouldPollStagingTestResults is true (mirrors useUmtUpdate's
// existing polling precedent). That ends at Failed, and at Staging once no run
// is building and the post-retrigger window has passed.
// The key carries lifecycleState because the list fetched before Staging is
// empty: reaching Staging has to fetch it again.
export function useUmtStagingTestResults(id: string, lifecycleState: UmtLifecycleState | null | undefined) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const queryClient = useQueryClient();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const baseEnabled =
    /^\d+$/.test(id) && isSignedIn && isUmtBackendConfigured() && Boolean(userSub);
  const enabled =
    baseEnabled && (UMT_TESTING_LIFECYCLE_STATES as readonly (UmtLifecycleState | null | undefined)[]).includes(lifecycleState);

  const query = useQuery<UmtStagingTestResultRecord[]>({
    queryKey: ["umt-update-staging-test-results", userSub, id, lifecycleState],
    enabled,
    queryFn: async () =>
      authedGet<UmtStagingTestResultRecord[]>(
        umtServiceUrls.updateIntegrationTestStaging(id),
        await getAccessToken(),
      ),
    refetchInterval: (query) =>
      umtShouldPollStagingTestResults(
        lifecycleState,
        query.state.data,
        queryClient.getQueryData<number>(retriggeredAtKey(id)),
      )
        ? 3000
        : false,
    retry: httpRetry,
  });

  return foldIdentityError(query, subState, retryIdentity);
}

export interface UmtRetriggerStagingTestRequest {
  productName: string;
  baseVersion: string;
}

// Starts one product's automated staging test run again and resolves to the
// time (epoch ms) the request was accepted. Success keeps the results polling
// for a bounded window from that time and refetches them; once a run reads as
// building, the polling follows it to its end.
export function useUmtRetriggerStagingTest(id: string) {
  const getAccessToken = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation<number, Error, UmtRetriggerStagingTestRequest>({
    mutationFn: async ({ productName, baseVersion }) => {
      await authedPost(
        umtServiceUrls.updateIntegrationTestStagingRetrigger(id, productName, baseVersion),
        await getAccessToken(),
        null,
      );
      return Date.now();
    },
    onSuccess: async (acceptedAt) => {
      queryClient.setQueryData(retriggeredAtKey(id), acceptedAt);
      await queryClient.invalidateQueries({ queryKey: ["umt-update-staging-test-results"] });
    },
  });
}

export class UmtPartialTestingSaveError extends Error {
  constructor(public readonly failedRows: UmtStagingTestResultRequest[], totalRows: number) {
    super(`Failed to save ${failedRows.length} of ${totalRows} row(s).`);
    this.name = "UmtPartialTestingSaveError";
  }
}

// Saves only the rows the user actually touched this session, one PUT per
// row, all inside this one mutationFn (not Promise.all'd from the caller) so
// isPending/error reflect the whole batch rather than only the last call —
// same reasoning as useUmtSaveDescriptionInstruction's two-sequenced PUTs.
// Rows are awaited with allSettled (not Promise.all) so one row's failure
// doesn't cut the others off mid-flight; any failures are reported back via
// UmtPartialTestingSaveError.failedRows so the caller can keep those rows'
// drafts for retry while clearing the ones that saved. Invalidation runs in
// onSettled so a partial failure still refreshes both queries to reflect
// whichever rows actually persisted.
export function useUmtSaveTestingResults(id: string) {
  const getAccessToken = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation<void, Error, UmtStagingTestResultRequest[]>({
    mutationFn: async (rows) => {
      const accessToken = await getAccessToken();
      const results = await Promise.allSettled(
        rows.map((row) => authedPut(umtServiceUrls.updateIntegrationTestStaging(id), accessToken, row)),
      );
      const failedRows = rows.filter((_, index) => results[index].status === "rejected");
      if (failedRows.length > 0) {
        throw new UmtPartialTestingSaveError(failedRows, rows.length);
      }
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["umt-update-staging-test-results"] }),
        queryClient.invalidateQueries({ queryKey: ["umt-update"] }),
      ]);
    },
  });
}
