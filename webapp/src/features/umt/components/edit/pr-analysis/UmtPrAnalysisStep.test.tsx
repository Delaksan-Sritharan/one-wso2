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

// The PR analysis is editable in both states of the Files Analysis step.
// Analyze demotes a PRAnalyzed update first, uploads the pending manual files,
// then submits; the backend moves the update to PRAnalyzed once the analysis
// and its product analysis have run.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { HttpError } from "@api/http";
import type { UmtFileOperation, UmtUpdateSummary } from "../../../api/umtUpdates";
import type { UmtPendingManualUpload } from "../../../lib/umtPrAnalysis";

const state = vi.hoisted(() => ({
  calls: [] as string[],
  transition: vi.fn(),
  upload: vi.fn(),
  start: vi.fn(),
  // The operation of the one file a previous analysis left on the update.
  analyzedFileOperation: "Added",
  analysisFetching: false,
  analysisLoaded: true,
  analysisFailed: false,
  analysisError: null as unknown,
  analysisRefetch: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

vi.mock("../../../api/useUmtUpdateViewData", () => ({
  useUmtPullRequestAnalysis: () => ({
    isFetching: state.analysisFetching,
    isError: state.analysisFailed,
    error: state.analysisError,
    refetch: state.analysisRefetch,
    data: !state.analysisLoaded ? undefined : {
      pullRequests: [{ pr: "https://github.com/wso2/carbon/pull/1", preferredVersion: "4.9.0" }],
      additionalFileOperations: [
        {
          file: "repository/components/dropins/a.jar",
          operation: state.analyzedFileOperation,
          downloadURL: "https://blob.example.com/a.jar?sig=secret",
        },
      ],
      bundlesInfoChanges: [
        {
          bundlesInfoPath: "repository/components/default/bundles.info",
          contentChange: "a,1.0.0,../plugins/a.jar",
          jarName: "a",
          jarVersion: "1.0.0",
          relativeJarPath: "../plugins/a.jar",
          changeType: "add",
        },
      ],
    },
  }),
}));

vi.mock("../../../api/useUmtLifecycleTransition", () => ({
  useUmtLifecycleTransition: () => ({ isPending: false, mutateAsync: state.transition }),
}));

vi.mock("../../../api/useUmtPrAnalysis", () => ({
  useUmtStartPullRequestAnalysis: () => ({ isPending: false, mutateAsync: state.start }),
  useUmtUploadPullRequestAnalysisFile: () => ({ isPending: false, mutateAsync: state.upload }),
}));

vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: state.showSuccess, showError: state.showError, showWarning: vi.fn() }),
}));

vi.mock("./UmtPrAnalysisResults", () => ({
  default: () => <div>PR analysis results</div>,
}));

// Lists the files it's given, and adds one pending file the way the real
// section reports a new upload.
vi.mock("./UmtAddManualFilesSection", () => ({
  default: ({
    files,
    onFilesChange,
    onDirty,
  }: {
    files: UmtFileOperation[];
    onFilesChange: (files: UmtFileOperation[], uploads?: UmtPendingManualUpload[]) => void;
    onDirty: () => void;
  }) => (
    <div>
      {files.map((row) => (
        <div key={row.file}>{row.file}</div>
      ))}
      <button
        onClick={() => {
          const row = { file: `repository/conf/new-${files.length}.xml`, operation: "Removed" };
          onFilesChange([...files, row], [{ row, relativePath: "repository/conf", sourceFilePath: "", file: new Blob() }]);
          onDirty();
        }}
      >
        Add stub file
      </button>
      <button
        onClick={() => {
          const row = { file: "repository/components/lib/andes-4.0.0.jar", operation: "Added" };
          const file = new File(["contents"], "andes-4.0.0.jar");
          onFilesChange([...files, row], [{ row, relativePath: row.file, sourceFilePath: "", file }]);
          onDirty();
        }}
      >
        Add stub uploaded file
      </button>
      <button
        onClick={() => {
          onFilesChange([...files, { file: `repository/conf/changed-${files.length}.xml`, operation: "Modified" }]);
          onDirty();
        }}
      >
        Add stub modified file
      </button>
    </div>
  ),
}));

const { default: UmtPrAnalysisStep } = await import("./UmtPrAnalysisStep");

function summary(lifecycleState: string, extra: Partial<UmtUpdateSummary> = {}) {
  return { id: 42, lifecycleState, praStatus: "NONE", ...extra } as UmtUpdateSummary;
}

function renderStep(update: UmtUpdateSummary) {
  return render(<UmtPrAnalysisStep id="42" update={update} />);
}

describe("UmtPrAnalysisStep", () => {
  beforeEach(() => {
    localStorage.clear();
    state.calls = [];
    state.transition.mockReset().mockImplementation(async (next: string) => {
      state.calls.push(`transition:${next}`);
    });
    state.upload.mockReset().mockImplementation(async () => {
      state.calls.push("upload");
    });
    state.start.mockReset().mockImplementation(async () => {
      state.calls.push("start");
    });
    state.analyzedFileOperation = "Added";
    state.analysisFetching = false;
    state.analysisLoaded = true;
    state.analysisFailed = false;
    state.analysisError = null;
    state.analysisRefetch.mockReset();
    state.showSuccess.mockClear();
    state.showError.mockClear();
  });

  it("shows the inputs in Development, with no Proceed button and nothing running", () => {
    renderStep(summary("Development"));

    expect(screen.getByText("Update Type")).toBeInTheDocument();
    expect(screen.getByText("Pull Requests")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Proceed" })).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it.each(["QUEUED", "PROCESSING"])("says the PR analysis is running while it is %s", (praStatus) => {
    renderStep(summary("Development", { praStatus, praPromotionPending: true }));

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByText("Running PR analysis…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyze" })).toBeDisabled();
  });

  it("keeps running after the PR analysis completes, until the promotion is no longer pending", () => {
    renderStep(summary("Development", { praStatus: "COMPLETED", praPromotionPending: true }));

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByText("PR analysis completed. Running product analysis…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyze" })).toBeDisabled();
  });

  it("disables Analyze in PRAnalyzed while the promotion is pending, says why, and holds the results back", () => {
    renderStep(summary("PRAnalyzed", { praStatus: "COMPLETED", praPromotionPending: true }));

    expect(screen.getByRole("button", { name: "Analyze" })).toBeDisabled();
    expect(screen.getByText("PR analysis completed. Running product analysis…")).toBeInTheDocument();
    expect(screen.queryByText("PR analysis results")).not.toBeInTheDocument();
    // The cached analysis may be from before this run, so the inputs wait for it to end.
    expect(screen.getByRole("status", { name: "Loading pull request analysis" })).toBeInTheDocument();
  });

  it("enables Analyze in PRAnalyzed once no promotion is pending", () => {
    renderStep(summary("PRAnalyzed", { praStatus: "COMPLETED", praPromotionPending: false }));
    fireEvent.click(screen.getByRole("button", { name: "Add stub file" }));

    expect(screen.queryByText("PR analysis completed. Running product analysis…")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyze" })).toBeEnabled();
  });

  it("shows the results and announces the promotion once it ends in PRAnalyzed", () => {
    const { rerender } = renderStep(summary("Development", { praStatus: "COMPLETED", praPromotionPending: true }));
    expect(state.showSuccess).not.toHaveBeenCalled();

    rerender(
      <UmtPrAnalysisStep id="42" update={summary("PRAnalyzed", { praStatus: "COMPLETED", praPromotionPending: false })} />,
    );

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByText("PR analysis results")).toBeInTheDocument();
    expect(state.showSuccess).toHaveBeenCalledTimes(1);
    expect(state.showSuccess).toHaveBeenCalledWith("Update 42 advanced to PRAnalyzed.");
    expect(state.transition).not.toHaveBeenCalled();
  });

  it("shows paError once the product analysis fails, and lets Analyze be run again without editing an input", async () => {
    localStorage.setItem(
      "one-wso2.umt-pr-analysis-prs.v1.42",
      JSON.stringify([{ pr: "https://github.com/wso2/carbon/pull/999", preferredVersion: "" }]),
    );
    const { rerender } = renderStep(summary("Development", { praStatus: "COMPLETED", praPromotionPending: true }));

    const failed = summary("Development", {
      praStatus: "NONE",
      praPromotionPending: false,
      paError: "No applicable products were found",
    });
    rerender(<UmtPrAnalysisStep id="42" update={failed} />);

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByText("No applicable products were found")).toBeInTheDocument();
    expect(state.showError).toHaveBeenCalledWith("No applicable products were found");
    expect(state.showSuccess).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Analyze" })).toBeEnabled());
  });

  it("still shows paError after a reload", () => {
    localStorage.setItem(
      "one-wso2.umt-pr-analysis-prs.v1.42",
      JSON.stringify([{ pr: "https://github.com/wso2/carbon/pull/999", preferredVersion: "" }]),
    );
    renderStep(
      summary("Development", {
        praStatus: "COMPLETED",
        praPromotionPending: false,
        paError: "Promotion to PRAnalyzed failed: lifecycle refused",
      }),
    );

    expect(screen.getByText("Promotion to PRAnalyzed failed: lifecycle refused")).toBeInTheDocument();
    expect(state.showError).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Analyze" })).toBeEnabled();
  });

  it("announces paError, not PRAnalyzed, when the demote after a failed product analysis fails too", () => {
    const paError =
      "Product analysis failed: Files API unavailable. Demotion to Development also failed, so the update is still in PRAnalyzed.";
    const { rerender } = renderStep(summary("Development", { praStatus: "COMPLETED", praPromotionPending: true }));

    rerender(
      <UmtPrAnalysisStep
        id="42"
        update={summary("PRAnalyzed", { praStatus: "COMPLETED", praPromotionPending: false, paError })}
      />,
    );

    expect(screen.getByText(paError)).toBeInTheDocument();
    expect(state.showError).toHaveBeenCalledWith(paError);
    expect(state.showSuccess).not.toHaveBeenCalled();
  });

  it("shows praError when the PR analysis fails", () => {
    const { rerender } = renderStep(summary("Development", { praStatus: "PROCESSING", praPromotionPending: true }));

    rerender(
      <UmtPrAnalysisStep
        id="42"
        update={summary("Development", { praStatus: "FAILED", praError: "PR_MERGE_CONFLICT", praPromotionPending: false })}
      />,
    );

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByText("PR Analysis task was failed.")).toBeInTheDocument();
    expect(screen.getByText("PR_MERGE_CONFLICT")).toBeInTheDocument();
    expect(state.showSuccess).not.toHaveBeenCalled();
  });

  it("shows the results in PRAnalyzed once the product analysis has finished", () => {
    renderStep(summary("PRAnalyzed", { praStatus: "COMPLETED" }));

    expect(screen.getByText("PR analysis results")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("shows the results as completed in PRAnalyzed even when praStatus isn't COMPLETED", () => {
    renderStep(summary("PRAnalyzed", { praStatus: "NONE" }));

    expect(screen.getByText("PR analysis results")).toBeInTheDocument();
    expect(screen.getByText("PR Analysis was successfully completed.")).toBeInTheDocument();
  });

  it("holds the placeholder, not stale drafts, until a refetch of the analysis lands", () => {
    localStorage.setItem(
      "one-wso2.umt-pr-analysis-prs.v1.42",
      JSON.stringify([{ pr: "https://github.com/wso2/carbon/pull/999", preferredVersion: "" }]),
    );
    state.analysisFetching = true;
    const update = summary("PRAnalyzed", { praStatus: "COMPLETED" });
    const { rerender } = renderStep(update);

    expect(screen.getByRole("status", { name: "Loading pull request analysis" })).toBeInTheDocument();
    expect(screen.queryByText("https://github.com/wso2/carbon/pull/999")).not.toBeInTheDocument();
    expect(screen.queryByText("https://github.com/wso2/carbon/pull/1")).not.toBeInTheDocument();

    state.analysisFetching = false;
    rerender(<UmtPrAnalysisStep id="42" update={update} />);

    expect(screen.queryByRole("status", { name: "Loading pull request analysis" })).not.toBeInTheDocument();
    expect(screen.getByText("https://github.com/wso2/carbon/pull/1")).toBeInTheDocument();
    expect(screen.queryByText("https://github.com/wso2/carbon/pull/999")).not.toBeInTheDocument();
  });

  it("shows a placeholder shaped like the section while the analysis loads, with Analyze disabled", () => {
    state.analysisLoaded = false;
    renderStep(summary("PRAnalyzed", { praStatus: "COMPLETED" }));

    expect(screen.getByRole("status", { name: "Loading pull request analysis" })).toBeInTheDocument();
    expect(screen.queryByText("Update Type")).not.toBeInTheDocument();
    expect(screen.queryByText("Couldn't load this section.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyze" })).toBeDisabled();
  });

  it("shows an error with a retry when the analysis can't be loaded, and keeps Analyze disabled", () => {
    state.analysisLoaded = false;
    state.analysisFailed = true;
    renderStep(summary("PRAnalyzed", { praStatus: "COMPLETED" }));

    expect(screen.getByText("Couldn't load this section.")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Loading pull request analysis" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyze" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(state.analysisRefetch).toHaveBeenCalledTimes(1);
  });

  // A 404 is an analysis that was never stored, which no retry can load. The
  // drafts are all there is, so the inputs open on them and Analyze runs.
  it("says the analysis hasn't been performed when it 404s in PRAnalyzed, and lets Analyze run from the drafts", async () => {
    localStorage.setItem(
      "one-wso2.umt-pr-analysis-prs.v1.42",
      JSON.stringify([{ pr: "https://github.com/wso2/carbon/pull/999", preferredVersion: "" }]),
    );
    state.analysisLoaded = false;
    state.analysisFailed = true;
    state.analysisError = new HttpError("https://umt.example.com/update/42/pullRequestAnalysis", 404, "");
    renderStep(summary("PRAnalyzed", { praStatus: "COMPLETED" }));

    expect(screen.getByText("Pull Request Analysis has not been performed for this update yet.")).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load this section.")).not.toBeInTheDocument();
    expect(screen.getByText("https://github.com/wso2/carbon/pull/999")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

    await vi.waitFor(() => expect(state.calls).toEqual(["transition:Development", "start"]));
    expect(state.start).toHaveBeenCalledWith(
      expect.objectContaining({ pullRequests: [{ pr: "https://github.com/wso2/carbon/pull/999", preferredVersion: "" }] }),
    );
  });

  it("waits out a refetch before treating a 404 as an analysis that was never performed", () => {
    state.analysisLoaded = false;
    state.analysisFailed = true;
    state.analysisFetching = true;
    state.analysisError = new HttpError("https://umt.example.com/update/42/pullRequestAnalysis", 404, "");
    renderStep(summary("PRAnalyzed", { praStatus: "COMPLETED" }));

    expect(screen.queryByText("Pull Request Analysis has not been performed for this update yet.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyze" })).toBeDisabled();
  });

  it("doesn't hold up the inputs in Development while the analysis is missing", () => {
    state.analysisLoaded = false;
    renderStep(summary("Development"));

    expect(screen.queryByRole("status", { name: "Loading pull request analysis" })).not.toBeInTheDocument();
    expect(screen.getByText("Update Type")).toBeInTheDocument();
  });

  it("keeps the inputs editable in PRAnalyzed, filled from the backend's analysis", () => {
    localStorage.setItem(
      "one-wso2.umt-pr-analysis-prs.v1.42",
      JSON.stringify([{ pr: "https://github.com/wso2/carbon/pull/999", preferredVersion: "" }]),
    );
    renderStep(summary("PRAnalyzed", { praStatus: "COMPLETED" }));

    expect(screen.getByText("Update Type").closest("[inert]")).toBeNull();
    expect(screen.getByText("https://github.com/wso2/carbon/pull/1")).toBeInTheDocument();
    expect(screen.queryByText("https://github.com/wso2/carbon/pull/999")).not.toBeInTheDocument();
    expect(screen.getByText("repository/components/dropins/a.jar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyze" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Proceed" })).not.toBeInTheDocument();
  });

  it("keeps only the file path and operation of the analyzed manual files in the drafts", () => {
    renderStep(summary("PRAnalyzed", { praStatus: "COMPLETED" }));

    expect(JSON.parse(localStorage.getItem("one-wso2.umt-pr-analysis-files.v1.42") ?? "null")).toEqual([
      { file: "repository/components/dropins/a.jar", operation: "Added" },
    ]);
  });

  it.each([
    [{}, "General Update"],
    [{ isInstructionsOnly: true }, "Instructions Only Update"],
    [{ isContainerizedUpdate: true }, "Containerized Product Update"],
  ])("selects the analyzed update type in PRAnalyzed (%o)", (flags, label) => {
    renderStep(summary("PRAnalyzed", { praStatus: "COMPLETED", ...flags }));

    expect(screen.getByRole("radio", { name: label })).toBeChecked();
  });

  it("lets Analyze be run after a demote to Development, without editing an input", async () => {
    const { rerender } = renderStep(summary("PRAnalyzed", { praStatus: "COMPLETED" }));
    expect(screen.getByRole("button", { name: "Analyze" })).toBeDisabled();

    rerender(<UmtPrAnalysisStep id="42" update={summary("Development", { praStatus: "NONE" })} />);

    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Analyze" })).toBeEnabled());
  });

  it("lets Analyze be run again after a failed analysis, without editing an input", async () => {
    const { rerender } = renderStep(summary("Development", { praStatus: "NONE" }));
    fireEvent.click(screen.getByRole("button", { name: "Add stub file" }));
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    await vi.waitFor(() => expect(state.start).toHaveBeenCalledTimes(1));

    rerender(
      <UmtPrAnalysisStep id="42" update={summary("Development", { praStatus: "FAILED", praError: "PR_MERGE_CONFLICT" })} />,
    );

    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Analyze" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    await vi.waitFor(() => expect(state.start).toHaveBeenCalledTimes(2));
  });

  it("keeps Analyze off after a completed analysis until an input changes", async () => {
    const { rerender } = renderStep(summary("Development", { praStatus: "NONE" }));
    fireEvent.click(screen.getByRole("button", { name: "Add stub file" }));
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    await vi.waitFor(() => expect(state.start).toHaveBeenCalledTimes(1));

    rerender(<UmtPrAnalysisStep id="42" update={summary("PRAnalyzed", { praStatus: "COMPLETED" })} />);
    await screen.findByText("repository/components/dropins/a.jar");

    expect(screen.getByRole("button", { name: "Analyze" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Add stub file" }));

    expect(screen.getByRole("button", { name: "Analyze" })).toBeEnabled();
  });

  describe("Analyze on an Instructions Only update", () => {
    const analyzeButton = () => screen.queryByRole("button", { name: "Analyze" });

    it("is gone once the analysis is completed, since there is nothing left to analyze", () => {
      renderStep(summary("PRAnalyzed", { praStatus: "COMPLETED", isInstructionsOnly: true }));

      expect(screen.getByRole("radio", { name: "Instructions Only Update" })).toBeChecked();
      expect(analyzeButton()).not.toBeInTheDocument();
    });

    it("stays in PRAnalyzed with paError, so the failed product analysis can be run again", () => {
      renderStep(
        summary("PRAnalyzed", {
          praStatus: "COMPLETED",
          isInstructionsOnly: true,
          paError: "Product analysis failed: Files API unavailable",
        }),
      );

      expect(screen.getByText("Product analysis failed: Files API unavailable")).toBeInTheDocument();
      expect(analyzeButton()).toBeEnabled();
    });

    it("is not shown while the completed analysis is still loading", () => {
      state.analysisLoaded = false;
      renderStep(summary("PRAnalyzed", { praStatus: "COMPLETED", isInstructionsOnly: true }));

      expect(analyzeButton()).not.toBeInTheDocument();
    });

    it("is there before the analysis has run", () => {
      renderStep(summary("Development", { praStatus: "NONE", isInstructionsOnly: true }));

      expect(analyzeButton()).toBeEnabled();
    });

    it("comes back when the update type is changed, so the update can be analyzed as the other type", () => {
      renderStep(summary("PRAnalyzed", { praStatus: "COMPLETED", isInstructionsOnly: true }));

      fireEvent.click(screen.getByRole("radio", { name: "General Update" }));

      expect(analyzeButton()).toBeInTheDocument();
    });

    it("is offered when a completed update of another type is switched to Instructions Only", () => {
      renderStep(summary("PRAnalyzed", { praStatus: "COMPLETED" }));

      fireEvent.click(screen.getByRole("radio", { name: "Instructions Only Update" }));

      expect(analyzeButton()).toBeEnabled();
    });

    it("stays for a completed update of another type", () => {
      renderStep(summary("PRAnalyzed", { praStatus: "COMPLETED" }));

      expect(analyzeButton()).toBeInTheDocument();
    });
  });

  it("follows the recorded update type when it changes while the step stays mounted", () => {
    const { rerender } = renderStep(summary("Development"));
    expect(screen.getByRole("radio", { name: "General Update" })).toBeChecked();

    rerender(<UmtPrAnalysisStep id="42" update={summary("Development", { isInstructionsOnly: true })} />);

    expect(screen.getByRole("radio", { name: "Instructions Only Update" })).toBeChecked();
  });

  it("warns when the update has both added and modified files, then demotes, uploads and submits, in that order", async () => {
    renderStep(summary("PRAnalyzed", { praStatus: "COMPLETED" }));

    fireEvent.click(screen.getByRole("button", { name: "Add stub file" }));
    fireEvent.click(screen.getByRole("button", { name: "Add stub modified file" }));
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    expect(screen.getByText("Added and Modified Files")).toBeInTheDocument();
    expect(state.calls).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: "Yes Proceed" }));

    await vi.waitFor(() => expect(state.calls).toEqual(["transition:Development", "upload", "start"]));
  });

  it("analyzes without the warning when the update has only added files", async () => {
    renderStep(summary("PRAnalyzed", { praStatus: "COMPLETED" }));

    fireEvent.click(screen.getByRole("button", { name: "Add stub file" }));
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

    expect(screen.queryByText("Added and Modified Files")).not.toBeInTheDocument();
    await vi.waitFor(() => expect(state.calls).toEqual(["transition:Development", "upload", "start"]));
  });

  it("analyzes without the warning when the update has only modified files", async () => {
    state.analyzedFileOperation = "Modified";
    renderStep(summary("PRAnalyzed", { praStatus: "COMPLETED" }));

    fireEvent.click(screen.getByRole("button", { name: "Add stub modified file" }));
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

    expect(screen.queryByText("Added and Modified Files")).not.toBeInTheDocument();
    await vi.waitFor(() => expect(state.calls).toEqual(["transition:Development", "start"]));
  });

  it("analyzes without the warning when no file was added or modified", async () => {
    state.analyzedFileOperation = "Removed";
    renderStep(summary("PRAnalyzed", { praStatus: "COMPLETED" }));

    fireEvent.click(screen.getByRole("button", { name: "Add stub file" }));
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

    expect(screen.queryByText("Added and Modified Files")).not.toBeInTheDocument();
    await vi.waitFor(() => expect(state.calls).toEqual(["transition:Development", "upload", "start"]));
  });

  it("uploads a picked file under the path it is analyzed with, and a placeholder under none", async () => {
    renderStep(summary("PRAnalyzed", { praStatus: "COMPLETED" }));

    fireEvent.click(screen.getByRole("button", { name: "Add stub uploaded file" }));
    fireEvent.click(screen.getByRole("button", { name: "Add stub file" }));
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

    await vi.waitFor(() => expect(state.upload).toHaveBeenCalledTimes(2));
    expect(state.upload.mock.calls[0][0]).toEqual(
      expect.objectContaining({ filePath: "repository/components/lib/andes-4.0.0.jar" }),
    );
    expect(state.upload.mock.calls[1][0].filePath).toBeUndefined();
  });

  it("names the file an upload failed on, and sends only the remaining ones on the next Analyze", async () => {
    state.upload
      .mockImplementationOnce(async () => {
        state.calls.push("upload");
      })
      .mockRejectedValueOnce(new Error("upload refused"));
    renderStep(summary("PRAnalyzed", { praStatus: "COMPLETED" }));

    fireEvent.click(screen.getByRole("button", { name: "Add stub file" }));
    fireEvent.click(screen.getByRole("button", { name: "Add stub file" }));
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

    await vi.waitFor(() =>
      expect(state.showError).toHaveBeenCalledWith(
        expect.stringContaining('Uploaded 1 of 2 files before "repository/conf/new-2.xml" failed.'),
      ),
    );
    expect(state.start).not.toHaveBeenCalled();

    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Analyze" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

    await vi.waitFor(() => expect(state.start).toHaveBeenCalledTimes(1));
    expect(state.upload).toHaveBeenCalledTimes(3);
  });

  it("shows only the Development notice for a state past PRAnalyzed", () => {
    renderStep(summary("ProductAnalyzed"));

    expect(screen.getByText("PR Analysis can only be done in Development.")).toBeInTheDocument();
    expect(screen.queryByText("Update Type")).not.toBeInTheDocument();
  });
});
