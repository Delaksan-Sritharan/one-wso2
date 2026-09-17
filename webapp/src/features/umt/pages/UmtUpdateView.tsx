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
import { useParams } from "react-router";
import { Alert, Box, Button, Chip, Divider, Skeleton, Stack, Tab, Tabs } from "@wso2/oxygen-ui";
import { Bell, BellOff } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import type { UmtUpdateFieldChange } from "../api/useUmtUpdateFieldMutation";
import { useUmtUpdateFieldMutation } from "../api/useUmtUpdateFieldMutation";
import { useUmtMeta } from "../api/useUmtMeta";
import { useUmtUpdate } from "../api/useUmtUpdate";
import { useUmtUpdateSubscription } from "../api/useUmtUpdateSubscription";
import { useUmtUserInfo } from "../api/useUmtUserInfo";
import { UMT_ROLE_ID } from "../api/umtTypes";
import { useNotifications } from "@context/notifications/NotificationsContext";
import UmtShell from "../components/UmtShell";
import UmtUpdateDetailsGrid from "../components/UmtUpdateDetailsGrid";
import UmtUpdateEditTab from "../components/edit/UmtUpdateEditTab";
import UmtLifecycleHistory from "../components/UmtLifecycleHistory";
import UmtUpdateBranchTab from "../components/UmtUpdateBranchTab";
import UmtUpdateViewSections from "../components/UmtUpdateViewSections";
import { DashboardWidgetHolder } from "../components/UmtWidgets";

const UPDATE_VIEW_CHIP_SX = {
  borderColor: "currentColor",
  color: "info.main",
  fontSize: 13,
} as const;

const UMT_EDIT_ROLE_IDS = new Set<number>(Object.values(UMT_ROLE_ID));

export default function UmtUpdateView() {
  const { id } = useParams<{ id: string }>();

  return (
    <UmtShell title="Update Information" backTo="/umt/updates">
      <UmtUpdateBody id={id} />
    </UmtShell>
  );
}

function UmtUpdateBody({ id }: { id: string | undefined }) {
  const [selectedTab, setSelectedTab] = useState("view");
  const update = useUmtUpdate(id);
  const userInfo = useUmtUserInfo();
  const meta = useUmtMeta();
  const subscription = useUmtUpdateSubscription(id ?? "");
  const fieldMutation = useUmtUpdateFieldMutation(id ?? "");
  const { showSuccess, showError } = useNotifications();

  if (!id || !/^\d+$/.test(id)) {
    return <Alert severity="error">The update id is invalid.</Alert>;
  }

  if (update.isError) {
    return (
      <ErrorNotice
        error={update.error}
        onRetry={() => void update.refetch()}
        retrying={update.isFetching}
      >
        Couldn&apos;t load update #{id}.
      </ErrorNotice>
    );
  }

  const headerValues = [
    { key: "issue-type", value: update.data?.issueType },
    { key: "lifecycle", value: update.data?.lifecycle },
    { key: "lifecycle-state", value: update.data?.lifecycleState },
  ];
  const workEmail = userInfo.data?.workEmail;
  const isSubscribed = Boolean(
    workEmail && update.data?.watcherList?.includes(workEmail),
  );
  const subscriptionAction = isSubscribed ? "unsubscribe" : "subscribe";
  const hasEditRole = Boolean(
    userInfo.data?.roles.some((role) => UMT_EDIT_ROLE_IDS.has(role)),
  );
  const canEditDevelopmentFields =
    hasEditRole && update.data?.lifecycleState === "Development";

  const handleSubscription = () => {
    subscription.mutate(subscriptionAction, {
      onSuccess: () => {
        showSuccess(isSubscribed ? `Unsubscribed from update ${id}` : `Subscribed to update ${id}`);
      },
      onError: (error) => {
        showError(
          `${isSubscribed ? "Unsubscribe" : "Subscribe"} failed. ${describeError(error)}`,
        );
      },
    });
  };

  const handleFieldSave = async (change: UmtUpdateFieldChange) => {
    try {
      await fieldMutation.mutateAsync(change);
      showSuccess(`${fieldLabel(change.field)} updated for update ${id}`);
    } catch (error) {
      showError(`${fieldLabel(change.field)} update failed. ${describeError(error)}`);
      throw error;
    }
  };

  return (
    <Stack spacing={3} sx={{ maxWidth: "100%", pb: 4, width: "100%" }}>
      <DashboardWidgetHolder
        title={
          <Stack component="span" direction="row" spacing={2} sx={{ alignItems: "center" }}>
            <Box component="span">Update #{id}</Box>
            <Button
              variant={isSubscribed ? "outlined" : "contained"}
              size="small"
              disabled={update.isPending || userInfo.isPending || !workEmail}
              loading={subscription.isPending}
              startIcon={isSubscribed ? <BellOff size={17} /> : <Bell size={17} />}
              onClick={handleSubscription}
            >
              {isSubscribed ? "Unsubscribe" : "Subscribe"}
            </Button>
          </Stack>
        }
        backgroundColor="background.paper"
        actions={
          <Stack direction="row" spacing={1}>
            {headerValues.map(({ key, value }) =>
              update.isPending ? (
                <Skeleton key={key} variant="rounded" width={80} height={24} />
              ) : (
                <Chip
                  key={key}
                  label={displayValue(value)}
                  size="small"
                  variant="outlined"
                  sx={UPDATE_VIEW_CHIP_SX}
                />
              ),
            )}
          </Stack>
        }
      >
        <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Tabs
            value={selectedTab}
            onChange={(_event, value: string) => setSelectedTab(value)}
            aria-label="Update sections"
          >
            <Tab label="View" value="view" />
            <Tab label="Branch" value="branch" />
            <Tab label="Edit" value="edit" />
            <Tab label="LifeCycle History" value="lifecycle-history" />
          </Tabs>
        </Box>
        {selectedTab === "view" && (
          <Box role="tabpanel" aria-label="View" sx={{ pt: 3 }}>
            <UmtUpdateDetailsGrid
              id={id}
              update={update.data}
              loading={update.isPending}
              canEdit={canEditDevelopmentFields}
              userEmails={meta.data?.userEmails ?? []}
              userEmailsLoading={meta.isPending}
              savingField={fieldMutation.isPending ? fieldMutation.variables?.field : undefined}
              onSave={handleFieldSave}
            />
            {update.data && (
              <>
                <Divider sx={{ mt: 3 }} />
                <UmtUpdateViewSections id={id} update={update.data} />
              </>
            )}
          </Box>
        )}
        {selectedTab === "branch" && update.data && (
          <Box role="tabpanel" aria-label="Branch" sx={{ pt: 3 }}>
            <UmtUpdateBranchTab
              id={id}
              products={meta.data?.products ?? {}}
              update={update.data}
            />
          </Box>
        )}
        {selectedTab === "edit" && update.data && (
          <Box role="tabpanel" aria-label="Edit" sx={{ pt: 3 }}>
            <UmtUpdateEditTab key={id} id={id} update={update.data} />
          </Box>
        )}
        {selectedTab === "lifecycle-history" && (
          <Box role="tabpanel" aria-label="LifeCycle History" sx={{ pt: 3 }}>
            <UmtLifecycleHistory id={id} />
          </Box>
        )}
      </DashboardWidgetHolder>
    </Stack>
  );
}

function fieldLabel(field: UmtUpdateFieldChange["field"]): string {
  switch (field) {
    case "assignedTo":
      return "Assigned To";
    case "developedBy":
      return "Developed By";
    case "worstCaseEstimate":
      return "Worst Case Date";
  }
}

function displayValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "N/A";
  const normalizedValue = String(value).trim();
  return normalizedValue || "N/A";
}
