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

// Every CadO2 route, as one fragment for App.tsx. All of them render inside
// Cado2Shell, which resolves access before any page asks for data. App.tsx
// mounts this only while the `cado2` preview flag is on.

import { Navigate, Outlet, Route } from "react-router";
import Cado2Shell, { Cado2Landing, Cado2Requires } from "./components/Cado2Shell";
import Cado2PlaceholderPage from "./pages/Cado2PlaceholderPage";
import { cado2Paths } from "./cado2Paths";

export const cado2Routes = (
  <Route path="sales/cado2" element={<Cado2Shell />}>
    <Route index element={<Cado2Landing />} />
    <Route
      path="quotes"
      element={
        <Cado2Requires need="quote">
          <Cado2PlaceholderPage title="My Quotes" />
        </Cado2Requires>
      }
    />
    <Route
      path="quotes/new"
      element={
        <Cado2Requires need="quote">
          <Cado2PlaceholderPage title="New quote" />
        </Cado2Requires>
      }
    />
    <Route
      path="quotes/:quoteId/versions/:version/edit"
      element={
        <Cado2Requires need="quote">
          <Cado2PlaceholderPage title="Edit quote" />
        </Cado2Requires>
      }
    />
    {/* A quote is open to its owner, CadO2 admins and its approvers; the
        backend decides per quote, so no role guard here. Each tab is a route. */}
    <Route path="quotes/:quoteId" element={<Outlet />}>
      <Route index element={<Navigate to="quote" replace />} />
      <Route path="quote" element={<Cado2PlaceholderPage title="Quote" />} />
      <Route path="approvals" element={<Cado2PlaceholderPage title="Quote approvals" />} />
      <Route path="versions" element={<Cado2PlaceholderPage title="Quote versions" />} />
      <Route path="history" element={<Cado2PlaceholderPage title="Quote history" />} />
    </Route>
    <Route
      path="approvals"
      element={
        <Cado2Requires need="approve">
          <Cado2PlaceholderPage title="My Approvals" />
        </Cado2Requires>
      }
    />
    <Route
      path="admin"
      element={
        <Cado2Requires need="admin">
          <Outlet />
        </Cado2Requires>
      }
    >
      <Route index element={<Navigate to="approval-matrix" replace />} />
      <Route path="approval-matrix" element={<Cado2PlaceholderPage title="Approval matrix" />} />
      <Route path="approval-slas" element={<Cado2PlaceholderPage title="Approval SLAs" />} />
      <Route path="legal-entities" element={<Cado2PlaceholderPage title="Legal entities" />} />
      <Route path="currencies" element={<Cado2PlaceholderPage title="Currencies" />} />
      <Route path="product-categories" element={<Cado2PlaceholderPage title="Product categories" />} />
    </Route>
    <Route path="*" element={<Navigate to={cado2Paths.home} replace />} />
  </Route>
);
