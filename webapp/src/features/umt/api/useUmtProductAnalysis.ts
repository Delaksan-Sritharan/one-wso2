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

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authedPut } from "@api/http";
import { umtServiceUrls } from "@config/apiConfig";
import { useAccessToken } from "@hooks/useAccessToken";
import type { UmtProductAnalysisRequest, UmtUpdateProduct } from "./umtUpdates";

// Modifies the update's product list, then resubmits the product-analysis
// result — the "Analyze" action on this step makes both calls together
// (PUT .../products then PUT .../productAnalysis).
export function useUmtSaveProductAnalysis(id: string) {
  const getAccessToken = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    { products: UmtUpdateProduct[]; analysis: UmtProductAnalysisRequest }
  >({
    mutationFn: async ({ products, analysis }) => {
      const accessToken = await getAccessToken();
      await authedPut(umtServiceUrls.updateProducts(id), accessToken, products);
      await authedPut(umtServiceUrls.updateProductAnalysis(id), accessToken, analysis);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["umt-update"] }),
        queryClient.invalidateQueries({ queryKey: ["umt-update-product-analysis"] }),
      ]);
    },
  });
}
