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

import { Box, Link, Typography } from "@wso2/oxygen-ui";

const GITHUB_EMAIL_HELP =
  "https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-personal-account-on-github/managing-email-preferences/adding-an-email-address-to-your-github-account";

const stepSx = {
  m: 0,
  pl: 2.5,
  display: "flex",
  flexDirection: "column",
  gap: 0.75,
  color: "text.secondary",
  fontSize: 14,
  lineHeight: 1.6,
} as const;

export default function GitHubConnectionGuide() {
  return (
    <Box sx={{ textAlign: "left", width: "min(100%, 40rem)", mt: 4 }}>
      <Typography component="h2" variant="h6" sx={{ mb: 1.5, fontWeight: 800 }}>
        Connect your GitHub account
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        Connect GitHub succeeds only when the work email you use to sign in to One WSO2 is
        added to that GitHub account and GitHub has marked it verified. It does not have to be the
        primary address.
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25, fontWeight: 700 }}>
        GitHub’s instructions:{" "}
        <Link
          href={GITHUB_EMAIL_HELP}
          target="_blank"
          rel="noopener noreferrer"
          underline="hover"
          sx={{ fontWeight: 700 }}
        >
          Adding an email address to your GitHub account
        </Link>
        .
      </Typography>
      <Box component="ol" sx={stepSx}>
        <li>Sign in to GitHub with the account you will connect.</li>
        <li>
          Open <strong>Settings</strong>, then <strong>Emails</strong>.
        </li>
        <li>Add the same work email you use for One WSO2.</li>
        <li>Open GitHub’s verification mail and confirm the address. The address must show as verified.</li>
        <li>
          Return to One WSO2, choose <strong>Connect with GitHub</strong> and pick that
          account. Leave the tab open until One WSO2 returns.
        </li>
      </Box>
    </Box>
  );
}
