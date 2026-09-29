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

import type { MasterDataTab } from "./masterDataTypes";

/**
 * Every user-facing string the master-data screens say, kept verbatim from
 * the source app so the port reads identically to the thing it replaces.
 *
 * Collected in one file rather than inlined at each call site: the same
 * sentences are said by four tabs, and a snackbar that drifts on one tab and
 * not the others is the kind of difference nobody notices until a support
 * ticket quotes the wrong wording back.
 */
export const MASTER_DATA_SNACK = {
  success: {
    // FormDialog.tsx:118 — the source's own wording, missing "d" and all.
    // Not corrected here: the point of the port is that nothing changes.
    updated: "Data update successfully",
    added: "Data added successfully",
    // DeleteConfirmationDialog.tsx:34
    deleted: "Data deleted successfully",
  },
  error: {
    // FormDialog.tsx:120-122, :127-129
    updating: "Error updating data. Please try again. If the issue persists, contact Internal Apps Team",
    adding: "Error adding data. Please try again. If the issue persists, contact Internal Apps Team",
    // DeleteConfirmationDialog.tsx:44-46
    deleting: "Error deleting data. Please try again. If the issue persists, contact Internal Apps Team",
    // DeleteConfirmationDialog.tsx:38-41 — the 409 the backend returns when
    // the record is still referenced. Distinct from a generic delete failure
    // because it tells the reader what to do about it.
    deleteConflict:
      "Cannot proceed with this operation due to linked data. Delete other active connections to continue",
    // CustomTable.tsx:76-78
    loading: "Error retrieving data. Please try again. If the issue persists, contact Internal Apps Team",
    // CustomTable.tsx:54-59
    autoComplete:
      "Error retrieving auto complete data. Please try again. If the issue persists, contact Internal Apps Team",
    // DepartmentFormContent.tsx:34-39
    glCodes: "Error retrieving Gl Code data. Please try again. If the issue persists, contact Internal Apps Team",
    // CreditCardFormContent.tsx:34-39
    employeeEmails:
      "Error retrieving employee emails. Please try again. If the issue persists, contact Internal Apps Team",
  },
} as const;

/**
 * The "Add New X" button on each page, and the dialog titles.
 *
 * The source's `isEditForm` prop is inverted — `FormDialog.tsx:36` sets it to
 * `!initialData`, so it is true when ADDING. Its form contents then read
 * `isEditForm ? "Add New …" : "Update Existing …"`, which lands on the right
 * words through two wrongs. Ported as `isCreate`, which is what it has always
 * meant, so the next reader does not have to re-derive that.
 */
export const MASTER_DATA_FORM_COPY: Record<
  MasterDataTab,
  { addButton: string; addTitle: string; editTitle: string }
> = {
  subsidiaries: {
    addButton: "Add New Subsidiary",
    addTitle: "Add New Subsidiary",
    editTitle: "Update Existing Subsidiary",
  },
  departments: {
    addButton: "Add New Department",
    addTitle: "Add New Department",
    editTitle: "Update Existing Department",
  },
  expenseTypes: {
    addButton: "Add New Expense Type",
    addTitle: "Add New Expense Type",
    editTitle: "Update Existing Expense Type",
  },
  creditCards: {
    addButton: "Add New Credit Card",
    addTitle: "Add New Credit Card",
    editTitle: "Update Existing Credit Card",
  },
};

/** DeleteConfirmationDialog.tsx:70-76 — title, body, and the two buttons. */
export const MASTER_DATA_DELETE_COPY = {
  title: "Delete Confirmation",
  text: "Are you sure you want to delete this record?",
  confirm: "Yes",
  cancel: "No",
} as const;

/**
 * Subtitles for the page frame.
 *
 * New writing — the source app has no subtitle, because each tab is a panel
 * inside one app whose name is in the title bar. Here each tab is a route of
 * its own inside a portal of ~20 apps, so a line saying what the table is for
 * is worth more than the fidelity of leaving it out.
 */
export const MASTER_DATA_SUBTITLES: Record<MasterDataTab, string> = {
  subsidiaries: "WSO2 legal entities and the tax codes claims are booked against.",
  departments: "Employee departments, their engagement codes and the GL code each maps to.",
  expenseTypes: "The expense catalogue — category, GL code, and the engagements each type is valid for.",
  creditCards: "The corporate card register: which card belongs to whom, and who approves its spend.",
};
