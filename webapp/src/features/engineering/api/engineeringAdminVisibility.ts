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

import { useQuery } from "@tanstack/react-query";
import type { VisibilityAnswer } from "@components/side-rail/visibilityFold";
import { ENGINEERING_ADMIN_ITEM_ID } from "@constants/perspectives";
import { useAccessToken } from "@hooks/useAccessToken";
import {
  getProductDownloadStatsUser,
  isCredentialedProductDownloadStatsUrl,
  isProductDownloadStatsConfigured,
  productDownloadStatsBackendUrl,
} from "./productDownloadStats";

export function engineeringAdminVisibility(gate: { isAdmin: boolean; resolving: boolean }): VisibilityAnswer {
  return {
    canSee: (id) => id === ENGINEERING_ADMIN_ITEM_ID && gate.isAdmin && !gate.resolving,
    resolving: gate.resolving,
    retry: () => undefined,
  };
}

// Asks the Product Download Stats API whether this caller is an admin.
// The rail uses the answer to show or hide Admin. A failed read hides the
// row; it does not fail the rest of Engineering.
export function useEngineeringAdminGate(enabled: boolean): {
  isAdmin: boolean;
  isResolving: boolean;
  isError: boolean;
  error: unknown;
  retry: () => void;
} {
  const getToken = useAccessToken();
  const base = productDownloadStatsBackendUrl();
  const ask =
    enabled && isProductDownloadStatsConfigured() && isCredentialedProductDownloadStatsUrl(base);
  const query = useQuery({
    queryKey: ["product-download-stats", "user-info", base],
    enabled: ask,
    queryFn: async () => getProductDownloadStatsUser(await getToken()),
  });
  return {
    isAdmin: query.data?.isAdmin === true,
    isResolving: ask && query.isPending,
    isError: ask && query.isError,
    error: query.error,
    retry: () => void query.refetch(),
  };
}
