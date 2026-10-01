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
import { useState } from "react";
import { Alert, Box, Button, Skeleton, Stack, Typography } from "@wso2/oxygen-ui";
import { PlusIcon } from "@wso2/oxygen-ui-icons-react";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { isTilBackendConfigured, useTilSubmissions, useTilUserInfo } from "../api/useTilData";
import { useDeleteTilSubmission } from "../api/useTilMutations";
import { describeError } from "../util/tilError";
import SubmissionCard from "../components/SubmissionCard";
import SubmitEntryDialog from "../components/SubmitEntryDialog";
import TilShell from "../components/TilShell";

// Today I Learned: a company-wide feed of learnings from customers, partners,
// and internal sources, plus the form to add one. The second, parallel entry
// point (the Chat App's "+" Dialog) posts to the same til-backend endpoint
// this page's "New entry" button does — see til-backend/README.md.
export default function TilHomePage() {
  const configured = isTilBackendConfigured();
  const userInfo = useTilUserInfo();
  const submissions = useTilSubmissions();
  const deleteSubmission = useDeleteTilSubmission();
  const { showError, showSuccess } = useNotifications();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const canModerate = userInfo.data?.canModerate ?? false;

  const handleDelete = (id: string) => {
    setDeletingId(id);
    deleteSubmission.mutate(id, {
      onSuccess: () => showSuccess("Entry deleted"),
      onError: (err) => showError(describeError(err)),
      onSettled: () => setDeletingId(null),
    });
  };

  return (
    <TilShell
      title="Today I Learned"
      subtitle="A shared feed of what we're learning from customers, partners, and each other."
      configured={configured}
      configKey="ONE_WSO2_TIL_BACKEND_URL"
      action={
        <Button variant="contained" startIcon={<PlusIcon size={16} />} onClick={() => setDialogOpen(true)}>
          New entry
        </Button>
      }
    >
      {submissions.isLoading ? (
        <Stack spacing={1.5}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rectangular" height={96} sx={{ borderRadius: 1.5 }} />
          ))}
        </Stack>
      ) : submissions.isError ? (
        <Alert severity="error">Couldn&apos;t load entries. {describeError(submissions.error)}</Alert>
      ) : submissions.data && submissions.data.items.length > 0 ? (
        <Stack spacing={1.5}>
          {submissions.data.items.map((s) => (
            <SubmissionCard
              key={s.id}
              submission={s}
              canDelete={canModerate}
              deleting={deletingId === s.id}
              onDelete={() => handleDelete(s.id)}
            />
          ))}
        </Stack>
      ) : (
        <Box sx={{ py: 4, textAlign: "center" }}>
          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
            No entries yet. Be the first to share something you learned.
          </Typography>
        </Box>
      )}

      <SubmitEntryDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </TilShell>
  );
}
