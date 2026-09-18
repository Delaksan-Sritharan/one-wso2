/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { useState } from "react";
import type { ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@wso2/oxygen-ui";
import { PlusIcon } from "@wso2/oxygen-ui-icons-react";
import { useAccessToken } from "@hooks/useAccessToken";
import { isOpdBackendConfigured, opdServiceUrls } from "@config/apiConfig";
import { FINANCE_EYEBROW } from "@constants/financeApps";
import { useNotifications } from "@context/notifications/NotificationsContext";
import FinanceShell from "../../components/FinanceShell";
import { DraftStatusChip } from "../../components/DraftStatusChip";
import { ReceiptViewer } from "../../components/ReceiptViewer";
import { describeError } from "../../util/financeError";
import { money, todayIso, startOfYearIso, endOfYearIso } from "../../util/financeFormat";
import { fetchReceiptObjectUrl, type ReceiptSource } from "../../util/financeReceipts";
import { useDraftAutosave } from "../../util/useDraftAutosave";
import { useOpdAppData, useOpdUserInfo } from "../useOpd";
import { useOpdDraftSync, useOpdReceiptUpload, useSubmitOpdClaim } from "../useOpdMutations";
import { OPD_ROLE, opdHasRole, type OpdClaimSummary, type OpdTransaction } from "../opdTypes";
import { OpdBalanceBar } from "./OpdBalanceBar";
import { OpdBillCard } from "./OpdBillCard";
import { OpdBillDialog } from "./OpdBillDialog";
import {
  OPD_COPY,
  billsTotal,
  draftRestoreRefusal,
  maxAllowedAmount,
  yearOf,
} from "./opdNewClaim";

/** Which year's balance the claim is filed against (`NewClaim.tsx:51-53`). */
type ClaimYear = "current" | "last";

export default function OpdNewClaimScreen() {
  return <NewClaimBody />;
}

/**
 * The shell, with the page's actions on the title's line.
 *
 * Rendered from inside the body rather than around it because the actions are
 * driven by the body's state — which bills exist, whether a submit is in
 * flight — and there is no sense in lifting all of that up a level just to
 * hand two buttons back down.
 *
 * The subtitle costs the bill list a line of height, which on a screen whose
 * whole job is a list that has to fit is not free — so it is one sentence,
 * not the two the older OPD and Expense pages carry. It says what a claim is
 * made of and where it goes, which is what a first-time claimant is missing;
 * the balance figures already speak for themselves at the foot of the page.
 */
function Frame({ actions, children }: { actions?: ReactNode; children: ReactNode }) {
  return (
    <FinanceShell
      eyebrow={FINANCE_EYEBROW.opd}
      title="New Claim"
      subtitle="Add each outpatient bill with its receipt, then submit them together to finance."
      configured={isOpdBackendConfigured()}
      configKey="ONE_WSO2_OPD_BACKEND_URL"
      actions={actions}
      // The claim area takes the height left in the page, with the balance bar
      // against the bottom — the source pins that bar to the viewport. Without
      // it the card sits at its natural height and leaves a wide band of dead
      // space under the balance figures.
      fill
    >
      {children}
    </FinanceShell>
  );
}

function NewClaimBody() {
  const userInfo = useOpdUserInfo();
  const appData = useOpdAppData();
  const upload = useOpdReceiptUpload();
  const submit = useSubmitOpdClaim();
  const draft = useOpdDraftSync();
  const { showSuccess, showError } = useNotifications();
  const getAccessToken = useAccessToken();

  const [items, setItems] = useState<OpdTransaction[]>([]);
  const [pickedYear, setPickedYear] = useState<ClaimYear>("current");
  // `null` closed; a number edits that bill; -1 adds a new one. One piece of
  // state rather than an open flag plus an index, which can disagree.
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<null | "submit" | "draft" | "year">(null);
  const [pendingYear, setPendingYear] = useState<ClaimYear | null>(null);
  const [viewing, setViewing] = useState<(() => Promise<ReceiptSource>) | null>(null);

  const email = userInfo.data?.workEmail ?? "";
  const lastYearSummary = appData.data?.lastYearClaimSummary ?? null;
  const currentYear = new Date().getFullYear();

  // The year follows the bills already added rather than being held separately:
  // the two cannot then disagree, even for a render. Read off the bill itself,
  // not the two-value tab, because a restored draft can predate last year.
  const yearOfClaim =
    items.length > 0
      ? Number(yearOf(items[0].date))
      : pickedYear === "current"
        ? currentYear
        : currentYear - 1;
  const claimYear: ClaimYear = yearOfClaim === currentYear ? "current" : "last";
  const isOlderYear = yearOfClaim < currentYear - 1;

  const summary: OpdClaimSummary | undefined = isOlderYear
    ? undefined
    : claimYear === "current"
      ? appData.data?.claimSummary
      : (lastYearSummary ?? undefined);

  const total = billsTotal(items);
  const remaining = summary?.totalRemaining ?? 0;
  const maxAmount = maxAllowedAmount(remaining, items, editingIndex);

  const savedDraft = appData.data?.draft?.transactions ?? [];
  const draftOffered = items.length === 0 && savedDraft.length > 0;

  // Debounced autosave: POST the bills while there are any, DELETE once the
  // list empties (e.g. after a submit).
  const draftState = useDraftAutosave(JSON.stringify(items), appData.isSuccess, async () => {
    if (items.length > 0) await draft.save.mutateAsync(items);
    else await draft.remove.mutateAsync();
  });

  if (userInfo.isLoading || appData.isLoading) {
    return (
      <Frame>
        <Stack spacing={1.75}>
          <Skeleton variant="rectangular" height={72} sx={{ borderRadius: 1.5 }} />
          <Skeleton variant="rectangular" height={180} sx={{ borderRadius: 1.5 }} />
        </Stack>
      </Frame>
    );
  }
  if (!opdHasRole(userInfo.data, OPD_ROLE.CLAIM_SUBMITTER)) {
    return (
      <Frame>
        <Alert severity="info">
          OPD claim submission isn&apos;t available for your account (it&apos;s limited to
          permanent employees at eligible locations).
        </Alert>
      </Frame>
    );
  }

  const dateBounds =
    claimYear === "current"
      ? { min: startOfYearIso(currentYear), max: todayIso() }
      : { min: startOfYearIso(yearOfClaim), max: endOfYearIso(yearOfClaim) };

  /** `NewClaim.tsx:246` — adding a bill drops whatever draft is held. */
  const openAdd = () => {
    if (draftOffered) {
      setConfirming("draft");
      return;
    }
    setEditingIndex(-1);
  };

  const handleRestoreDraft = () => {
    const refusal = draftRestoreRefusal(savedDraft, items);
    if (refusal) {
      showError(refusal);
      return;
    }
    setItems(savedDraft);
    setPickedYear(yearOf(savedDraft[0].date) === String(currentYear) ? "current" : "last");
    showSuccess(OPD_COPY.draftRestored);
  };

  const handleYearChange = (next: ClaimYear) => {
    if (next === claimYear) return;
    // Bills already entered belong to the other year, so the switch throws
    // them away — said before it happens, not after.
    if (items.length > 0) {
      setPendingYear(next);
      setConfirming("year");
      return;
    }
    setPickedYear(next);
  };

  const handleUpload = async (file: File): Promise<string | null> => {
    try {
      return await upload.mutateAsync({ email, file });
    } catch (err) {
      showError(describeError(err));
      return null;
    }
  };

  const handleBillSubmit = (bill: OpdTransaction) => {
    setItems((current) =>
      editingIndex !== null && editingIndex >= 0
        ? current.map((it, i) => (i === editingIndex ? bill : it))
        : [...current, bill],
    );
    setEditingIndex(null);
  };

  const openReceipt = (fileName: string) =>
    setViewing(() => async () =>
      fetchReceiptObjectUrl(opdServiceUrls.receiptFile(fileName), await getAccessToken()),
    );

  const handleSubmit = () => {
    submit.mutate(
      { transactions: items },
      {
        onSuccess: () => {
          showSuccess("OPD claim submitted for review.");
          setItems([]);
          // Removed directly rather than left to the debounce, so a claim that
          // has been filed cannot be offered back as a draft in the meantime.
          draft.remove.mutate();
          setConfirming(null);
        },
        onError: (err) => {
          showError(describeError(err));
          setConfirming(null);
        },
      },
    );
  };

  // On the title's line and against the right edge, the way `NewClaim.tsx:349-372`
  // sets "Draft saved", Add Expense and Submit beside the "New Claim" heading.
  // A row of their own below the title would cost the bill list ~50px of the
  // height it needs more.
  const actions = (
    <>
      <DraftStatusChip state={draftState} />
      {/* :359 — `claimItems.length > 0 &&`. An empty claim has nothing to add
          to and nothing to submit, so the empty state's own "Add OPD Claim" is
          the single way in; a disabled Submit and a second Add button above it
          would just be noise on the screen a first-time claimant sees. */}
      {items.length > 0 && (
        <>
          <Button
            variant="outlined"
            size="small"
            startIcon={<PlusIcon size={16} />}
            onClick={openAdd}
          >
            Add expense
          </Button>
          <Button
            variant="contained"
            size="small"
            disabled={submit.isPending}
            onClick={() => setConfirming("submit")}
          >
            {submit.isPending ? "Submitting…" : "Submit"}
          </Button>
        </>
      )}
    </>
  );

  return (
    <Frame actions={actions}>
      {/* A column that owns the height the shell handed down: the claim area
          stretches into whatever is spare and the balance bar rides at the
          bottom, rather than both sitting at the top over a band of empty
          page. */}
      <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {/* :129-130 — offered only when the backend still reports a last-year
            balance, which is what makes it claimable. */}
        {lastYearSummary && (
          <Tabs
            value={isOlderYear ? false : claimYear}
            onChange={(_e, v) => handleYearChange(v as ClaimYear)}
            aria-label="Which year to claim against"
            sx={{ mb: 2, minHeight: 36, "& .MuiTab-root": { minHeight: 36, textTransform: "none" } }}
          >
            <Tab value="current" label="This Year" />
            <Tab value="last" label="Last Year" />
          </Tabs>
        )}

        {isOlderYear && (
          <Alert severity="info" sx={{ mb: 2 }}>
            These bills are from {yearOfClaim}, so neither year&apos;s balance applies to them.
          </Alert>
        )}

        {items.length === 0 ? (
          <EmptyState
            onAdd={openAdd}
            onRestore={draftOffered ? handleRestoreDraft : undefined}
          />
        ) : (
          // One bordered panel holding the bills and the total, the way
          // `CustomCard` wraps them in the source. The scrollbar belongs to the
          // list inside it, not to the page: the panel is a fixed frame and the
          // bills move within it.
          <Card
            variant="outlined"
            sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", p: 2 }}
          >
            {/* `minHeight: 0` lets this shrink below its content so `overflowY`
                has something to do — without it a flex child is floored at its
                content height and the whole page scrolls instead. */}
            <Stack spacing={1.5} sx={{ flex: 1, minHeight: 0, overflowY: "auto", pr: 1 }}>
              {items.map((bill, i) => (
                <OpdBillCard
                  key={`${bill.date}-${i}`}
                  index={i}
                  bill={bill}
                  onView={() => bill.receiptUrl && openReceipt(bill.receiptUrl)}
                  onEdit={() => setEditingIndex(i)}
                  onRemove={() => setItems((c) => c.filter((_, j) => j !== i))}
                />
              ))}
            </Stack>

            {/* Outside the scroller, so the total stays against the bottom of the
                panel as bills are added — `AmountFooter.tsx` sits outside the
                source's scroller for the same reason. */}
            <Divider sx={{ mt: 1.5 }} />
            <Stack
              direction="row"
              justifyContent="flex-end"
              alignItems="baseline"
              spacing={1.5}
              sx={{ mt: 1.5, flexShrink: 0 }}
            >
              <Typography sx={{ fontSize: 13.5, color: "text.secondary" }}>Total Amount:</Typography>
              <Typography
                sx={{ fontSize: 17, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
              >
                {money(total)}
              </Typography>
            </Stack>
          </Card>
        )}

        {summary && <OpdBalanceBar summary={summary} />}

        {editingIndex !== null && (
          <OpdBillDialog
            // Remounted per bill, so the fields reset without an effect.
            key={editingIndex}
            open
            editing={editingIndex >= 0 ? items[editingIndex] : undefined}
            items={items}
            maxAmount={maxAmount}
            minDate={dateBounds.min}
            maxDate={dateBounds.max}
            uploading={upload.isPending}
            onUpload={handleUpload}
            onSubmit={handleBillSubmit}
            onClose={() => setEditingIndex(null)}
          />
        )}

        <ReceiptViewer title="Receipt" load={viewing} onClose={() => setViewing(null)} />

        <Confirm
          open={confirming === "submit"}
          title={OPD_COPY.submitTitle}
          body="Are you sure you want to submit this claim? Once submitted, it will be sent to the finance team for review."
          confirmLabel="Submit"
          busy={submit.isPending}
          onConfirm={handleSubmit}
          onClose={() => setConfirming(null)}
        />

        <Confirm
          open={confirming === "draft"}
          title={OPD_COPY.draftDeletionTitle}
          body={OPD_COPY.draftDeletionBody}
          confirmLabel="Confirm"
          onConfirm={() => {
            // The saved draft is dropped by the autosave once the list changes;
            // what this confirms is that it will not be offered again.
            draft.remove.mutate();
            setConfirming(null);
            setEditingIndex(-1);
          }}
          onClose={() => setConfirming(null)}
        />

        <Confirm
          open={confirming === "year"}
          title={OPD_COPY.changeYearTitle}
          body={OPD_COPY.changeYearBody}
          confirmLabel="Confirm"
          onConfirm={() => {
            setItems([]);
            if (pendingYear) setPickedYear(pendingYear);
            setPendingYear(null);
            setConfirming(null);
          }}
          onClose={() => {
            setPendingYear(null);
            setConfirming(null);
          }}
        />
      </Box>
    </Frame>
  );
}

/** `NewClaim.tsx:222-262` — what a first-time claimant sees. */
function EmptyState({ onAdd, onRestore }: { onAdd: () => void; onRestore?: () => void }) {
  return (
    <Card
      variant="outlined"
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 0.5,
        // Fills the height the body hands it rather than sitting at its natural
        // size, so the invitation is centred in the page instead of huddled at
        // the top over a band of empty space.
        flex: 1,
        minHeight: 260,
        py: 4,
        px: 3,
        textAlign: "center",
      }}
    >
      {/* `assets/images/welcome-placeholder.svg`, copied into public/ and
          referenced the way TopBar references the wordmark. Left as a file
          rather than inlined: it is 99 paths of branded illustration whose
          colours are fixed by design, so there is nothing to theme and nothing
          gained by turning it into a thousand lines of TSX.

          Decorative — the two lines below say the same thing — so it carries an
          empty alt rather than a description a screen reader would read out
          twice. */}
      <Box
        component="img"
        src="/opd-welcome.svg"
        alt=""
        // The source draws it at 200 on desktop; 160 here because One WSO2's
        // shell already spends height on a top bar, the eyebrow and the title
        // block, and 200 tipped the page into scrolling on a short window.
        sx={{ height: 160, maxWidth: "100%", mb: 1.5 }}
      />
      <Typography sx={{ fontSize: 16, fontWeight: 600 }}>{OPD_COPY.emptyTitle}</Typography>
      <Typography sx={{ fontSize: 13.5, color: "text.secondary" }}>
        {OPD_COPY.emptySubtitle}
      </Typography>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 2, flexWrap: "wrap" }}>
        <Button variant="outlined" startIcon={<PlusIcon size={16} />} onClick={onAdd}>
          {OPD_COPY.addFirstBill}
        </Button>
        {/* A saved draft is offered, never loaded: restoring silently would
            make stale bills look like work in progress, with no way to start
            fresh without first deleting bills you never entered. */}
        {onRestore && (
          <>
            <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>OR</Typography>
            <Button variant="outlined" color="success" onClick={onRestore}>
              {OPD_COPY.restoreDraft}
            </Button>
          </>
        )}
      </Stack>
    </Card>
  );
}

function Confirm({
  open,
  title,
  body,
  confirmLabel,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>{title}</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 13.5 }}>{body}</Typography>
      </DialogContent>
      <DialogActions>
        <Button size="small" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button size="small" variant="contained" onClick={onConfirm} disabled={busy}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
