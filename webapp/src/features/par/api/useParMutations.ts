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

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authedPatch } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { parServiceUrls } from "@config/apiConfig";
import { digiopsHeaders } from "@features/my/util/digiopsHeaders";
import type { ParRatingModify } from "./types";

// PATCH the caller's own par-rating record — saving a draft
// (parEmployeeStatus: "DRAFT") or submitting (parEmployeeStatus: "SHARED")
// both go through this one endpoint; the backend rejects (403) any field
// outside ParRatingModify's self-editable set.
//
// Invalidates ["par-rating"] so the stepper and the form both refetch the
// record they just wrote rather than showing stale status.
export function useSaveParRating(parCycleId: number | undefined, workEmail: string | undefined) {
  const getAccessToken = useAccessToken();
  const qc = useQueryClient();
  return useMutation<void, Error, ParRatingModify & { parRatingId: number }>({
    mutationFn: async ({ parRatingId, ...payload }) => {
      if (!parCycleId || !workEmail) throw new Error("Missing cycle or employee email");
      const accessToken = await getAccessToken();
      await authedPatch<void>(
        parServiceUrls.parRatingUpdate(parCycleId, workEmail, parRatingId),
        accessToken,
        payload,
        digiopsHeaders(),
      );
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["par-rating", parCycleId, workEmail] });
    },
  });
}
