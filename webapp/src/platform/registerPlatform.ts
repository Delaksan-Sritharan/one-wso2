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

// The shell's side of @one-wso2/platform-contract: hands remotes the shell's
// own auth, HTTP, notification and error-display implementations so they share
// one session and one query cache instead of bundling copies.

import { registerPlatform, type Platform } from "@one-wso2/platform-contract";
import { authedGet, authedPatch } from "@api/http";
import { describeError, httpRetry } from "@api/errors";
import { useUserInfo } from "@api/useUserInfo";
import { useAccessToken } from "@hooks/useAccessToken";
import { foldIdentityError, useAsgardeoSub } from "@hooks/useAsgardeoSub";
import { useAsgardeoUser } from "@hooks/useAsgardeoUser";
import { useNotifications } from "@context/notifications/NotificationsContext";
import ErrorNotice from "@components/error-notice/ErrorNotice";

const platform: Platform = {
  authedGet,
  authedPatch,
  describeError,
  httpRetry,
  useAccessToken,
  useAsgardeoSub,
  useAsgardeoUser,
  useUserInfo,
  foldIdentityError,
  useNotifications,
  ErrorNotice,
};

registerPlatform(platform);
