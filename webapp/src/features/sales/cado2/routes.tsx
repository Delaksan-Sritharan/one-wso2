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

import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Outlet, Route } from "react-router";
import { Skeleton } from "@wso2/oxygen-ui";
import Cado2Shell, { Cado2Landing, Cado2Requires } from "./components/Cado2Shell";
import Cado2PlaceholderPage from "./pages/Cado2PlaceholderPage";
import { cado2Paths } from "./cado2Paths";
import MyQuotesPage from "./quotes/pages/MyQuotesPage";
import MyApprovalsPage from "./approvals/pages/MyApprovalsPage";

// The heavy screens load on first use.
const QuoteWizardPage = lazy(() => import("./quotes/pages/QuoteWizardPage"));
const QuoteDetailPage = lazy(() => import("./quotes/pages/QuoteDetailPage"));

const loading = <Skeleton variant="rounded" height={240} />;
const deferred = (page: ReactNode) => <Suspense fallback={loading}>{page}</Suspense>;

export const cado2Routes = (
  <Route path="sales/cado2" element={<Cado2Shell />}>
    <Route index element={<Cado2Landing />} />
    <Route
      path="quotes"
      element={
        <Cado2Requires need="quote">
          <MyQuotesPage />
        </Cado2Requires>
      }
    />
    <Route
      path="quotes/new"
      element={<Cado2Requires need="quote">{deferred(<QuoteWizardPage />)}</Cado2Requires>}
    />
    <Route
      path="quotes/:quoteId/versions/:version/edit"
      element={<Cado2Requires need="quote">{deferred(<QuoteWizardPage />)}</Cado2Requires>}
    />
    {/* A quote is open to its owner, CadO2 admins and its approvers; the
        backend decides per quote, so no role guard here. Each tab is a route,
        and the page sends an unknown tab to the Quote tab. */}
    <Route path="quotes/:quoteId" element={<Navigate to="quote" replace />} />
    <Route path="quotes/:quoteId/:tab" element={deferred(<QuoteDetailPage />)} />
    <Route
      path="approvals"
      element={
        <Cado2Requires need="approve">
          <MyApprovalsPage />
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
