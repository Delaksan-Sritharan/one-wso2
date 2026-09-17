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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import { Box, Stack, Typography } from "@wso2/oxygen-ui";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { UmtUpdateSummary } from "../../api/umtUpdates";
import { useUmtGate } from "../../api/useUmtGate";
import { useUmtLifecycleTransition } from "../../api/useUmtLifecycleTransition";
import { useUmtProductAnalysis, useUmtPullRequestAnalysis } from "../../api/useUmtUpdateViewData";
import { computeUmtEditSteps, umtActiveStepIndex, umtHasAdditionalFileOperations } from "../../lib/umtEditSteps";
import UmtEditStepActions from "./UmtEditStepActions";
import UmtEditStepPlaceholder from "./UmtEditStepPlaceholder";
import UmtEditStepper from "./UmtEditStepper";
import UmtPrAnalysisStep from "./pr-analysis/UmtPrAnalysisStep";
import UmtProductAnalysisStep from "./product-analysis/UmtProductAnalysisStep";

export default function UmtUpdateEditTab({
  id,
  update,
}: {
  id: string;
  update: UmtUpdateSummary;
}) {
  const pullRequestAnalysis = useUmtPullRequestAnalysis(id, update.lifecycleState);
  const productAnalysis = useUmtProductAnalysis(id, update.lifecycleState, { alwaysEnabled: true });
  const gate = useUmtGate();
  const transition = useUmtLifecycleTransition(id);
  const { showSuccess, showError } = useNotifications();

  const hasFileOps = umtHasAdditionalFileOperations(pullRequestAnalysis.data, update.lifecycleState);
  const steps = computeUmtEditSteps(update.lifecycle, hasFileOps);
  const activeIndex = umtActiveStepIndex(update.lifecycleState, steps);
  const currentStep = steps[activeIndex];

  const isFileApproval = currentStep.id === "file-approval";
  const isCloudDevelopment = currentStep.id === "cloud-development";
  const isProductAnalysis = currentStep.id === "product-analysis";
  const isTerminal = currentStep.id === "completed" || currentStep.id === "cloud-released";
  const roleAllowed = !isFileApproval || gate.isAdmin || gate.isProductLead;
  // Mirrors legacy's productAnalysisState === success gate: Proceed here
  // promotes lifecycle state, so it shouldn't be available until the
  // product-analysis results this step promises have actually loaded.
  const productAnalysisReady = !isProductAnalysis || productAnalysis.isSuccess;
  // Only File Approval, Cloud Support's Development step, and now Product
  // Analysis are wired (currentStep.proceedWired); every other step's
  // Proceed is a stub. Cloud Support's single transition is hardcoded to
  // "Released" per legacy; every other wired step sends the backend's own
  // promoteStages[0] rather than a value this shell invents.
  const nextLifecycleState = isCloudDevelopment ? "Released" : update.promoteStages?.[0];

  const handleProceed = async () => {
    if (!currentStep.proceedWired || !nextLifecycleState || !productAnalysisReady) return;
    try {
      await transition.mutateAsync(nextLifecycleState);
      showSuccess(`Update ${id} advanced to ${nextLifecycleState}`);
    } catch (error) {
      showError(`Proceed failed. ${describeError(error)}`);
    }
  };

  return (
    <Stack spacing={3}>
      <UmtEditStepper steps={steps} activeIndex={activeIndex} />
      <Box sx={{ pt: 2 }}>
        {isTerminal ? (
          <Typography>All states completed.</Typography>
        ) : currentStep.id === "pr-analysis" ? (
          <UmtPrAnalysisStep id={id} update={update} />
        ) : currentStep.id === "product-analysis" ? (
          <UmtProductAnalysisStep id={id} update={update} />
        ) : (
          <UmtEditStepPlaceholder stepLabel={currentStep.label} />
        )}
      </Box>
      {!isTerminal && currentStep.id !== "pr-analysis" && (
        <UmtEditStepActions
          proceedLabel={isFileApproval ? "Approve and Proceed" : "Proceed"}
          proceedDisabled={!currentStep.proceedWired || !roleAllowed || !nextLifecycleState || !productAnalysisReady}
          proceedLoading={transition.isPending}
          explanation={
            !currentStep.proceedWired
              ? "This step isn't wired up yet."
              : !roleAllowed
                ? "Only UMT Admins or Product Leads can approve this step."
                : !productAnalysisReady
                  ? "Waiting for product analysis results."
                  : undefined
          }
          onProceed={() => void handleProceed()}
        />
      )}
    </Stack>
  );
}
