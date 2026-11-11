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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authedGet } from "@api/http";
import { httpRetry } from "@api/errors";
import { isUmtBackendConfigured, umtServiceUrls } from "@config/apiConfig";
import { useAccessToken } from "@hooks/useAccessToken";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { umtShouldPollStagingTestResults } from "../lib/umtTesting";
import { umtLifecycleState } from "../lib/umtLifecycleState";
import { umtIsUpdateLocked } from "../lib/umtUpdateLock";
import { isUmtPrAnalysisRunning } from "./umtTypes";
import type { UmtUpdateSummary } from "./umtUpdates";

export function useUmtUpdate(id: string | undefined) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState, retry: retryIdentity } = useAsgardeoSub();
  const queryClient = useQueryClient();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const hasValidId = id !== undefined && /^\d+$/.test(id);
  const queryKey = ["umt-update", userSub, id];

  const query = useQuery<UmtUpdateSummary>({
    queryKey,
    enabled:
      hasValidId &&
      isSignedIn &&
      isUmtBackendConfigured() &&
      Boolean(userSub),
    queryFn: async () => {
      // Read the cached update *before* this fetch overwrites it, so a
      // promotion that just ended is noticed by whichever fetch sees it first.
      const previous = queryClient.getQueryData<UmtUpdateSummary>(queryKey);
      const update = await authedGet<UmtUpdateSummary>(umtServiceUrls.update(id as string), await getAccessToken());
      // The backend has moved the update to PRAnalyzed and stored its product
      // analysis, or moved it back to Development, so everything those touch
      // is re-read.
      if (previous?.praPromotionPending && !update.praPromotionPending) {
        void queryClient.invalidateQueries({ queryKey: ["umt-updates"] });
        void queryClient.invalidateQueries({ queryKey: ["umt-update-lifecycle-history"] });
        void queryClient.invalidateQueries({ queryKey: ["umt-update-product-analysis"] });
        void queryClient.invalidateQueries({ queryKey: ["umt-update-pull-request-analysis"] });
      }
      return update;
    },
    // The testing-environment states are transient and change server-side with
    // no client action: the Edit tab's Proceed gate and the Testing step both
    // read lifecycleState, so the update resource has to notice the transition
    // itself, stopping once it has. The same goes for a demotion from Staging,
    // which keeps the update locked until it lands in Development, and for a
    // PR analysis, which the backend carries on to PRAnalyzed by itself.
    refetchInterval: (query) => {
      const data = query.state.data;
      const lifecycleState = umtLifecycleState(data?.lifecycleState);
      return umtShouldPollStagingTestResults(lifecycleState) ||
        umtIsUpdateLocked(lifecycleState) ||
        (data !== undefined && isUmtPrAnalysisRunning(data))
        ? 3000
        : false;
    },
    retry: httpRetry,
  });

  return foldIdentityError(query, subState, retryIdentity);
}
