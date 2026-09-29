# Finance Master Data — functional specification

Ported from `digiops-finance/apps/finance-master-data/webapp` into
`webapp/src/features/finance/masterdata`. Written after reading the source in full,
alongside its Ballerina service, so the wire types and endpoint paths below are
transcribed rather than inferred.

Routes: `/finance/master-data/subsidiaries`, `/finance/master-data/departments`,
`/finance/master-data/expense-types`, `/finance/master-data/credit-cards`. Backend is
`ONE_WSO2_FINANCE_MASTER_DATA_BACKEND_URL`.

**Frontend only.** The Ballerina service is unchanged and no file under
`apps/finance-master-data/backend` was touched. The port replaces MUI + axios +
notistack + Redux with Oxygen UI + TanStack Query + the portal's `useNotifications`,
and calls exactly the endpoints the source called.

**Under Finance, not Me.** This is the reference data the other finance apps are keyed
against — an expense type is used by both Expense Claims and Credit Card Expenses, a
subsidiary by everything that books a cost. It is maintained by finance for other
people's apps to read, so it is neither a Me item nor a tab inside any one app.

---

## 1. Purpose and users

Four lookup tables behind the finance apps. Every screen is the same shape: a table, an
"Add New …" button, and Edit / Delete on each row.

The source app has **no role endpoint** — its `GET /user-info` returns only an email and
an avatar, and access is decided upstream by Asgardeo group membership. So unlike the
other finance apps, the rail cannot ask this backend who the reader is. Its four items
gate on the portal's coarse `admin` capability instead, passed into `useFinanceGate`
by the rail rather than re-fetched (`useFinanceGate.ts`).

## 2. The four collections

| Tab | Path segment | Fetched by | Sorted by |
|---|---|---|---|
| Subsidiaries | `subsidiaries` | `GET` | `legalName` |
| Departments | `departments` | `GET` | `employeeDepartment` |
| Expense Types | `expense-types` | `POST /search-expense-types` | `expenseType` |
| Credit Cards | `credit-cards` | `GET` | `employeeEmail` |

All four take `POST /{collection}`, `PATCH /{collection}/{id}` and
`DELETE /{collection}/{id}`. A successful create, patch, or delete is a bare
200/201 with no body — the service returns Ballerina's `http:OK` / `http:CREATED`
constants — which `authedPost` and `authedPatch` already read as `null` rather
than trying to parse. The list (`GET`) and expense-type search (`POST
/search-expense-types`) requests are the exception: both return the actual rows.

Three supporting endpoints feed the forms and filters: `GET /gl-codes`,
`GET /employees/email`, `GET /expense-types/autocomplete-values`.

## 3. Screens

### 3.1 Subsidiaries — `/finance/master-data/subsidiaries`

Columns, in order: **Subsidiary Legal Name**, **Subsidiary Code**, **Tax ID**,
**Tax Code**, Actions.

Form fields, all required: Subsidiary Legal Name, Subsidiary Code, Tax ID (numeric),
Tax Code.

### 3.2 Departments — `/finance/master-data/departments`

Columns: **Employee Department**, **Engagement Code**, **GL Code**, Actions.

GL Code carries an info tooltip with the three fields that did not get a column —
Internal ID, Account Name, Cost Center. Four columns for one concept would crowd out
the rest of the table.

Form fields, all required: Department, Engagement Code, GL Code (a dropdown over
`GET /gl-codes`, showing the code and submitting the row id).

The GL codes are fetched **by the page, not the dialog**. The source loads them inside
`DepartmentFormContent` on mount behind a full-dialog spinner, so opening the form is a
wait every single time; React Query caches them across opens.

### 3.3 Expense Types — `/finance/master-data/expense-types`

The one tab whose rows come from a POST filter, and so the only one that **shows nothing
until a filter has been applied**. That is not an empty table — it is the screen saying
it has not asked yet ("Please select filters").

Columns: **Expense Category**, **Gl Code**, **Expense Type**, **Engagement Code**,
**Engagement Code Suffix**, **Status**, Actions. Gl Code carries the same tooltip as
above; Expense Type carries one holding its description. The two engagement columns
render as chips; Status renders as a chip coloured by `active` / `inactive`.

Six filters above the table, toggled by **Show Filters** / **Hide Filters**: Expense
Category, Gl code, Expense type, Engagement code, Engagement suffix, Status
(`active` / `inactive`). **Apply Filters** issues the request; **Clear** empties the bar.

Two filter objects, not one: `draft` is what the bar is editing, `applied` is what the
table is showing. Without the split every keystroke would be a new query key and a new
request — the source avoids that with an explicit Apply, and so does this.

Form fields: Expense Category (required), Gl Code (required), Expense Type (required,
free-text — the list is the types that already exist and the point is often to add one
that does not), Expense Type Description (optional), then Engagement Codes and
Engagement Code Suffixes boxed together under *"Please fill in at least one of the
following fields"*.

That last rule is the only either-or group in the app: an expense type is scoped by
engagement codes, by suffixes, or by both — never neither.

### 3.4 Credit Cards — `/finance/master-data/credit-cards`

Columns: **CC Number**, **CC Provider Code**, **Employee Email**, **Lead Email**,
**Comment**, **Status**, Actions.

Form fields: CC Provider Code (required, `AMEX` or `SVB`), CC Number (required),
Employee Email (required), Lead Email / Emails (required, multi), Comment (optional).

The card number is validated against the shape its provider issues — `123-12345` for
AMEX, `1234-1234` for SVB — and the helper text states the format before it is typed,
or asks for a provider first when none is chosen. **Changing the provider clears the
number**, because a number typed for one is invalid for the other and leaving it would
show a filled field that silently fails validation.

## 4. Shared behaviour

### 4.1 The table

One toolbar for all four: **Column Search** (the filter panel, relabelled — on a
reference table you filter a column to find a record, and "Filters" does not say that),
**Export** (CSV), and an always-visible search box. Rows auto-size their height, because
an expense type can carry a dozen engagement-code chips and a fixed row would clip all
but the first line. Empty cells read as `-`.

Built on Oxygen UI's `DataGrid` with `FINANCE_GRID_SX`, the same as every other finance
grid, using the v8 composable toolbar primitives rather than the deprecated
`GridToolbar*` components.

### 4.2 Submit is enabled only when it would do something

Required means filled; an either-or group means at least one member filled; on the card
tab the number must also match its provider's format. When **editing**, something must
additionally have *changed* — pressing Submit on an untouched record would PATCH an
empty body.

A PATCH carries **only the changed fields**, not the whole payload, so an edit does not
look like a change to every column in whatever the service writes to its audit trail.

A required field turns red only once it has been touched and left empty, never while it
is still being filled in for the first time.

### 4.3 Delete

"Delete Confirmation" / "Are you sure you want to delete this record?" / No / Yes.

Not the shared `ConfirmationDialog`: a delete here can fail with **409** because
something still references the record, so the dialog stays open and disabled while the
request is in flight rather than closing optimistically. The shared component confirms
and dismisses in one step, which would report that conflict to a reader already returned
to the table.

### 4.4 User-facing copy

Kept verbatim from the source, collected in `masterDataCopy.ts` so the same sentence
cannot drift on one tab and not the others.

| When | Message |
|---|---|
| Added | `Data added successfully` |
| Updated | `Data update successfully` *(sic — the source's wording, kept)* |
| Deleted | `Data deleted successfully` |
| Delete blocked (409) | `Cannot proceed with this operation due to linked data. Delete other active connections to continue` |
| Load failed | `Error retrieving data. Please try again. If the issue persists, contact Internal Apps Team` |

Add / update / delete / autocomplete / GL-code / employee-email failures each keep their
own sentence, as the source has them.

## 5. Deliberate differences from the source

Everything below is a change made on purpose; everything not listed is a faithful port.

1. **`isEditForm` renamed to `isCreate`.** The source's flag is set to `!initialData`,
   so it is true when *adding*, and its form contents then read
   `isEditForm ? "Add New …" : "Update Existing …"` — landing on the right words through
   two wrongs. Renamed to what it has always meant.
2. **`isCreditCardNumberValid` returns false for an unknown provider** where the source
   throws. The throw is reachable from the form's validity check, which runs on every
   keystroke inside a `useEffect`, so a provider outside the pair would take the dialog
   down rather than just refusing to enable Submit.
3. **Dropdown data is fetched by the page, not the dialog** (§3.2), removing a spinner
   on every form open.
4. **Status and chip colours come from theme tokens**, not the source's four hardcoded
   hex values, so they survive light mode.
5. **The "Please select filters" illustration is an icon.** The drawing is an asset of
   the old app; the sentence is what does the work.
6. **Page subtitles are new.** The source has none, because each tab is a panel inside
   one app whose name is in the title bar. Here each is a route inside a portal of ~20
   apps, so a line saying what the table is for earns its place.
7. **The department form's GL Code is a searchable Autocomplete**, where the source uses
   a plain `Select` (`CustomDropDown.tsx`). Same options, same submitted value — the
   row id — but the list is long enough that scrolling it is worse than typing into it.
8. **Loading shows the grid's own overlay**, not the source's bespoke `SkeletonTable`.
9. **The expense-type table makes no request until Apply is pressed.** The source's
   `fetchData` starts `false` on that tab too, so this matches; the difference is only
   that the port expresses it as a disabled query rather than a flag.
