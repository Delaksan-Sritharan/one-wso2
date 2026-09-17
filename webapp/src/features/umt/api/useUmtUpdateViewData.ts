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
import { useQuery } from "@tanstack/react-query";
import { httpRetry } from "@api/errors";
import { authedGet } from "@api/http";
import { isUmtBackendConfigured, umtServiceUrls } from "@config/apiConfig";
import { useAccessToken } from "@hooks/useAccessToken";
import { useAsgardeoSub } from "@hooks/useAsgardeoSub";
import type {
  UmtHotfixInfo,
  UmtProductAnalysis,
  UmtPullRequestAnalysis,
  UmtUpdateDependency,
} from "./umtUpdates";

export function useUmtUpdateViewData(
  id: string,
  lifecycleState: string | null | undefined,
  isHotfix: boolean,
) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const { state: subState } = useAsgardeoSub();
  const userSub = subState.status === "ready" ? subState.sub : undefined;
  const enabled =
    /^\d+$/.test(id) && isSignedIn && isUmtBackendConfigured() && Boolean(userSub);
  // The legacy View page fetches both analysis resources for every lifecycle
  // state except Development. In particular, a missing lifecycle state must
  // not suppress the request: the older UI still fetched and displayed its
  // existing analysis rows in that case.
  const analysisEnabled = enabled && lifecycleState !== "Development";

  const dependencies = useQuery<UmtUpdateDependency[]>({
    queryKey: ["umt-update-dependencies", userSub, id],
    enabled,
    queryFn: async () =>
      authedGet<UmtUpdateDependency[]>(
        umtServiceUrls.updateDependencies(id),
        await getAccessToken(),
      ),
    retry: httpRetry,
  });

  const pullRequestAnalysis = useQuery<UmtPullRequestAnalysis>({
    queryKey: ["umt-update-pull-request-analysis", userSub, id],
    enabled: analysisEnabled,
    queryFn: async () =>
      authedGet<UmtPullRequestAnalysis>(
        umtServiceUrls.updatePullRequestAnalysis(id),
        await getAccessToken(),
      ),
    retry: httpRetry,
  });

  const productAnalysis = useQuery<UmtProductAnalysis>({
    queryKey: ["umt-update-product-analysis", userSub, id],
    enabled: analysisEnabled,
    queryFn: async () =>
      authedGet<UmtProductAnalysis>(
        umtServiceUrls.updateProductAnalysis(id),
        await getAccessToken(),
      ),
    retry: httpRetry,
  });

  const hotfixInfo = useQuery<UmtHotfixInfo>({
    queryKey: ["umt-update-hotfix-info", userSub, id],
    enabled: enabled && isHotfix,
    queryFn: async () =>
      authedGet<UmtHotfixInfo>(
        umtServiceUrls.updateHotfixInfo(id),
        await getAccessToken(),
      ),
    retry: httpRetry,
  });

  return { dependencies, hotfixInfo, productAnalysis, pullRequestAnalysis };
}
