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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import type { DraftResponse, QuoteView } from "@features/sales/cado2/quotes/api/quoteTypes";
import type { ApprovalStep, ApprovalWorkflow } from "@features/sales/cado2/approvals/api/approvalTypes";
import { ready, submitted } from "@features/sales/cado2/quotes/testing/fixtures";
import QuoteDetailPage from "./QuoteDetailPage";

const query = (data: unknown) => ({ data, error: null, isPending: false, isFetching: false, refetch: vi.fn() });
const quote = query(undefined as unknown);
const versions = new Map<number, DraftResponse>();
const history = query([] as unknown);
const mutation = () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, error: null as Error | null });
const recall = mutation();
const revise = mutation();
const close = mutation();
const del = mutation();

const decide = mutation();
const workflow = { data: null as ApprovalWorkflow | null, isPending: false, error: null, refetch: vi.fn() };
// The drawing needs a real browser (layout, ResizeObserver); its text companion stands in.
vi.mock("@features/sales/cado2/approvals/components/LazyApprovalDiagram", async () => ({
  default: (await import("@features/sales/cado2/approvals/components/ApprovalReasons")).default,
}));
vi.mock("@features/sales/cado2/approvals/api/useApprovalApi", () => ({
  useApprovalWorkflow: () => workflow,
  useStoredApprovalPreview: () => ({ data: undefined, isPending: false, isFetching: false, error: null }),
  useDecideStep: () => decide,
}));

const documents = query(undefined as unknown);
const issue = { ...mutation(), mutateAsync: vi.fn() };
const files = { preview: vi.fn(), download: vi.fn() };
vi.mock("@features/sales/cado2/quotes/api/useQuoteApi", () => ({
  useQuote: () => quote,
  useQuoteVersion: (_id: number, n: number) => query(versions.get(n)),
  useAuditEvents: () => history,
  useRecallVersion: () => recall,
  useReviseQuote: () => revise,
  useCloseQuote: () => close,
  useDeleteDraft: () => del,
  useDocuments: (_q: number, _v: number, enabled: boolean) => (enabled ? documents : query(undefined)),
  useIssueOrderForm: () => issue,
  useDocumentFiles: () => files,
}));

const recalledV1: DraftResponse = {
  ...submitted,
  quote: { ...submitted.quote, status: "RECALLED", actions: ["REVISE", "CLOSE"] },
  version: { ...submitted.version, status: "RECALLED" },
};

function show(q: QuoteView, ...vs: DraftResponse[]) {
  showFrom(undefined, q, ...vs);
}

/** Opens the quote page as if from another page, e.g. My Approvals. */
function showFrom(from: string | undefined, q: QuoteView, ...vs: DraftResponse[]) {
  Object.assign(quote, { data: q });
  versions.clear();
  for (const v of vs) versions.set(v.version.versionNumber, v);
  render(
    <MemoryRouter initialEntries={[`/sales/cado2/quotes/5/quote${from === "approvals" ? "?from=approvals" : ""}`]}>
      <Routes>
        <Route path="sales/cado2/quotes/:quoteId/:tab" element={<QuoteDetailPage />} />
        <Route path="sales/cado2/quotes/:quoteId/versions/:version/edit" element={<p>wizard</p>} />
        <Route path="sales/cado2/quotes" element={<p>My Quotes page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  Object.assign(decide, mutation());
  workflow.data = null;
  Object.assign(recall, mutation());
  Object.assign(revise, mutation());
  Object.assign(close, mutation());
  Object.assign(del, mutation());
  Object.assign(history, query([]));
});

describe("QuoteDetailPage — lifecycle", () => {
  it("goes back to My Approvals when opened from there, else to My Quotes", () => {
    showFrom("approvals", submitted.quote, submitted);
    expect(screen.getByRole("link", { name: /My Approvals/ })).toHaveAttribute("href", "/sales/cado2/approvals");
    cleanup();
    show(submitted.quote, submitted);
    expect(screen.getByRole("link", { name: /My Quotes/ })).toHaveAttribute("href", "/sales/cado2/quotes");
  });

  it("offers only Recall on a submitted quote", async () => {
    show(submitted.quote, submitted);
    const user = userEvent.setup();

    expect(screen.getByRole("heading", { level: 1, name: "Q-26-00005" })).toBeInTheDocument();
    expect(screen.queryByText("Acme APIM renewal · Acme Corp")).toBeNull(); // nothing under the title
    expect(screen.queryByRole("button", { name: "Revise" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Close quote" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete draft" })).toBeNull(); // only a draft

    await user.click(screen.getByRole("button", { name: "Recall" }));
    const dialog = screen.getByRole("dialog", { name: "Recall version 1?" });
    await user.type(within(dialog).getByLabelText(/Why are you recalling it/), "Customer wants 30 gateways");
    await user.click(within(dialog).getByRole("button", { name: "Recall" }));

    expect(recall.mutate).toHaveBeenCalledWith({ quoteId: 5, version: 1, reason: "Customer wants 30 gateways" }, expect.anything());
  });

  it("revises a recalled version and opens the new draft", async () => {
    revise.mutate.mockImplementation((_vars, opts) => opts.onSuccess({ ...ready, version: { ...ready.version, versionNumber: 2 } }));
    show(recalledV1.quote, recalledV1);
    const user = userEvent.setup();

    expect(screen.getByText("Recalled")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Revise" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Create version 2" }));

    expect(revise.mutate).toHaveBeenCalledWith({ quoteId: 5 }, expect.anything());
    expect(await screen.findByText("wizard")).toBeInTheDocument();
  });

  it("needs a reason to close, and warns that it is permanent", async () => {
    show(recalledV1.quote, recalledV1);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Close quote" }));
    const dialog = screen.getByRole("dialog", { name: "Close Q-26-00005?" });
    expect(within(dialog).getByText(/This is permanent/)).toBeInTheDocument();
    const confirm = within(dialog).getByRole("button", { name: "Close quote" });
    expect(confirm).toBeDisabled();

    await user.type(within(dialog).getByLabelText(/Why is the quote closing/), "Customer chose a competitor");
    await user.click(confirm);

    expect(close.mutate).toHaveBeenCalledWith({ quoteId: 5, reason: "Customer chose a competitor" }, expect.anything());
  });

  it("deletes a quote's only draft, and with it the quote", async () => {
    show(ready.quote, ready);
    const user = userEvent.setup();
    // Never submitted, so it has no number: it is named by customer and deal.
    expect(screen.getByRole("heading", { level: 1, name: "Acme Corp · Acme APIM renewal" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete draft" }));
    const dialog = screen.getByRole("dialog", { name: "Delete this draft quote?" });
    expect(within(dialog).getByText(/only has a draft, so Acme Corp · Acme APIM renewal is removed completely\. This can't be undone/)).toBeInTheDocument();

    del.mutate.mockImplementation((_vars, opts) => opts.onSuccess({ quoteDeleted: true, latest: null }));
    await user.click(within(dialog).getByRole("button", { name: "Delete quote" }));
    expect(del.mutate).toHaveBeenCalledWith({ quoteId: 5, version: 1, expectedUpdatedAt: ready.version.updatedAt }, expect.anything());
    expect(await screen.findByText("My Quotes page")).toBeInTheDocument();
  });

  it("deletes a later draft, and the version before it is the latest again", async () => {
    const v2: DraftResponse = { ...ready, version: { ...ready.version, versionNumber: 2 } };
    const q: QuoteView = {
      ...ready.quote,
      versions: [
        { versionNumber: 1, status: "RECALLED", tcv: "0.00", submittedAt: null, updatedAt: "2026-09-25T09:00:00Z" },
        { versionNumber: 2, status: "DRAFT", tcv: "0.00", submittedAt: null, updatedAt: v2.version.updatedAt },
      ],
    };
    show(q, recalledV1, v2);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Delete draft" }));
    const dialog = screen.getByRole("dialog", { name: "Delete draft v2?" });
    expect(within(dialog).getByText(/Version 1 \(Recalled\) becomes the latest again\. This can't be undone/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Delete draft" }));
    expect(del.mutate).toHaveBeenCalledWith({ quoteId: 5, version: 2, expectedUpdatedAt: v2.version.updatedAt }, expect.anything());
  });

  it("shows a draft's owner Continue and Close", () => {
    show(ready.quote, ready);
    expect(screen.getByRole("link", { name: "Continue draft v1" })).toHaveAttribute("href", "/sales/cado2/quotes/5/versions/1/edit");
    expect(screen.getByRole("button", { name: "Close quote" })).toBeInTheDocument();
  });

  it("gives an Admin (no actions) a read-only page with the whole quote", () => {
    show({ ...submitted.quote, actions: [] }, submitted);
    expect(screen.queryByRole("button", { name: "Recall" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Close quote" })).toBeNull();
    expect(screen.getByRole("region", { name: "Customer" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Products" })).toBeInTheDocument();
  });

  it("lets an approver decide their step, with a comment to send it back", async () => {
    const user = userEvent.setup();
    const step = (role: ApprovalStep["role"], roleLabel: string, over: Partial<ApprovalStep> = {}): ApprovalStep => ({
      stepId: role === "DEAL_DESK" ? 11 : 12, role, roleLabel, branches: role === "DEAL_DESK" ? [] : ["DISCOUNT"],
      dependsOn: role === "DEAL_DESK" ? [] : ["DEAL_DESK"], status: "WAITING", requestedAt: null, actedAt: null,
      actedByEmail: null, comment: null, canAct: false, cantActReason: null,
      triggers: [{ rule: "DISCOUNT", branch: "DISCOUNT", lineNumber: 1, reason: "Line 1: 10% discount is above the Account Manager's 5% limit" }],
      ...over,
    });
    workflow.data = {
      status: "IN_PROGRESS", createdAt: "2026-10-01T09:00:00Z", completedAt: null,
      steps: [
        // Waiting 26 h on a 24 h SLA.
        step("DEAL_DESK", "Deal Desk", { status: "PENDING", canAct: true, requestedAt: new Date(Date.now() - 26 * 3_600_000).toISOString(),
          dueAt: new Date(Date.now() - 2 * 3_600_000).toISOString(), slaState: "BREACHED" }),
        step("REGIONAL_DIRECTOR", "Regional Director"),
      ],
    };
    show({ ...submitted.quote, actions: [] }, submitted);

    expect(screen.getByRole("region", { name: "Approval summary" })).toHaveTextContent("Waiting on Deal Desk · 0 of 2 approved");

    await user.click(await screen.findByRole("tab", { name: "Approvals" }));
    const chain = screen.getByRole("list", { name: "Approval chain" });
    expect(within(chain).getByRole("listitem", { name: "Deal Desk" })).toHaveTextContent("Your turn");
    expect(within(chain).getByRole("listitem", { name: "Deal Desk" })).toHaveTextContent("Overdue by 2 h"); // its deadline
    expect(within(chain).getByRole("listitem", { name: "Regional Director" })).toHaveTextContent("above the Account Manager's 5% limit");

    await user.click(screen.getByRole("button", { name: "Request changes" }));
    const dialog = screen.getByRole("dialog");
    const send = within(dialog).getByRole("button", { name: "Request changes" });
    expect(send).toBeDisabled();
    await user.type(within(dialog).getByRole("textbox"), "Use the FY26 price book");
    await user.click(send);
    expect(decide.mutate).toHaveBeenCalledWith(
      { quoteId: 5, version: 1, stepId: 11, outcome: "request-changes", comment: "Use the FY26 price book" },
      expect.anything(),
    );
  });

  it("shows Deal Desk the categories the rep chose, and asks them to confirm on approval", async () => {
    const user = userEvent.setup();
    const [first, ...rest] = submitted.version.lines;
    const mixed: DraftResponse = {
      ...submitted,
      version: {
        ...submitted.version,
        lines: [{ ...first, categorySource: "REP" }, ...rest.map((l) => ({ ...l, categorySource: "MAPPED" as const }))],
      },
    };
    workflow.data = {
      status: "IN_PROGRESS", createdAt: "2026-10-01T09:00:00Z", completedAt: null,
      steps: [{
        stepId: 11, role: "DEAL_DESK", roleLabel: "Deal Desk", branches: [], dependsOn: [], status: "PENDING",
        requestedAt: null, actedAt: null, actedByEmail: null, comment: null, canAct: true, cantActReason: null, triggers: [],
      }],
    };
    show({ ...submitted.quote, actions: [] }, mixed);

    const notice = screen.getByRole("region", { name: "Categories chosen by the rep" });
    expect(notice).toHaveTextContent("1 line uses a category chosen by the rep");
    expect(notice).toHaveTextContent(first.productName);
    expect(within(screen.getByRole("table", { name: "Products" })).getAllByText("Category chosen by rep")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Approve" }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByRole("region", { name: "Categories chosen by the rep" })).toHaveTextContent(/By approving, you confirm/);
  });

  it("shows no category notice when every product is mapped", () => {
    const allMapped: DraftResponse = {
      ...submitted,
      version: { ...submitted.version, lines: submitted.version.lines.map((l) => ({ ...l, categorySource: "MAPPED" as const })) },
    };
    show(submitted.quote, allMapped);
    expect(screen.queryByRole("region", { name: "Categories chosen by the rep" })).toBeNull();
    expect(screen.queryByText("Category chosen by rep")).toBeNull();
  });

  it("explains a closed quote", () => {
    const closed: DraftResponse = {
      ...ready,
      quote: { ...ready.quote, status: "CLOSED", actions: [] },
      version: { ...ready.version, status: "CLOSED", closedReason: "Customer chose a competitor", closedByEmail: "rep@wso2.com", closedAt: "2026-10-05T09:00:00Z" },
    };
    show(closed.quote, closed);
    expect(screen.getAllByText("Closed").length).toBeGreaterThan(0);
    const lifecycle = screen.getByRole("list", { name: "Lifecycle" });
    expect(within(lifecycle).getByText("Quote closed")).toBeInTheDocument();
    expect(within(lifecycle).getByText("“Customer chose a competitor”")).toBeInTheDocument();
    expect(within(lifecycle).getByText(/5 Oct 2026 · rep@wso2.com/)).toBeInTheDocument();
  });
});

describe("QuoteDetailPage — versions and history", () => {
  const v2: DraftResponse = {
    ...ready,
    quote: {
      ...recalledV1.quote,
      status: "DRAFT",
      actions: ["CLOSE"],
      versions: [
        { versionNumber: 1, status: "RECALLED", tcv: "6480.00", submittedAt: "2026-10-01T09:30:00Z", updatedAt: "2026-10-02T09:30:00Z" },
        { versionNumber: 2, status: "DRAFT", tcv: "9720.00", submittedAt: null, updatedAt: "2026-10-03T09:30:00Z" },
      ],
    },
    version: { ...ready.version, versionNumber: 2, copiedFromVersion: 1, lines: [{ ...ready.version.lines[0], quantity: 30 }] },
  };

  it("lists the versions and compares the last two, changes only", async () => {
    show(v2.quote, recalledV1, v2);
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Versions (2)" }));

    const table = screen.getByRole("table", { name: "Versions" });
    expect(within(table).getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/sales/cado2/quotes/5/versions/2/edit");
    expect(within(table).getByRole("link", { name: "View" })).toHaveAttribute("href", "/sales/cado2/quotes/5/versions/1/edit");

    const diff = screen.getByRole("table", { name: "Comparison" });
    expect(within(diff).getByText("WSO2 Gateway · Quantity")).toBeInTheDocument();
    expect(within(diff).queryByText("Currency")).toBeNull();

    await user.click(screen.getByRole("button", { name: "All fields" }));
    expect(within(screen.getByRole("table", { name: "Comparison" })).getByText("Currency")).toBeInTheDocument();
  });

  it("shows the history newest first, with grouped saves and reasons", async () => {
    const e = (id: number, eventType: string, extra = {}) => ({
      id, eventType, versionNumber: 1, actorEmail: "rep@wso2.com", occurredAt: `2026-10-0${id}T09:00:00Z`,
      fromStatus: null, toStatus: null, comment: null, metadata: null, ...extra,
    });
    Object.assign(history, query([
      e(1, "QUOTE_CREATED"), e(2, "DRAFT_SAVED"), e(3, "DRAFT_SAVED"),
      e(4, "VERSION_RECALLED", { comment: "Customer wants 30 gateways" }),
    ]));
    show(recalledV1.quote, recalledV1);
    await userEvent.setup().click(screen.getByRole("tab", { name: "History (4)" }));

    const items = within(screen.getByRole("list", { name: "History" })).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Version 1 recalled");
    expect(items[0]).toHaveTextContent("“Customer wants 30 gateways”");
    expect(items[1]).toHaveTextContent("Version 1 draft saved ×2");
  });
});

describe("QuoteDetailPage — order form", () => {
  const approved: DraftResponse = {
    ...submitted,
    quote: { ...submitted.quote, status: "APPROVED", actions: ["CLOSE"] },
    version: { ...submitted.version, status: "APPROVED" },
  };
  const quoteOf = (r: DraftResponse): QuoteView => ({ ...r.quote, versions: [{ versionNumber: 1, status: r.version.status, tcv: "6480.00", submittedAt: null, updatedAt: r.version.updatedAt }] }) as unknown as QuoteView;
  const panel = () => within(screen.getByRole("region", { name: "Order form" }));

  it("previews, then issues once, confirming the dates it will set", async () => {
    Object.assign(documents, { data: { canPreview: true, canIssue: true, issueDate: "2026-10-12", expiryDate: "2026-11-11", documents: [] } });
    issue.mutateAsync.mockResolvedValue({});
    show(quoteOf(approved), approved);
    const user = userEvent.setup();

    expect(panel().getByText(/ready to issue/)).toBeInTheDocument();
    expect(panel().getByRole("button", { name: "Preview PDF" })).toBeInTheDocument();
    await user.click(panel().getByRole("button", { name: "Issue order form" }));
    const dialog = within(screen.getByRole("dialog", { name: "Issue the order form?" }));
    expect(dialog.getByText("12 Oct 2026")).toBeInTheDocument();
    expect(dialog.getByText("11 Nov 2026")).toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: "Issue order form" }));
    expect(issue.mutateAsync).toHaveBeenCalledWith({ quoteId: approved.quote.id, version: 1 });
  });

  it("offers the issued file for download", () => {
    Object.assign(documents, {
      data: {
        canPreview: false, canIssue: false, issueDate: "2026-10-13", expiryDate: "2026-11-12",
        documents: [{ id: 9, documentNumber: 1, documentType: "ORDER_FORM", layout: "DIRECT", status: "ACTIVE", fileName: "Q-26-00005-v1-d1.pdf",
          sizeBytes: 70000, sha256: "a".repeat(64), issueDate: "2026-10-12", expiryDate: "2026-11-11", generatedAt: "2026-10-12T09:00:00Z", generatedByEmail: "rep@wso2.com" }],
      },
    });
    show(quoteOf(approved), approved);
    expect(panel().getByText("Issued 12 Oct 2026")).toBeInTheDocument();
    expect(panel().getByRole("button", { name: "Download PDF" })).toBeInTheDocument();
    expect(panel().queryByRole("button", { name: "Issue order form" })).toBeNull();
  });

  it("shows no order form before approval", () => {
    show(quoteOf(submitted), submitted);
    expect(screen.queryByRole("region", { name: "Order form" })).toBeNull();
  });
});
