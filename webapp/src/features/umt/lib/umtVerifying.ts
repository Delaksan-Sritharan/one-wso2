// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy at
// http://www.apache.org/licenses/LICENSE-2.0

// Legacy validates each public pull request as any valid URL (yup's .url()),
// not specifically a GitHub PR link like PR Analysis's GITHUB_PR_REGEX, so
// this is a plain URL check, not a reuse of that regex.
export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// Mirrors CompleteUpdateForm.tsx's exact exclusive-or rule: at least one
// non-blank, valid-URL public pull request, or a non-blank reason to skip
// one — never both, and never neither.
export function isCompleteUpdateValid(input: {
  publicPullRequests: string[];
  reason: string;
}): boolean {
  const validPullRequests = input.publicPullRequests.filter(
    (pr) => pr.trim() !== "" && isValidHttpUrl(pr.trim()),
  );
  const hasPullRequest = validPullRequests.length > 0;
  const hasReason = input.reason.trim() !== "";

  return hasPullRequest !== hasReason;
}
