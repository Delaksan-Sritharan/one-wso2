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

// Singletons every federated app (shell and remotes) must load exactly once.
// Keep this list identical on both sides; adding to it is a coordinated change.
// Only list packages an app imports directly — transitive dependencies of a
// shared package (emotion, MUI internals) are resolved through it.
export const sharedSingletons = [
  "react",
  "react-dom",
  "react-router",
  "@wso2/oxygen-ui",
  "@wso2/oxygen-ui-icons-react",
  "@asgardeo/react",
  "@tanstack/react-query",
  "@one-wso2/platform-contract",
];

export function sharedConfig() {
  return Object.fromEntries(sharedSingletons.map((name) => [name, { singleton: true }]));
}
