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

import { useMemo, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Avatar,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { ChevronDownIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useLeaveEmployees } from "@features/leave/api/useLeaveData";
import { useParRating } from "../api/useParData";
import { useAllClosedParCycles, useParEmployeeReviews, useParLegacyHistory } from "../api/useLeadHistory";
import { buildMergedCycleOptions } from "../util/parEmployeeHistory";
import { deriveLegacyRatingFromScore, parseLegacyQuestionAnswers } from "../util/parLegacyHistory";
import { decodeParComment } from "../util/parComment";
import { employeeChipLabel } from "../util/parLabels";
import { ParCommentView } from "./ParContent";
import ParEmptyState from "./ParEmptyState";
import ParHistoryReviewSection from "./ParHistoryReviewSection";
import ParLegacyReviewSection from "./ParLegacyReviewSection";
import type { ParLegacyHistoryByEmail } from "../api/useLeadHistory";

type CycleSelection = { kind: "none" } | { kind: "real"; parCycleId: number } | { kind: "legacy"; cycleName: string };

function InfoItem({ title, subtitle1, subtitle2 }: { title: string; subtitle1: string; subtitle2: string }) {
  return (
    <Grid size="grow">
      <Typography variant="body1">{title || "—"}</Typography>
      <Typography variant="body2" color="text.secondary">
        {subtitle1}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {subtitle2 || "—"}
      </Typography>
    </Grid>
  );
}

// par-app's EmployeeHistoryCard.tsx: the same real+legacy cycle history
// ParLeadEmployeeHistoryTab.tsx shows, for one fixed employee (no employee
// picker) in a modal instead of a full tab.
export default function ParLeadHistoryModal({
  open,
  onClose,
  employeeEmail,
  employeeName,
}: {
  open: boolean;
  onClose: () => void;
  employeeEmail: string;
  employeeName: string;
}) {
  const realCycles = useAllClosedParCycles();
  const legacyHistory = useParLegacyHistory(employeeEmail, open);
  const thumbnails = useLeaveEmployees();
  const thumbnailByEmail = useMemo(
    () => new Map(thumbnails.data?.map((e) => [e.workEmail, e.employeeThumbnail]) ?? []),
    [thumbnails.data],
  );

  const [cycleSelection, setCycleSelection] = useState<CycleSelection>({ kind: "none" });

  const isRealCycle = cycleSelection.kind === "real";
  const isLegacyCycle = cycleSelection.kind === "legacy";
  const realCycleId = isRealCycle ? cycleSelection.parCycleId : undefined;

  const rating = useParRating(realCycleId, employeeEmail, isRealCycle);
  const reviews = useParEmployeeReviews(realCycleId, isRealCycle ? employeeEmail : undefined);

  const legacyByEmail: ParLegacyHistoryByEmail = { [employeeEmail]: legacyHistory.data };
  const cycleOptions = buildMergedCycleOptions(realCycles.data ?? [], legacyByEmail);
  const cyclePickerValue = isLegacyCycle ? `legacy-${cycleSelection.cycleName}` : isRealCycle ? String(cycleSelection.parCycleId) : "none";

  const handleCycleChange = (value: string) => {
    if (value === "none") {
      setCycleSelection({ kind: "none" });
    } else if (value.startsWith("legacy-")) {
      setCycleSelection({ kind: "legacy", cycleName: value.slice("legacy-".length) });
    } else {
      setCycleSelection({ kind: "real", parCycleId: Number(value) });
    }
  };

  const legacyRecords = legacyHistory.data ?? [];
  const selectedLegacyRecord = isLegacyCycle
    ? legacyRecords.find((record) => record.cycleName === cycleSelection.cycleName)
    : undefined;

  const isMeaningfulLegacyText = (text: string | null | undefined): text is string =>
    Boolean(text) && text!.trim() !== "" && text!.trim() !== "N/A";
  const legacyEmployeeContent = parseLegacyQuestionAnswers(selectedLegacyRecord?.questionAnswers ?? null)
    .map((qa) => qa.employeeAnswer)
    .filter(isMeaningfulLegacyText)
    .join("\n\n");
  const legacyLeadContent = isMeaningfulLegacyText(selectedLegacyRecord?.overallCommentManager)
    ? selectedLegacyRecord!.overallCommentManager!
    : "";

  // "No record" wording stays deliberately vague: the backend can't tell "no
  // rating exists for this cycle" apart from a genuine fetch error here.
  const realCycleNotAvailable = isRealCycle && (rating.isError || reviews.isError || (rating.isSuccess && !rating.data));
  const legacyCycleNotAvailable = isLegacyCycle && legacyHistory.isSuccess && !selectedLegacyRecord;

  const showRealDetails = isRealCycle && rating.isSuccess && Boolean(rating.data) && reviews.isSuccess;
  const showLegacyDetails = isLegacyCycle && Boolean(selectedLegacyRecord);
  const isLoadingSelection = (isRealCycle && (rating.isLoading || reviews.isLoading)) || (isLegacyCycle && legacyHistory.isLoading);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        Employee History
        <IconButton onClick={onClose} aria-label="close">
          <XIcon size={18} />
        </IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent>
        <Stack spacing={2}>
          <TextField
            select
            fullWidth
            size="small"
            disabled={realCycles.isLoading || legacyHistory.isLoading || cycleOptions.length === 0}
            value={cyclePickerValue}
            onChange={(e) => handleCycleChange(e.target.value)}
            slotProps={{ select: { native: true } }}
          >
            <option value="none">{cycleOptions.length === 0 ? "No previous PAR cycles found" : "Please select a PAR cycle"}</option>
            {cycleOptions.map((option) => (
              <option key={option.key} value={option.isLegacy ? `legacy-${option.cycleName}` : String(option.parCycleId)}>
                {option.label}
              </option>
            ))}
          </TextField>

          {realCycles.isError && (
            <ErrorNotice error={realCycles.error} onRetry={() => realCycles.refetch()} retrying={realCycles.isFetching}>
              Couldn't load past PAR cycles.
            </ErrorNotice>
          )}

          {isLegacyCycle && legacyHistory.isError && (
            <ErrorNotice error={legacyHistory.error} onRetry={() => legacyHistory.refetch()} retrying={legacyHistory.isFetching}>
              Couldn't load this employee's legacy PAR history.
            </ErrorNotice>
          )}

          {isLoadingSelection && <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 1.5 }} />}

          {legacyCycleNotAvailable && (
            <ParEmptyState text="Not Available -- this employee has no PAR record for the selected cycle." />
          )}
          {realCycleNotAvailable && (
            <ParEmptyState text="No PAR record found for the selected cycle, or it could not be loaded right now. Try again, or check back later if this seems wrong." />
          )}

          {showLegacyDetails && selectedLegacyRecord && (
            <Stack spacing={2}>
              <Grid container spacing={2}>
                <Grid size="auto">
                  {/* The avatar is the employee's own thumbnail regardless of
                      cycle type — not a per-legacy-record field. */}
                  <Avatar variant="rounded" src={thumbnailByEmail.get(employeeEmail)} alt="Employee Thumbnail" sx={{ width: 100, height: 100 }} />
                </Grid>
                {(() => {
                  const derived = deriveLegacyRatingFromScore(selectedLegacyRecord.managerScoreCode);
                  const rating2 = selectedLegacyRecord.overallRating ?? derived.rating;
                  const special = selectedLegacyRecord.overallSpecialRating ?? derived.special;
                  return (
                    <Grid size="grow">
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        {special && special !== "NOT_ASSIGNED" && (
                          <Chip size="small" color={employeeChipLabel(special).color} label={employeeChipLabel(special).label} />
                        )}
                        {rating2 && <Chip size="small" color={employeeChipLabel(rating2).color} label={employeeChipLabel(rating2).label} />}
                      </Stack>
                      {(selectedLegacyRecord.reviewerEmail || selectedLegacyRecord.reviewerName) && (
                        <Chip
                          size="small"
                          sx={{ mt: 1 }}
                          label={`PAR shared by: ${selectedLegacyRecord.reviewerEmail ?? selectedLegacyRecord.reviewerName}`}
                        />
                      )}
                    </Grid>
                  );
                })()}
                <InfoItem title={employeeName} subtitle1="Employee" subtitle2={employeeEmail} />
                <InfoItem
                  title={selectedLegacyRecord.reviewerName ?? selectedLegacyRecord.reviewerEmail ?? ""}
                  subtitle1="Lead"
                  subtitle2={selectedLegacyRecord.reviewerEmail ?? ""}
                />
                <InfoItem title={selectedLegacyRecord.team ?? ""} subtitle1="Team" subtitle2={selectedLegacyRecord.department ?? ""} />
              </Grid>

              <Divider />

              {/* Both accordions share one combined condition: disabled only
                  when BOTH sides are empty, expanded only when BOTH have
                  content. */}
              <Accordion
                disabled={!legacyEmployeeContent && !legacyLeadContent}
                defaultExpanded={Boolean(legacyEmployeeContent) && Boolean(legacyLeadContent)}
                sx={{ mt: 1 }}
              >
                <AccordionSummary expandIcon={<ChevronDownIcon size={18} />}>Employee PAR</AccordionSummary>
                <AccordionDetails>
                  <Divider sx={{ my: 1 }} />
                  <ParCommentView html={legacyEmployeeContent} />
                </AccordionDetails>
              </Accordion>
              <Accordion
                disabled={!legacyEmployeeContent && !legacyLeadContent}
                defaultExpanded={Boolean(legacyEmployeeContent) && Boolean(legacyLeadContent)}
                sx={{ mt: 1 }}
              >
                <AccordionSummary expandIcon={<ChevronDownIcon size={18} />}>Lead's Feedback</AccordionSummary>
                <AccordionDetails>
                  <Divider sx={{ my: 1 }} />
                  <ParCommentView html={legacyLeadContent} />
                </AccordionDetails>
              </Accordion>

              <Divider />

              <ParLegacyReviewSection feedback360={selectedLegacyRecord.feedback360} />
            </Stack>
          )}

          {showRealDetails && rating.data && (
            <Stack spacing={2}>
              <Grid container spacing={2}>
                <Grid size="auto">
                  <Avatar
                    variant="rounded"
                    src={thumbnailByEmail.get(employeeEmail)}
                    alt="Employee Thumbnail"
                    sx={{ width: 100, height: 100 }}
                  />
                </Grid>
                <Grid size="grow">
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {rating.data.parSpecialRating && (
                      <Chip
                        size="small"
                        color={employeeChipLabel(rating.data.parSpecialRating).color}
                        label={employeeChipLabel(rating.data.parSpecialRating).label}
                      />
                    )}
                    {rating.data.parRating && (
                      <Chip size="small" color={employeeChipLabel(rating.data.parRating).color} label={employeeChipLabel(rating.data.parRating).label} />
                    )}
                  </Stack>
                  {rating.data.parRatingSharedBy && (
                    <Chip size="small" sx={{ mt: 1 }} label={`PAR shared by: ${rating.data.parRatingSharedBy}`} />
                  )}
                </Grid>
                <InfoItem title={employeeName} subtitle1="Employee" subtitle2={employeeEmail} />
                <InfoItem title={rating.data.parLeadEmail ?? ""} subtitle1="Lead" subtitle2={rating.data.parLeadEmail ?? ""} />
                <InfoItem title={rating.data.parTeam ?? ""} subtitle1="Team" subtitle2={rating.data.parDepartment ?? ""} />
              </Grid>

              <Divider />

              <Accordion
                disabled={!rating.data.parEmployeeComment?.trim() && !rating.data.parLeadComment?.trim()}
                defaultExpanded={Boolean(rating.data.parEmployeeComment?.trim()) && Boolean(rating.data.parLeadComment?.trim())}
                sx={{ mt: 1 }}
              >
                <AccordionSummary expandIcon={<ChevronDownIcon size={18} />}>Employee PAR</AccordionSummary>
                <AccordionDetails>
                  <Divider sx={{ my: 1 }} />
                  <ParCommentView html={decodeParComment(rating.data.parEmployeeComment)} />
                </AccordionDetails>
              </Accordion>
              <Accordion
                disabled={!rating.data.parEmployeeComment?.trim() && !rating.data.parLeadComment?.trim()}
                defaultExpanded={Boolean(rating.data.parEmployeeComment?.trim()) && Boolean(rating.data.parLeadComment?.trim())}
                sx={{ mt: 1 }}
              >
                <AccordionSummary expandIcon={<ChevronDownIcon size={18} />}>Lead's Feedback</AccordionSummary>
                <AccordionDetails>
                  <Divider sx={{ my: 1 }} />
                  <ParCommentView html={decodeParComment(rating.data.parLeadComment)} />
                </AccordionDetails>
              </Accordion>

              <Divider />

              <ParHistoryReviewSection reviews={reviews.data ?? []} />
            </Stack>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
