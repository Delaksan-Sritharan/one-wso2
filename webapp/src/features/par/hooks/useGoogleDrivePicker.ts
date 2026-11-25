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

import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authedGet } from "@api/http";
import { useAccessToken } from "@hooks/useAccessToken";
import { googleOAuthClientId, parServiceUrls } from "@config/apiConfig";
import { digiopsHeaders } from "@features/my/util/digiopsHeaders";
import type { ParAppConfig } from "../api/types";
import type { DriveFile } from "../util/parDriveFile";

export type DrivePickerError = "SCRIPT_LOAD_FAILED" | "POPUP_BLOCKED" | "ACCESS_DENIED" | null;

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const GIS_URL = "https://accounts.google.com/gsi/client";
const GAPI_URL = "https://apis.google.com/js/api.js";

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

// The Lead Portal's "attach from Google Drive" evidence picker
// (ParLeadReviewPanel.tsx). Scripts and the OAuth client ID are loaded lazily
// (only once this is actually invoked, not on every Lead Portal page load)
// and the OAuth token is cached in a ref so a second attach in the same
// session skips the consent popup.
export function useGoogleDrivePicker() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<DrivePickerError>(null);
  const queryClient = useQueryClient();
  const getAccessToken = useAccessToken();

  const tokenRef = useRef<string | null>(null);
  const tokenClientRef = useRef<google.accounts.oauth2.TokenClient | null>(null);
  const tokenClientIdRef = useRef<string | null>(null);
  const pendingCallbackRef = useRef<((files: DriveFile[]) => void) | null>(null);

  // The PAR backend's client ID, or config.js's when the backend sends none
  // or can't be reached. A failed read isn't kept, so the next attach asks
  // again.
  const loadClientId = useCallback(async () => {
    try {
      const config = await queryClient.fetchQuery<ParAppConfig>({
        queryKey: ["par-app-config"],
        queryFn: async () =>
          authedGet<ParAppConfig>(parServiceUrls.parAppConfig(), await getAccessToken(), digiopsHeaders()),
        staleTime: Infinity,
      });
      return config.googleOAuthClientId || googleOAuthClientId;
    } catch {
      return googleOAuthClientId;
    }
  }, [queryClient, getAccessToken]);

  const openPickerWithToken = useCallback((token: string, onFilesSelected: (files: DriveFile[]) => void) => {
    const picker = new google.picker.PickerBuilder()
      .addView(new google.picker.DocsView().setIncludeFolders(false))
      .addView(google.picker.ViewId.RECENTLY_PICKED)
      .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
      .setOAuthToken(token)
      .setCallback((data: google.picker.ResponseObject) => {
        if (data.action === google.picker.Action.PICKED) {
          const files: DriveFile[] = data.docs.map((doc) => ({
            id: doc.id,
            name: doc.name,
            url: doc.url,
            mimeType: doc.mimeType,
          }));
          onFilesSelected(files);
        }
      })
      .build();
    picker.setVisible(true);
  }, []);

  const openPicker = useCallback(
    async (onFilesSelected: (files: DriveFile[]) => void) => {
      setError(null);
      setIsLoading(true);

      let clientId: string;
      try {
        // The client ID is read alongside the scripts, so it adds no wait of its own.
        [clientId] = await Promise.all([loadClientId(), loadScript(GIS_URL), loadScript(GAPI_URL)]);
        await new Promise<void>((resolve) => gapi.load("picker", resolve));
      } catch {
        setError("SCRIPT_LOAD_FAILED");
        setIsLoading(false);
        return;
      }

      setIsLoading(false);

      // A token is reused only for the client ID it was got for. The client ID can change, as when an earlier
      // read of the backend's failed: the token client is then made again and the old token dropped.
      if (tokenClientIdRef.current !== clientId) {
        tokenRef.current = null;
        tokenClientRef.current = null;
      }

      if (tokenRef.current) {
        openPickerWithToken(tokenRef.current, onFilesSelected);
        return;
      }

      pendingCallbackRef.current = onFilesSelected;

      if (!tokenClientRef.current) {
        tokenClientIdRef.current = clientId;
        tokenClientRef.current = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: DRIVE_SCOPE,
          callback: (response) => {
            if (response.error) {
              setError(response.error === "access_denied" ? "ACCESS_DENIED" : "POPUP_BLOCKED");
              return;
            }
            tokenRef.current = response.access_token;
            // Clear the cached token 60s before it expires.
            setTimeout(() => {
              tokenRef.current = null;
            }, Math.max(0, (response.expires_in - 60) * 1000));
            if (pendingCallbackRef.current) {
              openPickerWithToken(response.access_token, pendingCallbackRef.current);
            }
          },
          error_callback: () => {
            setError("POPUP_BLOCKED");
          },
        });
      }

      // prompt: "" uses the existing Google session silently; falls back to
      // a login popup only if there isn't one.
      tokenClientRef.current.requestAccessToken({ prompt: "" });
    },
    [loadClientId, openPickerWithToken],
  );

  return { openPicker, isLoading, error };
}
