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
import { authedPost, fetchWithReauth, HttpError } from "@api/http";
import { umtServiceUrls } from "@config/apiConfig";
import { useAccessToken } from "@hooks/useAccessToken";
import type { UmtPullRequestAnalysisRequest } from "./umtUpdates";

// The update itself, refetched here and then polled by useUmtUpdate, follows
// the run from start to end: the POST commits praStatus (QUEUED, or COMPLETED
// for an Instructions Only update) and the pending promotion before it returns.
export function useUmtStartPullRequestAnalysis(id: string) {
  const getAccessToken = useAccessToken();
  const queryClient = useQueryClient();

  return useMutation<void, Error, UmtPullRequestAnalysisRequest>({
    mutationFn: async (payload) => {
      const accessToken = await getAccessToken();
      await authedPost(umtServiceUrls.startPullRequestAnalysis(id), accessToken, payload);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["umt-update-pull-request-analysis"] }),
        queryClient.invalidateQueries({ queryKey: ["umt-update"] }),
      ]);
    },
  });
}

// Mirrors financeReceipts.ts's uploadReceipt: calls fetchWithReauth directly
// with a non-JSON body instead of going through the shared JSON helpers.
// When there's no local file (an SVN-location- or GitHub-raw-URL-only
// source), the caller passes a small placeholder blob — the backend already
// expects a `file` part on every call regardless of source.
//
// The backend stores the upload under the `file` part's filename and ignores
// the `relativePath` field, so `filePath` — the path the PR analysis request
// will later reference — must be sent as that filename. Otherwise the file
// lands at its bare name and the analysis fails with "File does not exist in
// UMT-container" (the Java and ui-revamp UIs both sent the full path).
export function useUmtUploadPullRequestAnalysisFile(id: string) {
  const getAccessToken = useAccessToken();

  return useMutation<
    void,
    Error,
    { relativePath: string; sourceFilePath: string; file: File | Blob; filePath?: string }
  >({
    mutationFn: async ({ relativePath, sourceFilePath, file, filePath }) => {
      const accessToken = await getAccessToken();
      const url = umtServiceUrls.updatePullRequestAnalysisFile(id);
      const formData = new FormData();
      formData.append("relativePath", relativePath);
      formData.append("id", id);
      formData.append("sourceFilePath", sourceFilePath);
      if (filePath) {
        formData.append("file", file, filePath);
      } else {
        formData.append("file", file);
      }

      const res = await fetchWithReauth(url, { method: "POST", body: formData }, accessToken);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new HttpError(url, res.status, body);
      }
    },
  });
}
