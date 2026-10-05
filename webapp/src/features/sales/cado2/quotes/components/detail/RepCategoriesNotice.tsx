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

import type { JSX } from "react";
import { Alert, AlertTitle, Box } from "@wso2/oxygen-ui";
import type { SheetLine } from "@features/sales/cado2/quotes/sheet/sheetModel";

const LABEL = { SUBSCRIPTION: "Subscription", SUPPORT: "Support", PROFESSIONAL_SERVICE: "Professional Service" } as const;

interface RepCategoriesNoticeProps {
  readonly lines: readonly SheetLine[];
  /** On Deal Desk's approval: approving confirms them. */
  readonly approving?: boolean;
}

/**
 * The lines whose category the rep chose, because their product has no
 * mapping, listed for Deal Desk to verify. Nothing when there are none.
 */
export default function RepCategoriesNotice({ lines, approving = false }: RepCategoriesNoticeProps): JSX.Element | null {
  const byRep = lines.filter((l) => l.categoryByRep);
  if (byRep.length === 0) return null;
  const count = byRep.length === 1 ? "1 line uses a category" : `${byRep.length} lines use categories`;
  return (
    <Alert severity="warning" role="region" aria-label="Categories chosen by the rep">
      <AlertTitle>{count} chosen by the rep</AlertTitle>
      {approving
        ? "These products have no category set up by an Admin. By approving, you confirm these categories are right; if not, request changes."
        : "These products have no category set up by an Admin, so the rep chose it. Deal Desk: please check them."}
      <Box component="ul" sx={{ m: 0, mt: 1, pl: 2.5 }}>
        {byRep.map((l) => (
          <li key={l.number}>
            {l.productName}: <strong>{LABEL[l.category]}</strong>
          </li>
        ))}
      </Box>
    </Alert>
  );
}
