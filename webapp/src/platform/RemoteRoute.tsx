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

import { Component, lazy, Suspense, type ComponentType, type ReactNode } from "react";
import { Skeleton } from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { isRemoteConfigured, loadRemoteModule, type RemoteName } from "./remotes";

class RemoteBoundary extends Component<{ children: ReactNode }, { error?: unknown }> {
  state: { error?: unknown } = {};
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  render() {
    if (this.state.error === undefined) return this.props.children;
    return (
      <ErrorNotice error={this.state.error} onRetry={() => window.location.reload()} sx={{ m: 2 }}>
        This part of One WSO2 could not be loaded.
      </ErrorNotice>
    );
  }
}

/**
 * Builds the page component for a federated remote module. Call once at module
 * level (not in render) so the lazy component keeps a stable identity.
 *
 * A remote that is unconfigured, down or fails to load degrades to a notice
 * here and does not take the shell with it.
 */
export function createRemotePage(remote: RemoteName, expose: string, notConfigured?: ReactNode) {
  const Remote = lazy(() => loadRemoteModule<{ default: ComponentType }>(remote, expose));
  return function RemotePage() {
    if (!isRemoteConfigured(remote)) {
      return (
        <>
          {notConfigured ?? (
            <ErrorNotice severity="info" sx={{ m: 2 }}>
              This app is not connected in this environment.
            </ErrorNotice>
          )}
        </>
      );
    }
    return (
      <RemoteBoundary>
        <Suspense fallback={<Skeleton variant="rounded" height={240} sx={{ m: 2 }} />}>
          <Remote />
        </Suspense>
      </RemoteBoundary>
    );
  };
}
