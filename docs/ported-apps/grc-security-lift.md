# Security (GRC platform) — lift-and-shift

The GRC platform's Risk Hub and Admin Console, **copied** from
`grc-tools/apps/grc-platform` rather than rewritten, on the reasoning that GRC is
new and a rewrite is where new bugs come from.

**16,664 lines across 87 files**, carried unedited except where listed in §3.

## 1. How it is wired

| | |
|---|---|
| `features/security/grc/modules/{risk,admin}` | the source, unedited |
| `features/security/grc/{components,utils,hooks}` | the shared pieces those modules import |
| `features/security/grc/shim/` | **2 files** — the entire seam between the two apps |
| `constants/securityApps.ts`, `features/security/api/useSecurityGate.ts` | rail registry and gate — the only navigation code written for this |
| `App.tsx` | the source's own `<Route>` fragments, spread inside `<Route path="security">` |

Nesting the fragments is what turns the source's `/risk/*` and `/admin/*` into
`/security/risk/*` and `/security/admin/*` **without editing either file**. Their
per-route `PrivilegeGuard`s come along, including the deliberate absence of one
on Risk Registers.

Everything else was a mechanical import-alias rewrite across 31 files.

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

Four categories, and nothing else was touched.

| # | Change | Why |
|---|---|---|
| E1 | **Mock-auth bypass removed** from `AddRisk.tsx` | Gated data-loading effects on `isSignedIn \|\| isMockAuth`. A config-driven auth bypass must not ship. See §4.1 — this is the most important thing the lift found |
| E2 | **Theme literals replaced** in 8 files | `#ffffff`/`#1a1a24`/`#1e1e1e` hardcoded to opt dialogs out of AcrylicOrange's glassmorphism. This app now defaults to WSO2Theme, whose dark canvas is navy `#0f172a` — those literals would sit as a visibly wrong shade, and a theme switch would strand them. Now `var(--oxygen-palette-background-default)`, which follows the active theme. CSS variables not `theme.palette.*`, because that accessor freezes the light scheme at first paint under CssVarsProvider |
| E3 | **Error pages replaced** with one self-contained `Error403Page` | The source's build on a `@assets/error/*.svg` alias this app lacks, and assume GRC's shell. Here the page already sits inside this app's layout, so a full-bleed error screen would render inside the frame and read as broken rather than refused |
| E4 | **`nav.ts` deleted** from both modules | The source's sidebar tables. This app's rail reads `securityApps.ts` instead; the labels, ids, ordering and privileges there are transcribed from these so the two can be diffed |

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

**② Two identical `GET /me/privileges` per page load.** `useRiskPrivileges` and
`useAdminPrivileges` are separate hooks with separate caches. (The source has a
third for the Audit Hub, not carried.)

**③ The privilege cache is not keyed on the user.** Both hooks use a bare
module-level `let _promise`. Sign out, sign in as someone else in the same tab,
and the previous user's authorization decision can be served until a reload.

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

## 5. What this does not prove

**Nothing here has been run.** Build success proves it compiles, bundles and
tree-shakes; it does not prove a single screen renders, that the shimmed auth
behaves like GRC's at runtime, or that the rethemed dialogs look right. The three
backend blockers (audience, CORS origin, and whichever token carries `email`)
still gate whether any of it loads at all.

**No tests came across.** The source's tests reference its own aliases and hooks.
The 1,303 passing here are this app's existing suite; the lifted code adds none.

**The Audit Hub is not included** — the agreed scope is Risk + Admin. Worth
knowing that lifting changes that tradeoff: the objection was that porting its
internal half would split `ControlDrawer.tsx` across two codebases, and lifting
the whole module avoids the split entirely, at the cost of carrying
external-auditor code paths that can never run here. It would also need the
mock-auth bypass removed from five more files. That is a decision, not a
follow-up.
