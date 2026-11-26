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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ParCycle } from "../api/types";

let rating: { parLeadStatus: string; parIsLeadershipEmployee: boolean } = {
  parLeadStatus: "PENDING",
  parIsLeadershipEmployee: false,
};
const requestReviewers = { mutate: vi.fn(), isPending: false, error: null };
let ratingFails = false;
const retryRating = vi.fn();
vi.mock("../api/useParData", () => ({
  useParEmployeeInfo: () => ({ data: { leadEmail: "hannah@example.com" } }),
  useParRating: () =>
    ratingFails
      ? { data: undefined, isError: true, error: new Error("Unavailable"), isFetching: false, refetch: retryRating }
      : { data: rating },
}));
type Reviewer = { reviewerEmail: string; reviewerName: string; reviewStatus: string };
let reviewers: Reviewer[] = [];
let leadershipResponses = 0;
let receivedCount: number | undefined;
vi.mock("../api/usePar360", () => ({
  useReviewers: () => ({ data: reviewers, isLoading: false, isError: false }),
  useRequestReviewers: () => requestReviewers,
  useParticipants: () => ({
    data: [
      { workEmail: "alex@example.com", employeeName: "Alex Morgan" },
      { workEmail: "maya@example.com", employeeName: "Maya Fernando" },
    ],
    isLoading: false,
    isError: false,
  }),
}));
let countState: { isLoading?: boolean; isError?: boolean } = {};
const retryCount = vi.fn();
vi.mock("../api/useReview360", () => ({
  useReviewCount: () => ({
    data: receivedCount === undefined || countState.isLoading || countState.isError ? undefined : { received: receivedCount },
    error: countState.isError ? new Error("Unavailable") : null,
    isFetching: false,
    refetch: retryCount,
    ...countState,
  }),
}));
vi.mock("../api/useLeadership360", () => ({
  cycleSurvey: () => ({ surveyId: 9 }),
  useLeadership360Surveys: () => ({ data: [] }),
  useLeadership360Results: () => ({ data: [{ responseCount: leadershipResponses }] }),
}));
vi.mock("../api/useReviewerSuggestions", () => ({
  useReviewerSuggestions: () => ({
    data: { meetingsSince: "2026-08-13", suggestions: [{ workEmail: "maya@example.com", employeeName: "Maya Fernando" }] },
  }),
}));
vi.mock("@features/leave/api/useLeaveData", () => ({
  useLeaveEmployees: () => ({ data: [], isLoading: false, isError: false }),
}));

const { default: Par360AboutMe } = await import("./Par360AboutMe");

const originalConfig = window.config;
const leadership360 = () => {
  window.config = { ...(originalConfig ?? {}), ONE_WSO2_PREVIEW_FEATURES: { leadership360: true } } as Window["config"];
};

const cycle = (deadline: string) => ({ parCycleId: 2, parThreeSixtyRatingDeadline: deadline }) as ParCycle;
const OPEN = "2999-12-31";

const alex: Reviewer = { reviewerEmail: "alex@example.com", reviewerName: "Alex Morgan", reviewStatus: "SHARED" };
const count = () => screen.getByText("Feedback requests").parentElement;

beforeEach(() => {
  rating = { parLeadStatus: "PENDING", parIsLeadershipEmployee: false };
  reviewers = [alex];
  leadershipResponses = 0;
  receivedCount = 1;
  countState = {};
  retryCount.mockReset();
  ratingFails = false;
  retryRating.mockReset();
  window.config = originalConfig;
  requestReviewers.mutate.mockReset();
});

describe("Par360AboutMe", () => {
  it("shows the calendar suggestions and the people search straight away", () => {
    render(<Par360AboutMe cycle={cycle(OPEN)} workEmail="ravi@example.com" />);
    expect(screen.queryByRole("button", { name: "Request feedback" })).not.toBeInTheDocument();
    // How many have come in, against the 3 needed, sits on the title's line.
    expect(count()).toHaveTextContent("Feedback requests1 of 3 feedback responses received");
    expect(screen.getByText(/You are required to receive feedback from at least 3 colleagues/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(screen.getByText("Suggested from your calendar:")).toBeInTheDocument();
    const field = screen.getByRole("combobox");
    expect(field).not.toHaveFocus();
    // The suggestions come before the field, and both before the people already asked.
    const suggestion = screen.getByRole("button", { name: "Add Maya Fernando" });
    const asked = screen.getByText("Alex Morgan");
    expect(suggestion.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(field.compareDocumentPosition(asked) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("starts again empty once a request goes through", () => {
    requestReviewers.mutate.mockImplementation((_vars, { onSuccess }) => onSuccess());
    render(<Par360AboutMe cycle={cycle(OPEN)} workEmail="ravi@example.com" />);
    fireEvent.click(screen.getByRole("button", { name: "Add Maya Fernando" }));
    fireEvent.click(screen.getByRole("button", { name: "Request" }));
    expect(requestReviewers.mutate).toHaveBeenCalledWith({ reviewerEmails: ["maya@example.com"] }, expect.anything());
    expect(screen.queryByText("maya@example.com")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Request" })).toBeDisabled();
  });

  it("keeps what was picked when the request fails", () => {
    render(<Par360AboutMe cycle={cycle(OPEN)} workEmail="ravi@example.com" />);
    fireEvent.click(screen.getByRole("button", { name: "Add Maya Fernando" }));
    fireEvent.click(screen.getByRole("button", { name: "Request" }));
    expect(screen.getByText("maya@example.com")).toBeInTheDocument();
  });

  it("has no picker once the lead has shared the PAR, and no scores for a member", () => {
    rating = { parLeadStatus: "SHARED", parIsLeadershipEmployee: false };
    render(<Par360AboutMe cycle={cycle(OPEN)} workEmail="ravi@example.com" />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByText(/360° results/)).not.toBeInTheDocument();
    expect(screen.queryByText(/360° index/)).not.toBeInTheDocument();
  });

  it("says 0 of 3 until someone is asked, and drops the minimum once 3 have come in", () => {
    reviewers = [];
    receivedCount = 0;
    const { unmount } = render(<Par360AboutMe cycle={cycle(OPEN)} workEmail="ravi@example.com" />);
    expect(count()).toHaveTextContent("0 of 3 feedback responses received");
    unmount();
    reviewers = [0, 1, 2, 3].map((n) => ({ ...alex, reviewerEmail: `r${n}@example.com`, reviewStatus: n < 3 ? "SHARED" : "PENDING" }));
    receivedCount = 3;
    render(<Par360AboutMe cycle={cycle(OPEN)} workEmail="ravi@example.com" />);
    expect(count()).toHaveTextContent(/^Feedback requests3 feedback responses received$/);
  });

  it("counts feedback offered unasked, without listing who gave it", () => {
    receivedCount = 2;
    render(<Par360AboutMe cycle={cycle(OPEN)} workEmail="ravi@example.com" />);
    expect(count()).toHaveTextContent("2 of 3 feedback responses received");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("shows a started draft as Requested: the employee doesn't see drafts", () => {
    reviewers = [{ ...alex, reviewStatus: "DRAFT" }];
    render(<Par360AboutMe cycle={cycle(OPEN)} workEmail="ravi@example.com" />);
    expect(screen.getByText("Requested")).toBeInTheDocument();
    expect(screen.queryByText("Draft")).not.toBeInTheDocument();
  });

  it("shows a leader who answered with their name as Submitted; an anonymous answer leaves Requested", () => {
    rating = { parLeadStatus: "PENDING", parIsLeadershipEmployee: true };
    reviewers = [alex, { ...alex, reviewerEmail: "maya@example.com", reviewerName: "Maya Fernando", reviewStatus: "PENDING" }];
    leadershipResponses = 2;
    render(<Par360AboutMe cycle={cycle(OPEN)} workEmail="ravi@example.com" />);
    expect(screen.getByText("Alex Morgan").closest("li")).toHaveTextContent("Submitted");
    expect(screen.getByText("Maya Fernando").closest("li")).toHaveTextContent("Requested");
  });

  it("counts a leader's Leadership 360° responses, not who submitted", () => {
    leadership360();
    rating = { parLeadStatus: "PENDING", parIsLeadershipEmployee: true };
    reviewers = [{ ...alex, reviewStatus: "PENDING" }];
    leadershipResponses = 2;
    render(<Par360AboutMe cycle={cycle(OPEN)} workEmail="ravi@example.com" />);
    expect(count()).toHaveTextContent("2 of 3 feedback responses received");
  });

  it("has no picker after the 360° deadline", () => {
    render(<Par360AboutMe cycle={cycle("2020-01-01")} workEmail="ravi@example.com" />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByText(/Suggested from/)).not.toBeInTheDocument();
    expect(screen.getByText("Alex Morgan")).toBeInTheDocument();
  });

  it("counts a leader's PAR 360° feedback like anyone's while Leadership 360° is off", () => {
    rating = { parLeadStatus: "PENDING", parIsLeadershipEmployee: true };
    leadershipResponses = 2;
    render(<Par360AboutMe cycle={cycle(OPEN)} workEmail="ravi@example.com" />);
    expect(count()).toHaveTextContent("1 of 3 feedback responses received");
  });

  it("shows no total while the count loads", () => {
    countState = { isLoading: true };
    render(<Par360AboutMe cycle={cycle(OPEN)} workEmail="ravi@example.com" />);
    expect(count()).toHaveTextContent(/^Feedback requests$/);
  });

  it("says when the count couldn't be loaded, with Retry, rather than 0 of 3", () => {
    countState = { isError: true };
    render(<Par360AboutMe cycle={cycle(OPEN)} workEmail="ravi@example.com" />);
    expect(screen.getByText(/Couldn't load how much feedback you've received/)).toBeInTheDocument();
    expect(screen.queryByText(/feedback responses received/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retryCount).toHaveBeenCalled();
  });

  it("says when the PAR record couldn't be loaded, rather than 0 of 3, since no count can be chosen", () => {
    ratingFails = true;
    render(<Par360AboutMe cycle={cycle(OPEN)} workEmail="ravi@example.com" />);
    expect(screen.getByText(/Couldn't load how much feedback you've received/)).toBeInTheDocument();
    expect(screen.queryByText(/feedback responses received/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retryRating).toHaveBeenCalled();
  });
});
