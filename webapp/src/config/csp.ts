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

// Build-time only: imported by vite.config.ts and never by app code, so
// nothing here reaches the bundle.

// Comma-separated `https://host[:port]` origins, added to connect-src and
// frame-src. Only needed when a deployment signs in through an identity
// server the default allowlist does not already cover (ThunderID and other
// non-Asgardeo OIDC servers), because the CSP is baked into the build while
// window.config is not. Everything else belongs at the edge.
export const AUTH_ORIGINS_ENV = "ONE_WSO2_CSP_AUTH_ORIGINS";

// Scheme + host [+ port], nothing else: no wildcards, no paths, no trailing
// slash. A malformed entry must fail the build, not silently widen the policy.
const HTTPS_ORIGIN = /^https:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d{1,5})?$/i;

export function parseAuthOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  const origins = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  for (const origin of origins) {
    if (!HTTPS_ORIGIN.test(origin)) {
      throw new Error(
        `${AUTH_ORIGINS_ENV} entry "${origin}" is not an https origin (want https://host[:port]).`,
      );
    }
  }
  return [...new Set(origins)];
}

// Content-Security-Policy for the shipped SPA (threat-model risk ONEWSO2-R2:
// no app-defined headers previously). Injected as a <meta> on PRODUCTION
// builds only — the dev server relies on inline scripts + ws HMR that a
// strict CSP would block. Headers a meta tag can't express must still be set
// at the Choreo/Cloudflare edge: X-Frame-Options / frame-ancestors (ignored
// in meta), HSTS, X-Content-Type-Options, Permissions-Policy, Clear-Site-Data.
//
// Origins: backend calls and employee thumbnails go through the Choreo
// gateway (apis[-stg].wso2.com) and Asgardeo (*.asgardeo.io). Those hosts are
// runtime-configurable (window.config) so a static build can't pin exact
// origins — the wso2/asgardeo wildcards are the tightest portable allowlist;
// pin them further at the edge if the CSP is moved there. style-src allows
// 'unsafe-inline' for MUI/emotion; img-src/frame-src allow blob: and data:
// for receipt previews (fetchReceiptObjectUrl → blob:, fetchBase64Attachment
// → data:, incl. PDF <iframe src="data:...">). employeeThumbnail is a raw
// pass-through URL from people-app, not always Choreo-hosted — some
// employees' photos resolve to their Google account avatar
// (lh3.googleusercontent.com and friends) rather than a gateway URL, so
// img-src also allows Google's avatar CDN.
//
// The Evidence Portal shows evidence screenshots straight from Azure Blob
// Storage: its backend hands out short-lived signed (SAS) URLs and has no
// route that streams a single file's bytes, so img-src allows
// *.blob.core.windows.net.
//
// Amplify shows each campaign's image on its post card, and campaigns are
// WSO2 LinkedIn posts whose images live on LinkedIn's media CDN, so img-src
// allows https://media.licdn.com (that host only, not *.licdn.com). Those
// URLs are signed and expire after about a week; a card whose image fails to
// load falls back to the default image.
//
// The Lead Portal's evidence-attachment picker (useGoogleDrivePicker.ts)
// loads Google Identity Services + the Picker API at runtime, needing three
// more origins: script-src for the two loaded scripts, connect-src for the
// token exchange + Drive API calls they make, and frame-src for the
// Picker's own iframe (hosted on docs.google.com, not inline).
//
// Sales plays meeting recordings in a <video> whose src is the signed URL returned by
// the Sales backend's playback endpoint (ONE_WSO2_REVOPS_BACKEND_URL, then
// /meetings/{id}/playback). That URL's host differs per environment, so media-src takes
// wildcards: *.choreoapis.dev for a Choreo default URL, and *.wso2.com for the API
// gateway's wso2.com domain (the same *.wso2.com connect-src already trusts).
//
// connect-src also allows *.choreoapis.dev so the app can call a backend
// through its Choreo default URL, not only through a *.wso2.com gateway URL.
//
// frame-src takes *.wso2.com for the same reason connect-src does: a
// deployment whose IdP answers on a wso2.com host can complete the
// silent-sign-in iframe (the SDK frames the authorization endpoint), and
// discovery already talks to that host. Without it the iframe is blocked and
// silent sign-in fails while every other call succeeds.
export function buildCsp(extraAuthOrigins: readonly string[] = []): string {
  const extras = [...new Set(extraAuthOrigins)];
  const extra = extras.length > 0 ? ` ${extras.join(" ")}` : "";
  return [
    "default-src 'self'",
    // 'wasm-unsafe-eval': @react-pdf/renderer lays out PDFs with yoga-layout,
    // which is WebAssembly, so every PDF built in the browser needs it (today
    // Legal → NDA and the Partner dashboard report); without it they fail.
    // It allows WebAssembly compilation only. Do NOT add 'unsafe-eval' to fix a
    // future CSP error: it re-enables JavaScript eval() and new Function() on
    // every page.
    "script-src 'self' 'wasm-unsafe-eval' https://accounts.google.com https://apis.google.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.wso2.com https://wso2.cachefly.net https://*.asgardeo.io https://*.googleusercontent.com https://*.blob.core.windows.net https://media.licdn.com",
    "font-src 'self' data: https://wso2.cachefly.net",
    `connect-src 'self' https://*.wso2.com https://*.choreoapis.dev https://*.asgardeo.io https://*.googleapis.com https://accounts.google.com${extra}`,
    "media-src 'self' https://*.choreoapis.dev https://*.wso2.com",
    `frame-src 'self' blob: data: https://*.asgardeo.io https://*.wso2.com https://docs.google.com https://accounts.google.com${extra}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}
