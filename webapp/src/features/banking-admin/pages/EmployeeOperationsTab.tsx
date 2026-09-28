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
import { Autocomplete, Box, Button, Divider, Menu, MenuItem, Stack, TextField, Tooltip, Typography } from "@wso2/oxygen-ui";
import ConfirmationDialog, { type ConfirmationContent } from "@components/confirmation-dialog/ConfirmationDialog";
import { useSingleFlight } from "@components/confirmation-dialog/useSingleFlight";
import { useBankAccounts } from "@features/my/api/useBankAccounts";
import { useBankingConfig } from "@features/my/api/useBankingConfig";
import { useBankingEmployees } from "@features/my/api/useBankingEmployees";
import { useDeactivateAccount } from "@features/my/api/useDeactivateAccount";
import { isReimbursementEligible } from "@features/my/api/bankingRules";
import type { AccountType, BankAccount, BankingEmployee } from "@features/my/api/types";
import BankAccountRequestDialog from "@features/my/banking/components/BankAccountRequestDialog";
import BankAccountsTable, { AccountStatusChip } from "../components/BankAccountsTable";
import {
  ACCOUNT_ID_COLUMN,
  ACCOUNT_NAME_COLUMN,
  ACCOUNT_NUMBER_COLUMN,
  ACCOUNT_TYPE_COLUMN,
  BANK_CODE_COLUMN,
  EFFECTIVE_MONTH_COLUMN,
  EMPLOYEE_EMAIL_COLUMN,
  type BankAccountsTableColumn,
} from "../bankAccountsColumns";

// The Employee Operations tab — search any employee, act on their behalf.
// Ported from digiops-hr's own employeeDetails.tsx: employee search, account
// history, Deactivate, Resign, and Add Bank Account on-behalf-of, all
// against the SAME banking-backend resources the employee-facing port
// already uses (useBankAccounts, BankAccountRequestDialog) — just pointed at
// the selected employee instead of the caller.
export default function EmployeeOperationsTab() {
  const employeesQuery = useBankingEmployees();
  const configQuery = useBankingConfig();
  const [selectedEmployee, setSelectedEmployee] = useState<BankingEmployee | null>(null);
  const accountsQuery = useBankAccounts(selectedEmployee?.workEmail);
  const deactivateAccount = useDeactivateAccount();

  // Shared by Deactivate and Resign: only one ConfirmationDialog is ever
  // open at a time, and it closes synchronously on click without awaiting
  // anything.
  const run = useSingleFlight();

  const [confirmation, setConfirmation] = useState<ConfirmationContent | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [addAccountType, setAddAccountType] = useState<AccountType | null>(null);

  const employees = employeesQuery.data ?? [];
  const accounts = accountsQuery.data?.bankAccounts ?? [];
  const config = configQuery.data;

  function requestDeactivate(account: BankAccount) {
    setConfirmation({
      title: "Confirm Deactivation",
      text: "Are you sure you want to deactivate these account?",
      confirmAction: () =>
        run(async () => {
          if (!selectedEmployee) return;
          await deactivateAccount.mutateAsync({
            accountId: account.accountId,
            employeeEmail: selectedEmployee.workEmail,
          });
        }),
    });
  }

  function requestResign() {
    setConfirmation({
      title: "Confirm Resignation",
      text: "Are you sure you want to resign this employee? This will deactivate employee's all active bank accounts !",
      confirmAction: () =>
        run(async () => {
          if (!selectedEmployee) return;
          // Matches the source app's own Resign action: no dedicated resign
          // endpoint, just every currently-Active account deactivated in
          // turn, behind this one confirmation. Each account is its own
          // try/catch, same as the source's own loop — one account's
          // deactivate failing (the backend can 500 on a CONSULTANCY account
          // with no NetSuite internal id on file, for instance) must not
          // stop the remaining active accounts from being attempted too.
          for (const account of accounts) {
            if (account.accountStatus === "ACTIVE") {
              try {
                await deactivateAccount.mutateAsync({
                  accountId: account.accountId,
                  employeeEmail: selectedEmployee.workEmail,
                });
              } catch (error) {
                console.error(`Failed to deactivate account ${account.accountId}:`, error);
              }
            }
          }
        }),
    });
  }

  const columns: BankAccountsTableColumn[] = [
    ACCOUNT_ID_COLUMN,
    EMPLOYEE_EMAIL_COLUMN,
    ACCOUNT_NAME_COLUMN,
    ACCOUNT_NUMBER_COLUMN,
    BANK_CODE_COLUMN,
    EFFECTIVE_MONTH_COLUMN,
    { label: "Account Status", render: (a) => <AccountStatusChip status={a.accountStatus} /> },
    ACCOUNT_TYPE_COLUMN,
    {
      label: "Actions",
      render: (a) => (
        <Tooltip title={a.accountStatus === "INACTIVE" ? "Account already deactivated" : "Deactivate Account"}>
          <span>
            <Button
              size="small"
              color="error"
              disabled={a.accountStatus === "INACTIVE"}
              onClick={() => requestDeactivate(a)}
            >
              Deactivate
            </Button>
          </span>
        </Tooltip>
      ),
    },
  ];

  return (
    <Box>
      <Autocomplete
        options={employees}
        getOptionLabel={(e) => `${e.firstName} ${e.lastName} (${e.workEmail})`}
        filterOptions={(options, { inputValue }) => {
          const term = inputValue.toLowerCase();
          return options
            .filter(
              (e) =>
                `${e.firstName} ${e.lastName}`.toLowerCase().includes(term) ||
                e.workEmail.toLowerCase().includes(term),
            )
            .slice(0, 10);
        }}
        value={selectedEmployee}
        onChange={(_, next) => setSelectedEmployee(next)}
        loading={employeesQuery.isLoading}
        size="small"
        sx={{ width: "50%", mx: "auto", mb: 3, display: "block" }}
        renderInput={(params) => <TextField {...params} label="Search Employee by Name or Email" />}
      />

      {!selectedEmployee ? (
        <Typography color="text.secondary" sx={{ textAlign: "center" }}>
          Please select an employee!
        </Typography>
      ) : (
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>
              Employee Details
            </Typography>
            <Button variant="contained" color="error" onClick={requestResign}>
              Resign Employee
            </Button>
          </Stack>
          <Divider sx={{ mb: 2 }} />
          <Stack direction="row" spacing={4} sx={{ mb: 3, flexWrap: "wrap" }}>
            <Field label="Employee ID" value={selectedEmployee.employeeId ?? "-"} />
            <Field label="Full Name" value={`${selectedEmployee.firstName} ${selectedEmployee.lastName}`} />
            <Field label="Work Email" value={selectedEmployee.workEmail} />
            <Field label="Team" value={selectedEmployee.department ?? "-"} />
            <Field label="Unit" value={selectedEmployee.team ?? "-"} />
          </Stack>

          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>
              Employee Bank Accounts
            </Typography>
            <Button size="small" onClick={(e) => setMenuAnchor(e.currentTarget)}>
              Add Bank Account
            </Button>
            <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
              <MenuItem
                onClick={() => {
                  setAddAccountType("SALARY");
                  setMenuAnchor(null);
                }}
              >
                Salary
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setAddAccountType("CONSULTANCY");
                  setMenuAnchor(null);
                }}
              >
                Consultancy
              </MenuItem>
              <MenuItem
                disabled={!isReimbursementEligible(selectedEmployee.location, config?.reimbursementsAllowedCountries ?? [])}
                onClick={() => {
                  setAddAccountType("REIMBURSEMENT");
                  setMenuAnchor(null);
                }}
              >
                Reimbursement
              </MenuItem>
            </Menu>
          </Stack>

          {accountsQuery.isLoading ? (
            <Typography color="text.secondary">Loading accounts…</Typography>
          ) : (
            <BankAccountsTable
              accounts={accounts}
              columns={columns}
              emptyMessage="No bank accounts found for this employee."
            />
          )}
        </Box>
      )}

      <ConfirmationDialog content={confirmation} onClose={() => setConfirmation(null)} />

      {addAccountType && selectedEmployee && (
        <BankAccountRequestDialog
          accountType={addAccountType}
          employeeEmail={selectedEmployee.workEmail}
          allCountries={config?.allCountries ?? []}
          employeeWorkLocation={selectedEmployee.location}
          customLocationMap={config?.customLocationMap ?? []}
          onClose={() => setAddAccountType(null)}
          onSuccess={() => {
            setAddAccountType(null);
            void accountsQuery.refetch();
          }}
        />
      )}
    </Box>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {value}
      </Typography>
    </Box>
  );
}
