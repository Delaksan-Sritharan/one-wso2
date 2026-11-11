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

// Marketing Calendar's data layer. One read: the items between two civil dates, which
// the backend fetches live from GitHub (through the Engineering Entity Service) on
// every call. Gated server-side by the `marketingcalendar` capability.
//
// Unlike the app-wide default, this query refetches every time the calendar is
// shown (`refetchOnMount: "always"`) — the agreed freshness model is "current
// on every visit, month change and Refresh", with nothing updating an open page
// by itself. A copy already in the cache still shows at once while the fresh one
// loads.

import { useQuery } from "@tanstack/react-query";
import { useAsgardeo } from "@asgardeo/react";
import { authedGet } from "@api/http";
import { httpRetry } from "@api/errors";
import { useAccessToken } from "@hooks/useAccessToken";
import { isMarketingOpsBackendConfigured, marketingOpsServiceUrls as urls } from "@config/apiConfig";
import { isPreviewEnabled } from "@config/previewFeatures";
import type { CalendarItemsResponse } from "../marketing-calendar/marketingCalendarTypes";

const KEY = {
  items: (from: string, to: string) => ["marketing-ops", "marketing-calendar", "items", from, to] as const,
};

function useBase() {
  const { isSignedIn } = useAsgardeo();
  const getAccessToken = useAccessToken();
  const ready = isSignedIn && isMarketingOpsBackendConfigured() && isPreviewEnabled("marketingCalendar");
  return { getAccessToken, ready };
}

/** The calendar items from `from` to `to` (YYYY-MM-DD, both included). */
export function useMarketingCalendarItems(from: string, to: string) {
  const { getAccessToken, ready } = useBase();
  return useQuery<CalendarItemsResponse>({
    queryKey: KEY.items(from, to),
    enabled: ready,
    queryFn: async () =>
      authedGet<CalendarItemsResponse>(urls.marketingCalendarItems(from, to), await getAccessToken()),
    refetchOnMount: "always",
    retry: httpRetry,
  });
}
