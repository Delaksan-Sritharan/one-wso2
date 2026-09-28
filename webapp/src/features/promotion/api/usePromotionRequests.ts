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

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet, authedPatch, defaultQueryRetry } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { promotionServiceUrls } from "@config/apiConfig";
import { digiopsHeaders } from "@features/my/util/digiopsHeaders";
import { isPromotionBackendConfigured } from "./usePromotionEmployeeInfo";
import type { PromotionRequestsResponse } from "./types";

const REQUESTS_KEY = "promotion-requests";

export interface PromotionRequestsParams {
  statusArray?: string[];
  enableBuFilter?: boolean;
  type?: "NORMAL" | "SPECIAL" | "TIME_BASED" | "INDIVIDUAL_CONTRIBUTOR";
  cycleId?: number;
  employeeEmail?: string;
}

// GET /promotion/requests — every Functional Lead Portal tab reads this,
// varying params (source's own four separate service-url constants
// collapse to the same resource with different query strings).
export function usePromotionRequests(params: PromotionRequestsParams, enabled = true) {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const backendConfigured = isPromotionBackendConfigured();
  return useQuery<PromotionRequestsResponse>({
    queryKey: [REQUESTS_KEY, params],
    enabled: enabled && isSignedIn && backendConfigured,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      return authedGet<PromotionRequestsResponse>(
        promotionServiceUrls.promotionRequests(params),
        accessToken,
        digiopsHeaders(),
      );
    },
    staleTime: 30 * 1000,
    retry: defaultQueryRetry,
  });
}

function useInvalidatePromotionRequests() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [REQUESTS_KEY] });
}

// GET .../requests/{id}/approve?from=. Also accepts a list of ids —
// source's own approveFLPromotionRequestList thunk is just Promise.all
// over the single-approve endpoint (no real bulk endpoint exists), so this
// mutation does the same fan-out.
export function useApprovePromotionRequests(from: "functional_lead" | "promotion_board") {
  const getAccessToken = useAccessToken();
  const invalidate = useInvalidatePromotionRequests();
  return useMutation({
    mutationFn: async (ids: number[]) => {
      const accessToken = await getAccessToken();
      await Promise.all(
        ids.map((id) =>
          authedGet(promotionServiceUrls.promotionRequestApprove(id, from), accessToken, digiopsHeaders()),
        ),
      );
    },
    onSuccess: () => invalidate(),
  });
}

export function useRejectPromotionRequests(from: "functional_lead" | "promotion_board") {
  const getAccessToken = useAccessToken();
  const invalidate = useInvalidatePromotionRequests();
  return useMutation({
    mutationFn: async (payload: { ids: number[]; reason: string }) => {
      const accessToken = await getAccessToken();
      await Promise.all(
        payload.ids.map((id) =>
          authedGet(
            promotionServiceUrls.promotionRequestReject(id, from, payload.reason),
            accessToken,
            digiopsHeaders(),
          ),
        ),
      );
    },
    onSuccess: () => invalidate(),
  });
}

// PATCH /promotion/requests — the job-band edit dialog (Active tab only).
export function useUpdatePromotionRequestJobBand() {
  const getAccessToken = useAccessToken();
  const invalidate = useInvalidatePromotionRequests();
  return useMutation({
    mutationFn: async (payload: { id: number; promotingJobBand: number }) => {
      const accessToken = await getAccessToken();
      return authedPatch(promotionServiceUrls.promotionRequestUpdate(), accessToken, payload, digiopsHeaders());
    },
    onSuccess: () => invalidate(),
  });
}

// PATCH /promotion/requests — same endpoint as the job-band edit above,
// different fields. The Admin Portal's Individual Contributor tab's own
// "edit the declined reason after the fact" action.
export function useUpdatePromotionRequestRejectionReason() {
  const getAccessToken = useAccessToken();
  const invalidate = useInvalidatePromotionRequests();
  return useMutation({
    mutationFn: async (payload: { id: number; reasonForRejection: string }) => {
      const accessToken = await getAccessToken();
      return authedPatch(promotionServiceUrls.promotionRequestUpdate(), accessToken, payload, digiopsHeaders());
    },
    onSuccess: () => invalidate(),
  });
}

// GET .../requests/{id}/send-email-notification?effectiveDate= — the Admin
// Portal's Notification Hub, manually sending the outcome email for a
// request whose automatic notification hasn't gone out yet. effectiveDate
// is only meaningful for an APPROVED request (see PromotionRequestNotifyPayload's
// own comment where it's built); omit it for REJECTED/FL_REJECTED.
export interface PromotionRequestNotifyPayload {
  id: number;
  effectiveDate?: string;
}

export function useNotifyPromotionRequest() {
  const getAccessToken = useAccessToken();
  const invalidate = useInvalidatePromotionRequests();
  return useMutation({
    mutationFn: async (payload: PromotionRequestNotifyPayload) => {
      const accessToken = await getAccessToken();
      return authedGet(
        promotionServiceUrls.promotionRequestNotify(payload.id, payload.effectiveDate),
        accessToken,
        digiopsHeaders(),
      );
    },
    onSuccess: () => invalidate(),
  });
}
