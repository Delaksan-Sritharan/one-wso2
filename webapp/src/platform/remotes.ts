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

// Runtime registration of federated remotes. Their URLs come from
// window.config (public/config.js), not the build, so a remote promoted on its
// own Choreo component is picked up without a shell redeploy.

import { loadRemote, registerRemotes } from "@module-federation/runtime";

// Remote name -> config key. Add a line per remote.
const REMOTE_URL_KEYS = {
  emailGroups: "ONE_WSO2_EMAIL_GROUPS_REMOTE_URL",
} as const;

export type RemoteName = keyof typeof REMOTE_URL_KEYS;

const registered = new Set<RemoteName>();

export function isRemoteConfigured(name: RemoteName): boolean {
  return __FEDERATION_ENABLED__ && Boolean(window.config?.[REMOTE_URL_KEYS[name]]);
}

function ensureRegistered(name: RemoteName): void {
  if (registered.has(name)) return;
  const url = window.config?.[REMOTE_URL_KEYS[name]];
  if (!url) throw new Error(`Remote "${name}" has no URL configured (${REMOTE_URL_KEYS[name]}).`);
  registerRemotes([{ name, entry: `${url.replace(/\/$/, "")}/remoteEntry.js`, type: "module" }]);
  registered.add(name);
}

/** Loads "<remote>/<expose>", e.g. loadRemoteModule("emailGroups", "Page"). */
export async function loadRemoteModule<T>(name: RemoteName, expose: string): Promise<T> {
  ensureRegistered(name);
  const mod = await loadRemote<T>(`${name}/${expose}`);
  if (!mod) throw new Error(`Remote module "${name}/${expose}" could not be loaded.`);
  return mod;
}
