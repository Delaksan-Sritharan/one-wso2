# Subscriptions (PickMe Commute + LaaS) — functional specification

**Status:** written from the source implementation rather than from any prior document. This is the
reference for verifying the port and for writing test cases against it.

**Source of truth for behaviour:** the source app's own screens for the UI rules, and its Ballerina
backend (`service.bal` / `utils.bal` / `modules/authorization/`) for the server rules. Where the two
disagreed, the server is authoritative and the divergence is recorded in §7.

**In One WSO2:** two routes under People Ops, below Org Chart. There was no existing desktop layout
to be faithful to, only existing *rules*, which are reproduced exactly.

| Route | Screen | Who |
|---|---|---|
| `/people-ops/subscriptions` | My subscriptions | every signed-in employee |
| `/people-ops/subscriptions/manage` | Manage for employees | commute and/or LaaS admins |

Backend reached via `ONE_WSO2_SUBSCRIPTION_BACKEND_URL`; the existing service is reused unchanged.

---

## 1. Purpose and users

Two paid staff services an employee subscribes to by the month:

- **PickMe Commute** — a subsidised ride to and from the office. Priced by a distance band, and the
  subscription carries the mobile number the driver calls.
- **LaaS** ("lunch as a service") — the daily lunch plan. One flat monthly price, nothing to choose.

Everyone manages their own. A small number of people — the two admin groups — manage other
people's, which is what the second screen is for.

---

## 2. Screens and features

### 2.1 My subscriptions

One card per service, side by side on a wide viewport and stacked on a phone. Each card shows:

- The service name and a status chip: **Subscribed** or **Not subscribed**.
- **When subscribed:** a read-only summary. Commute shows the distance band, the monthly rate and
  the contact number; LaaS shows the monthly rate.
- **When not subscribed:** commute shows the two inputs (distance band, contact number); LaaS shows
  the price it would cost.
- The governing window as a sentence — the opt-**out** window for a subscriber, the opt-**in**
  window for everyone else. Green when open, neutral when not.
- One button: **Opt in to …** / **Opt out of …**, disabled while the window is shut.

Confirming either direction goes through a dialog naming the consequence and the reverse window.

### 2.2 Manage for employees

- An employee picker over the full roster (see §3.4).
- Once someone is picked: their name, avatar and work email, then one panel per service the caller
  administers — commute only, LaaS only, or both.
- Each panel is the same shape as a card above, **minus the date windows** (§4.2), with
  **Subscribe** / **Unsubscribe** buttons and a confirmation naming the employee and their address.

---

## 3. API contract

All calls carry the Asgardeo access token as `Bearer`; the Choreo gateway rewrites it into
`x-jwt-assertion` for the service's `JwtInterceptor`.

Note that the subject is a **path segment**, not merely the token. The service compares it with the
JWT's own email to decide self-service vs acting-on-behalf-of. That is what lets one set of hooks
serve both screens.

### 3.1 `GET /subscriptions/meta-info`

Returns `distances[]` (the price table), the four day boundaries, `laasCost`, `excludedGroups`,
`serviceChargeMsg`, and — load-bearing — `commuteAdminGroup` and `lunchAdminGroup`. Open to any
authenticated caller.

### 3.2 `GET /commutes/{email}` and `GET /meal/{email}`

The subscription record, or **404 when the employee has no row at all**. 404 is folded to `null` by
`useSubscriptionData`: never having subscribed is an ordinary state, not a failure. A row exists for
anyone who has *ever* subscribed, so `isSubscribed` on the row is the answer — its presence is not.

Reading someone else's requires that service's admin group.

### 3.3 The four write endpoints

`POST /commutes/{email}/subscribe` (body: `{distanceRangeId, contactNumber}`),
`POST /commutes/{email}/unsubscribe`, `POST /meal/{email}/subscribe`,
`POST /meal/{email}/unsubscribe`. Each returns the row id as a bare integer.

### 3.4 `GET /employees`

The admin picker's roster. **403s for a caller in neither admin group**, so it is fetched only once
the gate says the caller is an admin.

It returns employees with status `Active` **or `Marked leaver`** — deliberately, and this is why the
screen does not reuse People Ops' `EmployeeEmailPicker`, which reads people-app's
`/employees/basic-info` (active only). Someone working out their notice still commutes and still
eats, and their subscription still has to be closed before they leave.

---

## 4. Rules

### 4.1 The two monthly windows

Both are pairs of **days of the month**, configurable per deployment. Defaults: opt-in `25 → 5`,
opt-out `25 → 31`.

**The opt-in window wraps across the month boundary.** Reading `25 → 5` as `day >= 25 && day <= 5`
is never true and would close opt-in permanently; the wrapping case inverts to a union. This is the
single rule most likely to be got wrong, so it is isolated in
`util/subscriptionWindows.ts` and covered by tests.

### 4.2 Admins bypass the windows

An admin acting for another employee may subscribe or unsubscribe them **at any time**. The service
states it explicitly (`if isSelf { …window check… }`), and the admin screen consequently contains no
window logic at all. Self-service still enforces both windows, and the server rejects a
self-service call outside them with a 400.

### 4.3 Contact number

`^\+947[0-9]{8}$`, enforced by the backend's `@constraint:String` and re-stated client-side only to
say so before the round trip. Required for a commute opt-in, by self-service and admins alike.

### 4.4 Fee-exempt groups

A member of an `excludedGroups` group (interns, today) sees `serviceChargeMsg` instead of a price.
It changes the price line only, never what anyone may do.

On the **admin** screen the price line always shows the standard rate: the exemption follows the
*employee*, and the token carries only the *admin's* groups, so it cannot be resolved from the
client. The service bills correctly regardless. See §7.

### 4.5 A subscription cannot be edited in place

There is no endpoint that changes a distance band or a contact number on a live subscription. The
only route is opt out, then opt back in — across two different windows. The fields therefore become
read-only the moment someone is subscribed, rather than offering an edit the backend cannot perform.

---

## 5. Authorization

Two Asgardeo groups, `commuteAdminGroup` and `lunchAdminGroup`, whose **names come from
`/subscriptions/meta-info`** rather than being hard-coded — a group rename is a config change, not a
frontend release.

They are **independent**: holding one does not imply the other. `useSubscriptionGate` surfaces them
separately and the admin screen filters panels one by one, so a commute-only admin is never shown a
LaaS panel that would 403.

**This service has no `/me`.** Unlike Marketing Ops, it publishes the group *names* and leaves the
comparison to the client — exactly as its own microapp did (`handleCheckGroups`). So the gate is a
join of that response and the `groups` claim of the id_token, read by the shared
`@hooks/useAsgardeoGroups`. Where a backend *does* offer a `/me`, keep asking it: a server-computed
answer cannot drift from what the server will allow.

The client check is presentation only. Every endpoint re-derives the same groups from the JWT and
refuses a caller who does not hold them; a tampered token buys a screen whose every button fails.

`requires: ["admin"]` is **not** used on these rail items. That vocabulary is people-app privilege
numbers, which are unrelated to these groups — a People Ops admin is not a commute admin. The rail
routes `SUBSCRIPTION_ITEM_IDS` through `useSubscriptionGate` instead, as it already does for Leave,
Finance and Marketing Ops.

---

## 6. Failure states

The shell ladder, identical to `PeopleOpsShell` / `MenuShell`:

1. `ONE_WSO2_SUBSCRIPTION_BACKEND_URL` unset → name the missing key.
2. Gate resolving → spinner, never a premature denial.
3. Gate failed → error **with a retry**, not a denial.
4. Decided, not an admin → say plainly who to ask.

3 and 4 stay apart deliberately: both leave us holding no groups, and collapsing them tells someone
whose gateway timed out that they lack a permission they already have.

---

## 7. Deliberate differences from the source

| # | Source behaviour | Here | Why |
|---|---|---|---|
| 1 | Mobile-only microapp, bottom `SwipeableDrawer` for admin | Two routes, a normal page each | There is no web version to be faithful to. A bottom sheet is a phone idiom; on a desktop rail the admin screen is its own destination, linkable and refreshable. |
| 2 | Colours computed once from `prefers-color-scheme` into hardcoded hex | Oxygen theme tokens throughout | The source says it "repeatedly proved unreliable in this app's setup". One WSO2's theme is not that setup, and a snapshot taken at module load cannot follow a theme switch. |
| 3 | Toggle switch per service | An explicit Opt in / Opt out button | A switch implies an instantly-reversible setting. This is a monthly commitment reversible only in the other window, and both directions already required a confirmation dialog. |
| 4 | Window explained as locale dates, `toLocaleDateString()` | `25 Sep to 5 Oct` | The rule has no year in it — it is the 25th of whatever month it is now. The original printed `9/25/2026` or `25/09/2026` depending on locale, for a recurring rule. |
| 5 | Retries every non-404 up to 4 times with backoff | Mutations do not retry; queries skip 4xx | The two failures that actually occur are a closed window (400) and a missing group (403). Both are final answers, and the original made exactly those wait through four round trips. |
| 6 | `isInExcludedGroup` applied on the admin panel too | Standard rate shown there | The exemption follows the employee; the admin's token cannot answer for them. Showing "free of charge" because the *admin* is an intern would be wrong. |
| 7 | Admin drawer reset by an effect on close | Panel remounted per employee via `key` | Same outcome, one mechanism instead of three `setState`s, and it cannot miss a field added later. |
| 8 | 401 handled by a bespoke token-refresh queue | `@api/http`'s `fetchWithReauth` | One WSO2 already has this, deduped across concurrent callers, and it replays only GETs — the source replayed POSTs, which risks a duplicate subscribe. |

## 8. Test checklist

- [ ] Mid-month (day 12, defaults): both buttons disabled, both cards name their window.
- [ ] Day 26: a non-subscriber can opt in; a subscriber can opt out.
- [ ] Day 3: a non-subscriber can opt in (wrapped window); a subscriber **cannot** opt out.
- [ ] Commute opt-in with no band, or a malformed number → the offending field is marked; nothing sent.
- [ ] Opting in then reloading shows the summary, read-only, with the band and number just entered.
- [ ] A 404 on either GET renders "Not subscribed", not an error.
- [ ] Non-admin: the Manage rail item is absent, and the URL typed by hand explains rather than blanks.
- [ ] Commute-only admin: sees the commute panel alone; `/employees` succeeds.
- [ ] Admin acting mid-month: both buttons enabled, and the dialog says the windows don't apply.
- [ ] Switching the selected employee clears any half-typed contact number.
- [ ] Backend URL unset: both screens name `ONE_WSO2_SUBSCRIPTION_BACKEND_URL`.
