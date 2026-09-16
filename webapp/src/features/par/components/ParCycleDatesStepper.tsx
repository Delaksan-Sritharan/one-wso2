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

import { Box, Step, StepLabel, Stepper, Typography, useTheme } from "@wso2/oxygen-ui";
import { CircleCheckIcon, CircleIcon } from "@wso2/oxygen-ui-icons-react";
import { formatDate } from "@features/my/api/derive";
import type { ParCycle } from "../api/types";

// Ports StepperIcon.tsx — every step reads as "reached" (filled), never a
// numbered/pending state; source has no notion of which date has actually
// passed here, only which step is scrolled to.
function StepIcon({ active, completed }: { active?: boolean; completed?: boolean }) {
  const theme = useTheme();
  return active || completed ? (
    <CircleCheckIcon size={24} color={theme.palette.primary.main} />
  ) : (
    <CircleIcon size={24} color={theme.palette.action.disabled} />
  );
}

// Ports CycleDatesStepper.tsx: the cycle's five dates, always shown as one
// row. `activeStep` defaults to 0 — MultiTeamSummary.tsx opens this at 0
// and never moves it; TeamSummary.tsx's own roster instead advances it
// based on which deadlines have actually passed (see
// calculateCycleActiveStep) — the same component, two different callers,
// genuinely different behaviour in source, not a port inconsistency.
export default function ParCycleDatesStepper({
  cycle,
  activeStep = 0,
}: {
  cycle: Pick<
    ParCycle,
    "parEvaluationStartDate" | "parEmployeeDeadline" | "parLeadDeadline" | "parSpecialRatingDeadline" | "parEvaluationEndDate"
  >;
  activeStep?: number;
}) {
  const steps = [
    { date: cycle.parEvaluationStartDate, label: "Start Date" },
    { date: cycle.parEmployeeDeadline, label: "Employee PAR Deadline" },
    { date: cycle.parLeadDeadline, label: "Lead's PAR Deadline" },
    { date: cycle.parSpecialRatingDeadline, label: "Top 5%/20% Rating Submission" },
    { date: cycle.parEvaluationEndDate, label: "End Date" },
  ];

  return (
    <Box>
      <Stepper activeStep={activeStep} alternativeLabel>
        {steps.map((step) => (
          <Step key={step.label}>
            <StepLabel StepIconComponent={StepIcon}>
              <Typography>{step.date ? formatDate(step.date) : "—"}</Typography>
              <Typography sx={{ mt: -1.5 }}>{step.label}</Typography>
            </StepLabel>
          </Step>
        ))}
      </Stepper>
    </Box>
  );
}
