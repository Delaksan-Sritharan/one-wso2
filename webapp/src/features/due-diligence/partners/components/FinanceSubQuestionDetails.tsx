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

import { useRef, useState } from "react";
import { Alert, Box, Button, FormControl, FormControlLabel, Radio, RadioGroup, Snackbar, Stack, TextField, Typography } from "@wso2/oxygen-ui";
import { FileIcon, UploadIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import { humanizeHttpError } from "@api/http";
import { FILE_UPLOAD_LIMIT } from "@features/due-diligence/constants";
import { useDeletePartnerFile, useSavePartnerFilesMetadata, useUploadPartnerFile } from "../api/useFinance";
import type { FileSubmission, FinanceComment, PartnerAnswer, QuestionInfo, SubQuestionInfo } from "../api/financeTypes";

/**
 * Ported from the source app's Resellers/ResellerDashboard/Finance/SubQuestionDetails.js
 * — renders one of three answer shapes (boolean radio, free-text, file
 * upload) per sub-question, faithfully keeping the source's disable rules:
 * a Q44 (finance approval) radio stays disabled until AT LEAST ONE comment
 * exists on either Q42 (creator) or Q43 (reviewer) — the source counts them
 * together, not per-question — AND the approval email has been sent. See
 * `shouldDisableRadioButtons`, a direct port of the source's own
 * `getTotalCommentsForQuestions`/`shouldDisableRadioButtons`.
 */
export default function FinanceSubQuestionDetails({
  companyId,
  question,
  subQuestion,
  answer,
  files,
  comments,
  approvalEmailSent,
  applicantEmail,
  fieldDisabled,
  onAnswered,
}: {
  companyId: string;
  question: QuestionInfo;
  subQuestion: SubQuestionInfo;
  answer?: PartnerAnswer;
  files: FileSubmission[];
  comments: FinanceComment[];
  approvalEmailSent: boolean;
  applicantEmail: string;
  fieldDisabled: boolean;
  onAnswered: (subQuestionId: number, booleanAnswer: boolean | "", descriptionAnswer: string, isValid: boolean) => void;
}) {
  const uploadFile = useUploadPartnerFile();
  const deleteFile = useDeletePartnerFile();
  const saveMetadata = useSavePartnerFilesMetadata(companyId);

  // Tri-state, not a plain boolean: "" (unanswered) and "no" must stay
  // distinguishable, or picking "no" on a question with no saved answer yet
  // renders as blank instead of Reject — see LegalSubQuestionDetails.tsx for
  // the identical reasoning.
  const [radioValue, setRadioValue] = useState<"yes" | "no" | "">(
    answer === undefined ? "" : answer.booleanAnswer ? "yes" : "no",
  );
  const [pendingFiles, setPendingFiles] = useState<{ fileName: string }[]>([]);
  const [snack, setSnack] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const savedFiles = files.filter((f) => f.subQuestionId === subQuestion.subQuestionId);

  const totalQ42Q43Comments = comments.filter((c) => c.questionId === 42 || c.questionId === 43).length;
  const shouldDisableRadioButtons = totalQ42Q43Comments === 0 || !approvalEmailSent;

  const handleRadioChange = (value: string) => {
    const boolValue = value === "yes";
    setRadioValue(boolValue ? "yes" : "no");
    onAnswered(subQuestion.subQuestionId, boolValue, "", true);
  };

  const handleTextChange = (value: string) => {
    const current = answer?.descriptionAnswer ?? "";
    if (value !== current) onAnswered(subQuestion.subQuestionId, "", value, true);
  };

  const handleFileSelect = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const total = savedFiles.length + pendingFiles.length + fileList.length;
    if (total > FILE_UPLOAD_LIMIT) {
      setSnack(`Cannot upload more than ${FILE_UPLOAD_LIMIT} files`);
      return;
    }
    for (const file of Array.from(fileList)) {
      try {
        const res = await uploadFile.mutateAsync({ email: applicantEmail, file });
        setPendingFiles((prev) => [...prev, { fileName: res.data.fileName }]);
      } catch (err) {
        setSnack(`Upload failed: ${humanizeHttpError(err)}`);
      }
    }
  };

  const removePendingFile = (fileName: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.fileName !== fileName));
    void deleteFile.mutateAsync({ email: applicantEmail, fileName }).catch(() => undefined);
  };

  const saveNewFiles = () => {
    saveMetadata.mutate(
      {
        email: applicantEmail,
        files: pendingFiles.map((f) => ({
          companyId: Number(companyId),
          questionId: question.questionId,
          subQuestionId: subQuestion.subQuestionId,
          fileName: f.fileName,
          fileType: f.fileName.split(".").pop()?.toLowerCase() ?? "",
        })),
      },
      {
        onSuccess: () => {
          if (pendingFiles.length > 0) onAnswered(subQuestion.subQuestionId, "", "", true);
          setPendingFiles([]);
        },
        onError: (err) => setSnack(`Save failed: ${humanizeHttpError(err)}`),
      },
    );
  };

  const openFile = (fileName: string) => {
    const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
    const path = extension === "pdf" ? "/due-diligence/view-pdf" : ["jpg", "jpeg", "png"].includes(extension) ? "/due-diligence/view-image" : null;
    // `from=finance` opens the viewer as its own tab (window.open, not a
    // client-side navigation) — there is no history entry to attach the
    // usual `state: { fromPerspective }` to, so PerspectiveContext falls
    // back to reading it off the URL instead. Without it the rail in that
    // new tab shows Me, not Finance.
    if (path)
      window.open(
        `${path}?fileName=${encodeURIComponent(fileName)}&extension=${encodeURIComponent(extension)}&from=finance`,
        "_blank",
        "noopener,noreferrer",
      );
  };

  if (question.questionId !== subQuestion.questionId) return null;

  return (
    <Box sx={{ mb: 1.5 }}>
      <Snackbar open={Boolean(snack)} autoHideDuration={4000} onClose={() => setSnack(null)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="warning" onClose={() => setSnack(null)}>
          {snack}
        </Alert>
      </Snackbar>

      {subQuestion.answerType && (
        <>
          <FormControl disabled={fieldDisabled || shouldDisableRadioButtons}>
            <RadioGroup row value={radioValue} onChange={(e) => handleRadioChange(e.target.value)}>
              <FormControlLabel value="yes" control={<Radio size="small" />} label="Approve" />
              <FormControlLabel value="no" control={<Radio size="small" />} label="Reject" />
            </RadioGroup>
          </FormControl>
          {!fieldDisabled && shouldDisableRadioButtons && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: -0.5 }}>
              {totalQ42Q43Comments === 0
                ? "Waiting for a creator or reviewer comment before this can be approved."
                : "Send for approval before this can be approved."}
            </Typography>
          )}
        </>
      )}

      {subQuestion.answerTypeDescription && subQuestion.answerType && radioValue === "yes" && (
        <TextField
          size="small"
          fullWidth
          label={subQuestion.description}
          defaultValue={answer?.descriptionAnswer ?? ""}
          onChange={(e) => handleTextChange(e.target.value)}
          disabled={Boolean(answer?.descriptionAnswer) || fieldDisabled}
          sx={{ mt: 1 }}
        />
      )}

      {subQuestion.answerTypeDescription && !subQuestion.answerType && (
        <TextField
          size="small"
          fullWidth
          multiline
          minRows={3}
          label={subQuestion.description}
          defaultValue={answer?.descriptionAnswer ?? ""}
          onChange={(e) => handleTextChange(e.target.value)}
          disabled={fieldDisabled}
          sx={{ mt: 1 }}
        />
      )}

      {subQuestion.answerTypeFileUpload && (
        <Box sx={{ mt: 1 }}>
          {subQuestion.description && <Typography variant="body2" sx={{ mb: 1 }}>{subQuestion.description}</Typography>}
          <Stack spacing={1}>
            {savedFiles.map((f) => (
              <Stack key={f.fileId} direction="row" spacing={1} sx={{ alignItems: "center", bgcolor: "background.default", border: 1, borderColor: "divider", borderRadius: 1, p: 1, cursor: "pointer" }} onClick={() => openFile(f.fileName)}>
                <FileIcon size={16} />
                <Typography variant="body2">{f.fileName}</Typography>
              </Stack>
            ))}
            {pendingFiles.map((f) => (
              <Stack key={f.fileName} direction="row" spacing={1} sx={{ alignItems: "center", bgcolor: "background.default", border: 1, borderColor: "divider", borderRadius: 1, p: 1 }}>
                <FileIcon size={16} />
                <Typography variant="body2" sx={{ flex: 1, cursor: "pointer" }} onClick={() => openFile(f.fileName)}>
                  {f.fileName}
                </Typography>
                <XIcon size={14} style={{ cursor: "pointer" }} onClick={() => removePendingFile(f.fileName)} />
              </Stack>
            ))}
            {!fieldDisabled && savedFiles.length + pendingFiles.length < FILE_UPLOAD_LIMIT && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<UploadIcon size={15} />}
                onClick={() => inputRef.current?.click()}
                sx={{ alignSelf: "flex-start", textTransform: "none" }}
              >
                Upload file
              </Button>
            )}
            <input ref={inputRef} type="file" multiple hidden onChange={(e) => void handleFileSelect(e.target.files)} />
            {pendingFiles.length > 0 && (
              <Stack direction="row" spacing={1}>
                <Button size="small" variant="contained" onClick={saveNewFiles} disabled={saveMetadata.isPending}>
                  Save
                </Button>
                <Button size="small" variant="outlined" onClick={() => setPendingFiles([])}>
                  Cancel
                </Button>
              </Stack>
            )}
          </Stack>
        </Box>
      )}
    </Box>
  );
}
