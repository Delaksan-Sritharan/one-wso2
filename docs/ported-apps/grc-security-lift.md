# Security (GRC platform) — lift-and-shift

The GRC platform's Risk Hub, Audit Hub and Admin Console, **copied** from
`grc-tools/apps/grc-platform` rather than rewritten, on the reasoning that GRC is
new and a rewrite is where new bugs come from.

**32,788 lines across 179 files**, carried unedited except where listed in §3.

## 1. How it is wired

| | |
|---|---|
| `features/security/grc/modules/{risk,audit,admin}` | the source, unedited |
| `features/security/grc/{components,utils,hooks}` | the shared pieces those modules import |
| `features/security/grc/shim/` | **2 files** — the entire seam between the two apps |
| `constants/securityApps.ts`, `features/security/api/useSecurityGate.ts` | rail registry and gate — the only navigation code written for this |
| `App.tsx` | the source's own `<Route>` fragments, spread inside `<Route path="security">` |

Nesting the fragments is what turns the source's `/risk/*`, `/audit/*` and
`/admin/*` into `/security/risk/*`, `/security/audit/*` and `/security/admin/*`
**without editing any of the three**. Their
per-route `PrivilegeGuard`s come along, including the deliberate absence of one
on Risk Registers.

Everything else was a mechanical import-alias rewrite across 31 files.

**Security is on by default** — no preview flag. The perspective appears for
everyone; the GRC backend's own privilege set decides what is inside it, and
someone holding no grant is told plainly that they have none rather than never
seeing the perspective at all.

**The backend URL keeps the source's config key**, `GRC_PLATFORM_BACKEND_BASE_URL`
— the only key in `apiConfig.ts` that is not `ONE_WSO2_*`-prefixed. A GRC
deployment already publishes it with this value, so a config copies across
unchanged and there is one name to search for across both apps. Inventing a
second name for one thing to satisfy a prefix would cost more than it bought.

## 2. The seam

`shim/useAuthApiClient.ts` reproduces the source's hook signature, which is what
lets every call site come across unedited. It is the one place the two apps'
auth differ, and the first thing to read when a Security screen misbehaves in a
way no other perspective does.

**It sends this app's access token**, via `fetchWithReauth`, like every other
backend here. The source sends the ID token. Both come from the same Asgardeo
application with the same scopes, and in this tenant their claim sets are close
enough. `@hooks/useIdToken` exists for the one-line swap if that turns out to be
wrong — the symptom would be specific and misleading: every Risk and Admin route
403s looking exactly like a missing permission, while `/me/privileges` itself
succeeds. Decode both tokens with the dev debug panel before believing anything
else.

## 3. Everything edited after copying

Six categories, and nothing else was touched.

| # | Change | Why |
|---|---|---|
| E1 | **Mock-auth bypass removed** from `AddRisk.tsx` | Gated data-loading effects on `isSignedIn \|\| isMockAuth`. A config-driven auth bypass must not ship. See §4.1 — this is the most important thing the lift found |
| E2 | **Theme literals replaced** in 8 files | `#ffffff`/`#1a1a24`/`#1e1e1e` hardcoded to opt dialogs out of AcrylicOrange's glassmorphism. This app now defaults to WSO2Theme, whose dark canvas is navy `#0f172a` — those literals would sit as a visibly wrong shade, and a theme switch would strand them. Now `var(--oxygen-palette-background-default)`, which follows the active theme. CSS variables not `theme.palette.*`, because that accessor freezes the light scheme at first paint under CssVarsProvider |
| E3 | **Error pages replaced** with one self-contained `Error403Page` | The source's build on a `@assets/error/*.svg` alias this app lacks, and assume GRC's shell. Here the page already sits inside this app's layout, so a full-bleed error screen would render inside the frame and read as broken rather than refused |
| E4 | **`nav.ts` deleted** from all three modules | The source's sidebar tables. This app's rail reads `securityApps.ts` instead; the labels, ids, ordering and privileges there are transcribed from these so the two can be diffed |
| E5 | **An `enabled` parameter added** to `useRiskPrivileges`, `useAuditPrivileges` and `useAdminPrivileges` | See below — the one edit made for a difference in how this app mounts the code, rather than for something wrong with it |
| E6 | **Mock-auth bypass removed** from `audit/utils/auditor.ts` and `audit/hooks/useAuditPrivileges.ts` | Same class as E1 and worse: `isAssignedAuditor` returned `true` **unconditionally**, showing every auditor-only surface — sampling, evidence validation — to every user whenever the flag was set, and `useAuditPrivileges.can()` granted every privilege with no API call at all. The widest bypasses the port encountered |

**E5 in full**, because it is the only change driven by this app's shape rather than
the source's content. In GRC these hooks only ever mount inside the GRC app, so
fetching on mount is free. Here `SideRail` asks for a Security gate on **every**
perspective, to decide whether the Security entry is shown at all. So an
unconditional fetch meant every user of this app — including everyone holding no
GRC grant at all — fired `GET /me/privileges` twice and `GET /risks/me/involvement`
once on every page load, and collected the 401s in their console.

The parameter **defaults to `true`**, so all the lifted call sites — every
`PrivilegeGuard`, `admin/routes.tsx`, `UsersPage` — are unchanged and behave
exactly as they do in GRC; they only ever mount on a Security route, where the
answer is wanted anyway. Only `useSecurityGate` passes `false`, and it passes
`enabled && isSecurityBackendConfigured()`, so an unconfigured deployment also
calls nothing. `loading` initialises to `enabled` rather than `true`: a disabled
hook is not in flight, and a consumer waiting on `isResolving` would otherwise
wait for a request that is never made.

`useSecurityGate.test.tsx` pins this — that a disabled gate makes **no** request.
It was mutation-tested: reverting the parameter fails two of its cases.

Semantic colours — status chips, risk-level swatches, the heatmap — are **not**
touched. They carry meaning, not theming.

## 4. Issues the lift surfaced

The brief was to list what lifting found that a rewrite would also have found.
Split honestly: things a rewrite **would** have caught, and things the lift
caught that a rewrite **might not** have.

### 4.1 A rewrite would have caught these — reading every line is what finds them

**① The mock-auth bypass, in a file my own earlier survey missed.**
`AddRisk.tsx:136` read `window.config?.GRC_PLATFORM_MOCK_AUTH` and used it to let
data-loading effects run without a signed-in session. My earlier scan reported
"mock-auth: 0" for Add Risk because it scanned the `add-risk/` **directory**, and
this file sits one level up. Only `tsc` caught it here, and only because this
app's `window.config` is exhaustively typed — **had that type been
`Record<string, unknown>`, a config-driven auth bypass would have compiled and
shipped silently.** Removed.

**② Three identical `GET /me/privileges` per page load.** `useRiskPrivileges`,
`useAuditPrivileges` and `useAdminPrivileges` are separate hooks with separate
caches, all calling the same endpoint and all getting the same answer.

**③ The privilege cache is not keyed on the user.** All three hooks use a bare
module-level `let _promise`. Sign out, sign in as someone else in the same tab,
and the previous user's authorization decision can be served until a reload.
See ⑮ — the audit one is strictly worse than the other two.

**④ A failed privilege fetch resolves to an empty privilege set.** So a gateway
timeout is indistinguishable from "you have no grants" — it sends people to find
a permission they already hold.

**⑤ `allowAll` is honoured unconditionally.** The backend confines it to
`APP_ENV=local`, but nothing client-side stops a response opening every screen.

**⑥ `window.confirm`** for the destructive restore-a-disabled-user path.

**⑦ A clickable `<Box>` where a `<button>` belongs** — the gross-score grid in
`EditRiskDialog`. Not keyboard-reachable, not announced. The source's own
`RiskScoreGrid` gets this right; only this second inline grid does not.

**⑧ The Admin index redirect contradicts its own comment** — it tries Users →
Risk Hub → Audit Hub while claiming to follow the nav order, which is Users →
Audit Hub → Risk Hub. Reproduced as-is. Needs a ruling.

**⑨ Two retired `RISK_*` privileges** still listed, seeded INACTIVE server-side so
they resolve for nobody.

**⑩ Scoped privileges are flattened** into a union across every register, so the
UI renders controls the backend may 403. The source's design, not a gap —
per-risk decisions read `effective_privileges` instead. Nothing forces a future
editor to remember that.

②–⑩ are **live in production today**. Lifting does not create them; it imports
them into a codebase whose other perspectives don't have them.

### 4.2 The lift caught these — a rewrite might not have

**⑪ The React Compiler skips `AddRisk` entirely.** `react-hook-form`'s `watch()`
returns functions that cannot be memoized, so the compiler bails on that
component: *"Compilation Skipped: Use of incompatible library"*. This app
compiles everything through `babel-plugin-react-compiler`; GRC does not. A
rewrite would have hit the same wall, but only after the rewriting was done.

**⑫ `authFetch` is omitted from several effect dependency arrays**
(`RiskRegisters`, `RiskAnalytics`). Harmless while the shim's callback identity
is stable — but the shim's stability is now load-bearing for correctness in
files nobody edited, and nothing tests it. If `useAccessToken`'s identity ever
churns, adding the missing dep would cause a refetch loop and omitting it leaves
a stale closure.

**⑬ A missing asset alias** — the error pages import `@assets/error/*.svg`,
which only failed at bundle time, not typecheck.

**⑭ One `setState`-in-effect lint error** in `HighRisksTable`, the same class as
this app's ten pre-existing ones.

### 4.3 A correction to my own earlier finding

**MUI X `<DatePicker>` does NOT inherently break this app's production build.**

I previously isolated a `vite build` failure to rendering a `<DatePicker>`, and
on that basis replaced every one with a native date input on the
`security-perspective` branch, recorded it as a port-wide decision, and you
approved it on that evidence.

**On this branch all ten `<DatePicker>` elements are present, reachable and
routed, and the build passes** — `DesktopDatePicker` and `LocalizationProvider`
are both in the emitted bundle. The difference is that `react-hook-form` and
`@wso2/oxygen-ui-charts-react` are now installed, which changes how rollup
chunks the graph.

So the failure was real but **chunking-sensitive, not caused by DatePicker**. My
diagnosis named the wrong culprit. It could recur under a different graph, so it
is worth knowing about — but "pickers cannot be used here" was wrong, and the
native-date deviation on the other branch rests on a faulty premise.

### 4.4 Audit Hub — the bug register

Lifted after Risk and Admin, on the finding that the module is **mostly
internal**: four of its five roles are INTERNAL, and only
`grc-platform-audit-external-auditor` is not
(`shared_seed_data.sql:232`). Its external role holds 4 of the 12 `AUDIT_*`
privileges. The auditor-only surfaces are not external-only either —
`canManageControls`, an internal role, bypasses the assigned-auditor check
(`ControlDrawer.tsx:1511-1513`), so internal compliance admins use them too.

Recorded, not fixed — reproducing the source is the point of lifting, and these
are its behaviour in production today. Numbering continues §4.1–4.2.

**⑮ `useAuditPrivileges` never clears its promise cache.** The strict version of
③. Risk and admin clear `_promise` on both success and failure; audit clears it
only in `.catch`. So the first privilege answer of a tab is cached for that
tab's entire lifetime — sign out, sign back in as someone else without a full
reload, and the previous user's authorization still decides what renders. The
other two at least refetch on the next mount.

**⑯ Two mock-auth bypasses, both wider than ①.** `isAssignedAuditor` returned
`true` for **every** user, not just gating a data load — it showed the sampling
and evidence-validation surfaces to anyone. `useAuditPrivileges.can()` returned
true for every privilege with no API call. Removed (E6). Worth stating what this
means for the source: with the flag on, GRC's own UI grants every auditor-only
surface to everyone. That is intended for local development, but it is one
config line, and `window.config` is served as a plain file.

**⑰ A stale comment now describes a mode that no longer exists here.**
`ControlDrawer.tsx:1165` reasons about "any allowAll/mock-auth account". The
mock-auth half is gone in this copy. Left as-is rather than edited, to keep the
diff against the source honest — but a reader will find it misleading.

**⑱ `AIValidationCard` is unreachable by design-accident.** 417 lines rendered
inside the control drawer whose API the route guard denies —
`routeguard.go:97-99` calls this *"a pre-existing gap, not a decision"*. It
lifts, compiles, renders, and its data call is refused. Not introduced here.

**⑲ Create Audit is 2,226 lines in one file.** Not a defect, but it is the
largest single file in the port and the one most likely to be edited blind.

### 4.5 What the Audit Hub lift got right that the others did not

**The source's own tests came across and pass.** `utils/frameworkRollup.test.ts`
— 17 cases — needed only the alias rewrite. It is the only lifted file under
test, and it corrects §5's claim for this module: some tests did transfer.

## 5. What this does not prove

**Nothing here has been run.** Build success proves it compiles, bundles and
tree-shakes; it does not prove a single screen renders, that the shimmed auth
behaves like GRC's at runtime, or that the rethemed dialogs look right. The three
backend blockers (audience, CORS origin, and whichever token carries `email`)
still gate whether any of it loads at all.

**Almost no tests came across.** Of the 1,326 passing here, 1,303 are this app's
existing suite, 6 are `useSecurityGate.test.tsx` (written for E5, covering only
whether the gate fetches), and 17 are the audit module's own
`frameworkRollup.test.ts`, which transferred intact. That one pure-function file
is the only lifted code under test; no lifted screen is.

**The Audit Hub is now included.** The original objection — that porting its
internal half would split `ControlDrawer.tsx` across two codebases against one
backend — is answered by lifting the whole module, which avoids the split
entirely. The cost is carrying external-auditor code paths that cannot run here,
since external identities live in a separate Asgardeo organisation this app does
not authenticate against. Those paths stay dark because the UI is
privilege-driven and the backend re-derives every check independently.

**GRC keeps serving the Audit Hub regardless**, because external auditors stay
there. So this is a second copy of that workflow, not a move, for as long as
both run.
