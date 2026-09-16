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

import { Alert, AlertTitle, Box, Card, Skeleton, Stack, Typography } from "@wso2/oxygen-ui";
import { ArrowRightIcon, LockIcon } from "@wso2/oxygen-ui-icons-react";
import { NavLink } from "react-router";
import type { JSX } from "react";
import PerspectiveHeader from "@components/perspective-header/PerspectiveHeader";
import { isSecurityBackendConfigured } from "@config/apiConfig";
import { SECURITY_APPS } from "@constants/securityApps";
import { useSecurityGate } from "@features/security/api/useSecurityGate";

// The Security overview — the landing for /security.
//
// Tiles are derived from the registry, with zero per-item literals, so adding a
// screen cannot produce an ungated tile. (This app's FinancePage and LegalPage
// hand-build theirs, and that shape once shipped one.)
//
// It also exists to answer "why is nothing here", which is the first question
// this perspective will raise — the backend needs changes of its own before any
// lifted screen can load. Both dead-end states say so in the reader's terms and
// name a person to ask. Neither names a config key, a repo path or a file to
// edit: everyone who opens the perspective sees these, not only whoever deploys
// it, and an instruction they cannot act on reads as a broken page.
export default function SecurityPage(): JSX.Element {
  const configured = isSecurityBackendConfigured();
  const gate = useSecurityGate(configured);

  const header = (
    <PerspectiveHeader
      title="Security and Compliance"
      subtitle="The risk register and its approval workflow, compliance audits and the evidence collected against them, and the roles and reference data both are built from."
    />
  );

  if (!configured) {
    return (
      <Box>
        {header}
        {/* Shown to whoever opens the perspective, not only to whoever deploys
            it, so it says what is true rather than what to go and edit. Repo
            paths and config-file names belong in the docs, not on screen. */}
        <Alert severity="info" sx={{ mt: 1.5, maxWidth: 720 }}>
          <AlertTitle>Not available yet</AlertTitle>
          Security and Compliance isn't connected in this environment. Ask your One WSO2 administrator
          when it will be switched on.
        </Alert>
      </Box>
    );
  }

  if (gate.isResolving) {
    return (
      <Box>
        {header}
        <Stack spacing={1.5} sx={{ maxWidth: 520 }}>
          <Skeleton variant="rectangular" height={112} sx={{ borderRadius: 1.5 }} />
          <Skeleton variant="rectangular" height={112} sx={{ borderRadius: 1.5 }} />
        </Stack>
      </Box>
    );
  }

  const apps = SECURITY_APPS.map((app) => ({
    app,
    items: app.items.filter((it) => gate.canSee(it.id)),
  })).filter((a) => a.items.length > 0);

  if (apps.length === 0) {
    return (
      <Box>
        {header}
        <Card variant="outlined" sx={{ mt: 1.5, p: 3, maxWidth: 620 }}>
          <Stack direction="row" spacing={1.75} sx={{ alignItems: "flex-start" }}>
            <LockIcon size={19} />
            <Box>
              <Typography sx={{ fontSize: 17, fontWeight: 600, mb: 0.6 }}>
                You don't have access yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: "52ch" }}>
                Access here comes from a role granted in Admin Console, not from your Asgardeo
                groups — so being in the right team does not grant it on its own. Ask someone who
                can reach Security and Compliance → Admin Console → Users to grant you the role that
                covers your work.
              </Typography>
            </Box>
          </Stack>
        </Card>
      </Box>
    );
  }

  return (
    <Box>
      {header}
      <Stack spacing={3.5}>
        {apps.map(({ app, items }) => (
          <Box key={app.key}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
              <app.icon size={17} />
              <Typography component="h2" sx={{ fontSize: 16, fontWeight: 700 }}>
                {app.name}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, maxWidth: "68ch" }}>
              {app.purpose}
            </Typography>
            <Box
              sx={{
                display: "grid",
                gap: 1.5,
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              }}
            >
              {items.map((item) => (
                <Card
                  key={item.id}
                  variant="outlined"
                  component={NavLink}
                  to={item.path!}
                  sx={{
                    p: 2.25,
                    display: "block",
                    textDecoration: "none",
                    color: "inherit",
                    transition: "border-color .12s, background-color .12s",
                    "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
                  }}
                >
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.75 }}>
                    <Typography sx={{ fontSize: 15, fontWeight: 700, flex: 1 }}>
                      {item.label}
                    </Typography>
                    <ArrowRightIcon size={15} />
                  </Stack>
                  <Typography sx={{ fontSize: 13, color: "text.secondary" }}>{item.desc}</Typography>
                </Card>
              ))}
            </Box>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
