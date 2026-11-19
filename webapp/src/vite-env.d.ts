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

/// <reference types="vite/client" />

// Build-time values from .env (see .env.example). Vite copies them into the
// bundle, so they are readable by anyone who loads the app.
interface ImportMetaEnv {
  readonly ONE_WSO2_EMAIL_SIGNATURE_OVERRIDE_WORK_EMAIL?: string;
  readonly ONE_WSO2_EMAIL_SIGNATURE_OVERRIDE_EMAIL_USER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Set by vite.config.ts: whether this build/dev server runs as a federation host.
declare const __FEDERATION_ENABLED__: boolean;
