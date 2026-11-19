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

import { defineConfig } from "vite";
import { defineConfig as defineVitestConfig } from "vitest/config";
import { mergeConfig } from "vite";
import react from "@vitejs/plugin-react";
import { federation } from "@module-federation/vite";
import { sharedConfig } from "@one-wso2/federation-shared";

const REMOTE_PORT = 3001;

// Where the "Go to One WSO2" button on the remote's own landing page points.
// Set ONE_WSO2_SHELL_URL when building the component (e.g. in Choreo).
const shellUrl = process.env.ONE_WSO2_SHELL_URL ?? "http://localhost:3000";

const viteConfig = defineConfig({
  plugins: [
    react(),
    {
      name: "shell-url-in-landing-page",
      transformIndexHtml: (html: string) => html.replaceAll("__ONE_SHELL_URL__", shellUrl),
    },
    federation({
      name: "emailGroups",
      filename: "remoteEntry.js",
      exposes: { "./Page": "./src/remote.ts" },
      shared: sharedConfig(),
      dts: false,
    }),
  ],
  // Assets resolve relative to remoteEntry.js, so the remote works under any
  // origin/path Choreo gives it.
  base: "./",
  server: { port: REMOTE_PORT, strictPort: true, cors: true, origin: `http://localhost:${REMOTE_PORT}` },
  preview: { port: REMOTE_PORT, strictPort: true, cors: true },
  build: { target: "esnext" },
});

export default mergeConfig(viteConfig, defineVitestConfig({ test: { environment: "node" } }));
