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
import { act, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import type { ParCycle, ParParticipant, Par360ReviewRequest } from "../api/types";
import type {
  Leadership360CurrentSurvey,
  Leadership360Leader,
  Leadership360MyFeedback,
  Leadership360Survey,
} from "../api/leadership360Types";

const query = <T,>(data: T) => ({
  data,
  isLoading: false,
  isError: false,
  isFetching: false,
  error: null,
  refetch: vi.fn(),
});
const mutation = () => ({ mutate: vi.fn(), reset: vi.fn(), isPending: false, isError: false, error: null });
let leaders: {
  data?: Leadership360Leader[];
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => void;
};

const cycle = {
  parCycleId: 7,
  parCycleName: "2026 H2",
  parCycleStartDate: "2026-10-29",
  parCycleEndDate: "2026-12-15",
  parThreeSixtyRatingDeadline: "2999-01-01",
} as ParCycle;

const survey: Leadership360CurrentSurvey = {
  survey: {
    surveyId: 3,
    surveyName: "Leadership 360 · 2026 H2",
    formTemplateId: 1,
    status: "OPEN",
  },
  template: {
    formTemplateId: 1,
    formKind: "LEADERSHIP_360",
    formVersion: 1,
    definition: {
      kind: "LEADERSHIP_360",
      version: 1,
      title: "Leadership 360°",
      scales: {},
      sections: [
        {
          id: "vision",
          title: "Vision",
          questions: [
            { id: "q1", type: "RATING", text: "Sets direction" },
            { id: "q2", type: "RATING", text: "Explains why" },
          ],
        },
      ],
    },
  },
};

const leader = (workEmail: string, employeeName: string): Leadership360Leader => ({
  workEmail,
  employeeName,
  jobRole: "Director",
  employeeThumbnail: null,
});
const elena = leader("elena@example.com", "Elena");
const alexAsked: Par360ReviewRequest = {
  employeeEmail: "alex@example.com",
  reviewStatus: "PENDING",
  isRequested: true,
};
const hannah = leader("hannah@example.com", "Hannah");

let parts: { cycle?: ParCycle; feedbackCycle?: ParCycle; held?: boolean; hasLead: boolean; leadership: boolean };
let currentSurvey: Leadership360CurrentSurvey | null;
// Every survey, as the survey list has them.
let surveys: Leadership360Survey[];
let mine: Leadership360MyFeedback;
let requests: Par360ReviewRequest[];
let participants: ParParticipant[];
let participantsError: Error | null = null;
const offerMutate = vi.fn();
let offerPending = false;
const declineMutate = vi.fn();

vi.mock("@features/my/api/useMeProfile", () => ({
  useMeProfile: () => ({
    data: {
      userInfo: { workEmail: "me@example.com" },
      employee: { managerEmail: "hannah@example.com", additionalManagerEmails: null },
    },
    isLoading: false,
  }),
}));

vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}));

vi.mock("../api/useParFeedbackParts", () => ({
  useParFeedbackParts: () => ({
    ...parts,
    feedbackCycle: parts.feedbackCycle ?? parts.cycle,
    held: parts.held ?? false,
    isLoading: false,
  }),
}));

vi.mock("../api/usePar360", () => ({
  useReviewRequests: () => query(requests),
  useReviewers: () => query([]),
  useSubmitReview: () => ({ ...mutation(), mutate: declineMutate }),
  useParticipants: () =>
    participantsError ? { ...query(undefined), isError: true, error: participantsError } : query(participants),
  useOfferToReview: () => ({ ...mutation(), mutate: offerMutate, isPending: offerPending }),
}));

vi.mock("../api/useParData", () => ({
  useParEmployeeInfo: () => query({ leadEmail: "hannah@example.com" }),
}));

const discardMutate = vi.fn();
vi.mock("../api/useReview360", () => ({
  useDiscardReviewForm: () => ({ ...mutation(), mutate: discardMutate }),
}));

let ownReports = new Set<string>();
let ownReportsLoading = false;
vi.mock("../api/useLeadTeams", () => ({
  useOwnReports: () => ({ emails: ownReports, isLoading: ownReportsLoading }),
}));

const discardLeadershipMutate = vi.fn();
vi.mock("../api/useLeadership360", () => ({
  useDiscardLeadership360Draft: () => ({ ...mutation(), mutate: discardLeadershipMutate }),
  useCurrentLeadership360Survey: () => query(currentSurvey),
  useLeadership360Surveys: () => query(surveys),
  useMyLeadership360Feedback: () => query(mine),
  useLeadership360Leaders: () => leaders,
}));

vi.mock("../components/Par360FeedbackDialog", () => ({
  default: ({ employeeName }: { employeeName: string }) => <div>PAR form for {employeeName}</div>,
}));
vi.mock("../components/Leadership360FeedbackDialog", () => ({
  default: ({
    leader: l,
    anonymousGiven,
    submitted,
  }: {
    leader: Leadership360Leader;
    anonymousGiven: boolean;
    submitted?: { answers: object; on: string };
  }) => (
    <div>
      Leadership form for {l.employeeName}
      {anonymousGiven ? " (named only)" : ""}
      {submitted ? ` (viewing ${JSON.stringify(submitted.answers)} from ${submitted.on})` : ""}
    </div>
  ),
}));

const { default: ParGiveFeedbackTab } = await import("./ParGiveFeedbackTab");

const tab = (search = "") => (
  <MemoryRouter initialEntries={[`/me/performance/give-feedback${search}`]}>
    <ParGiveFeedbackTab />
  </MemoryRouter>
);

/** The tab, on Requested unless `search` picks another filter. */
function show(search = "") {
  return render(tab(search));
}

const noFeedback = (): Leadership360MyFeedback => ({ drafts: [], named: [], anonymous: [] });

/** A person from the search on the tab. */
async function pick(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.type(screen.getByRole("combobox", { name: "Search people" }), name);
  await user.click(screen.getByRole("option", { name: new RegExp(name) }));
}

const rowNames = () =>
  ["Alex", "Sam", "Hannah", "Elena"]
    .map((name) => ({ name, at: document.body.textContent!.indexOf(name) }))
    .filter((r) => r.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((r) => r.name);

beforeEach(() => {
  leaders = query([elena, hannah]);
  parts = { cycle, hasLead: true, leadership: true };
  ownReports = new Set();
  ownReportsLoading = false;
  participantsError = null;
  participants = [
    { workEmail: "elena@example.com", employeeName: "Elena" },
    { workEmail: "alex@example.com", employeeName: "Alex" },
  ];
  currentSurvey = survey;
  surveys = [{ ...survey.survey, surveyId: 2, status: "CLOSED" }, survey.survey];
  mine = noFeedback();
  window.localStorage.clear();
  requests = [];
  offerMutate.mockReset();
  offerPending = false;
  discardMutate.mockReset();
  declineMutate.mockReset();
  discardLeadershipMutate.mockReset();
});

describe("ParGiveFeedbackTab", () => {
  it("lists requests, drafts and what you've given in one list, waiting ones first", () => {
    requests = [
      { ...alexAsked, employeeEmail: "sam@example.com", employeeName: "Sam", reviewStatus: "SHARED" },
      { ...alexAsked, employeeName: "Alex" },
    ];
    mine = { ...noFeedback(), drafts: [{ leaderEmail: "hannah@example.com", answers: {}, anonymous: false }] };
    window.localStorage.setItem("par-l360-anonymous-draft:me@example.com:3:elena@example.com", "{}");
    show("?show=all");
    expect(screen.queryByRole("button", { name: /Requests to me/ })).not.toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Anonymous draft")).toBeInTheDocument();
    expect(screen.getByText("Submitted")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View" })).toBeInTheDocument();
    expect(rowNames().at(-1)).toBe("Sam");
  });

  it("removes anonymous drafts kept in this browser for a survey that has closed, whoever wrote them", () => {
    const open = "par-l360-anonymous-draft:me@example.com:3:elena@example.com";
    const closed = [
      "par-l360-anonymous-draft:me@example.com:2:elena@example.com",
      "par-l360-anonymous-draft:someone@example.com:2:hannah@example.com",
    ];
    [open, ...closed].forEach((key) => window.localStorage.setItem(key, "{}"));
    show();
    expect(window.localStorage.getItem(open)).toBe("{}");
    closed.forEach((key) => expect(window.localStorage.getItem(key)).toBeNull());
  });

  it("keeps a draft for a survey not known to have closed, such as one opened since the lists were read", () => {
    currentSurvey = null;
    surveys = [{ ...survey.survey, surveyId: 2, status: "CLOSED" }];
    window.localStorage.setItem("par-l360-anonymous-draft:me@example.com:3:elena@example.com", "{}");
    show();
    expect(window.localStorage.getItem("par-l360-anonymous-draft:me@example.com:3:elena@example.com")).toBe("{}");
  });

  it("shows Leadership 360° feedback you gave as submitted, and opens only the named one again", async () => {
    const user = userEvent.setup();
    mine = {
      ...noFeedback(),
      named: [{ leaderEmail: "hannah@example.com", submittedOn: "2026-11-02", answers: { q1: 4 } }],
      anonymous: [{ leaderEmail: "elena@example.com" }],
    };
    show("?show=voluntary");
    expect(screen.getByText("Submitted · 2 Nov '26")).toBeInTheDocument();
    expect(screen.getByText("Submitted anonymously")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "View" })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "View" }));
    expect(screen.getByText('Leadership form for Hannah (viewing {"q1":4} from 2026-11-02)')).toBeInTheDocument();
  });

  it("lets you discard a Leadership 360° draft, named or anonymous", async () => {
    const user = userEvent.setup();
    mine = { ...noFeedback(), drafts: [{ leaderEmail: "hannah@example.com", answers: {}, anonymous: false }] };
    window.localStorage.setItem("par-l360-anonymous-draft:me@example.com:3:elena@example.com", "{}");
    show("?show=voluntary");
    expect(screen.getAllByRole("button", { name: "Discard" })).toHaveLength(2);
    await user.click(screen.getAllByRole("button", { name: "Discard" })[0]);
    const dialog = screen.getByRole("dialog");
    const leader = /Discard your draft on (Hannah|Elena)\?/.exec(dialog.textContent ?? "")?.[1];
    expect(leader).toBeDefined();
    expect(within(dialog).getByText("You can give feedback any time.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Discard" }));
    expect(discardLeadershipMutate).toHaveBeenCalledWith(`${leader!.toLowerCase()}@example.com`, expect.anything());
    expect(discardMutate).not.toHaveBeenCalled();
  });

  it("keeps a leader's request when you discard your draft on them, and has nothing to discard without one", async () => {
    const user = userEvent.setup();
    requests = [
      { ...alexAsked, employeeEmail: "elena@example.com", employeeName: "Elena" },
      { ...alexAsked, employeeEmail: "hannah@example.com", employeeName: "Hannah" },
    ];
    mine = { ...noFeedback(), drafts: [{ leaderEmail: "elena@example.com", answers: {}, anonymous: false }] };
    show();
    expect(screen.getAllByRole("button", { name: "Decline" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Discard" })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(
      within(screen.getByRole("dialog")).getByText("Their request stays in your list. You can give feedback any time."),
    ).toBeInTheDocument();
  });

  it("declining a leader's request also removes your anonymous Leadership 360° draft on them from this browser", async () => {
    const user = userEvent.setup();
    declineMutate.mockImplementation((_vars: unknown, options: { onSuccess: () => void }) => options.onSuccess());
    const elenaDraft = "par-l360-anonymous-draft:me@example.com:3:elena@example.com";
    window.localStorage.setItem(elenaDraft, "{}");
    window.localStorage.setItem("par-l360-anonymous-draft:me@example.com:3:hannah@example.com", "{}");
    requests = [{ ...alexAsked, employeeEmail: "elena@example.com", employeeName: "Elena" }];
    show();
    await user.click(screen.getByRole("button", { name: "Decline" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Decline" }));
    expect(declineMutate).toHaveBeenCalledWith(
      { employeeWorkEmail: "elena@example.com", payload: { par360ReviewStatus: "REJECTED" } },
      expect.anything(),
    );
    expect(window.localStorage.getItem(elenaDraft)).toBeNull();
    expect(window.localStorage.getItem("par-l360-anonymous-draft:me@example.com:3:hannah@example.com")).toBe("{}");
  });

  it("shows a leader whose request you declined as declined, with nothing to do", () => {
    requests = [{ ...alexAsked, employeeEmail: "elena@example.com", employeeName: "Elena", reviewStatus: "REJECTED" }];
    mine = { ...noFeedback(), drafts: [{ leaderEmail: "elena@example.com", answers: {}, anonymous: false }] };
    show();
    expect(screen.getByText("Declined")).toBeInTheDocument();
    for (const name of ["Continue", "Respond", "Decline", "Discard"]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });

  it("lists each piece of feedback you gave a leader as its own row", () => {
    requests = [{ ...alexAsked, employeeEmail: "elena@example.com", employeeName: "Elena" }];
    mine = {
      ...noFeedback(),
      named: [
        { leaderEmail: "elena@example.com", submittedOn: "2026-11-12", answers: {} },
        { leaderEmail: "elena@example.com", submittedOn: "2026-11-05", answers: {} },
      ],
      anonymous: [{ leaderEmail: "elena@example.com" }],
    };
    show();
    expect(screen.getAllByText("Elena")).toHaveLength(3);
    expect(screen.getByText("Submitted · 12 Nov '26")).toBeInTheDocument();
    expect(screen.getByText("Submitted · 5 Nov '26")).toBeInTheDocument();
    expect(screen.getByText("Submitted anonymously")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Decline" })).not.toBeInTheDocument();
  });

  it("puts a draft on a leader you already gave feedback above those rows, with nothing to decline", () => {
    requests = [{ ...alexAsked, employeeEmail: "elena@example.com", employeeName: "Elena" }];
    mine = {
      ...noFeedback(),
      anonymous: [{ leaderEmail: "elena@example.com" }],
      drafts: [{ leaderEmail: "elena@example.com", answers: {}, anonymous: false }],
    };
    show();
    expect(screen.getByText("Submitted anonymously")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Discard" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Decline" })).not.toBeInTheDocument();
    expect(screen.queryByText(/decline instead/)).not.toBeInTheDocument();
  });

  it("answers a leader's request with the Leadership 360° form", async () => {
    const user = userEvent.setup();
    requests = [{ ...alexAsked, employeeEmail: "elena@example.com", employeeName: "Elena" }];
    show();
    expect(screen.getByText("Leadership 360°")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Respond" }));
    expect(screen.getByText("Leadership form for Elena")).toBeInTheDocument();
  });

  it("counts a leader's request as answered once you gave anonymous feedback", () => {
    requests = [{ ...alexAsked, employeeEmail: "elena@example.com", employeeName: "Elena" }];
    mine = { ...noFeedback(), anonymous: [{ leaderEmail: "elena@example.com" }] };
    show();
    expect(screen.getByText("Submitted anonymously")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Respond" })).not.toBeInTheDocument();
  });

  it("filters to feedback you were asked for, or gave without being asked", async () => {
    const user = userEvent.setup();
    requests = [
      { ...alexAsked, employeeName: "Alex" },
      { ...alexAsked, employeeEmail: "sam@example.com", employeeName: "Sam", isRequested: false },
    ];
    show();
    expect(screen.getByRole("button", { name: "Requested" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.queryByText("Sam")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Voluntary" }));
    expect(screen.getByText("Sam")).toBeInTheDocument();
    expect(screen.queryByText("Alex")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "All" }));
    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.getByText("Sam")).toBeInTheDocument();
  });

  it("describes the tab, and under the filter what Requested or Voluntary holds", async () => {
    const user = userEvent.setup();
    requests = [{ ...alexAsked, employeeName: "Alex" }];
    show();
    const tabDescription = /help your colleagues recognise their strengths/;
    const requestedDescription = /Here you'll find feedback requests from colleagues.*Please ensure your comments are/;
    const voluntaryDescription = /Share feedback proactively with anyone you have worked with.*Please ensure your comments/;
    expect(screen.getByText(tabDescription)).toBeInTheDocument();
    expect(screen.getByText(requestedDescription)).toBeInTheDocument();
    expect(screen.queryByText(voluntaryDescription)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Voluntary" }));
    expect(screen.getByText(tabDescription)).toBeInTheDocument();
    expect(screen.getByText(voluntaryDescription)).toBeInTheDocument();
    expect(screen.queryByText(requestedDescription)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "All" }));
    expect(screen.queryByText(requestedDescription)).not.toBeInTheDocument();
    expect(screen.queryByText(voluntaryDescription)).not.toBeInTheDocument();
    expect(screen.queryByText(/decline instead/)).not.toBeInTheDocument();
    expect(screen.queryByText(/five minutes/)).not.toBeInTheDocument();
    expect(screen.getByText(/^Due /)).toBeInTheDocument();
  });

  it("says nobody asked when there's nothing, with no banner for the open survey", () => {
    show();
    expect(screen.getByText("No one has asked for your feedback yet")).toBeInTheDocument();
    expect(screen.queryByText("Leadership 360 · 2026 H2")).not.toBeInTheDocument();
  });

  it("outside a cycle's 360° window, lists what you gave with no filter and no due date", () => {
    parts = {
      cycle: undefined,
      feedbackCycle: { ...cycle, parCycleId: 0, parThreeSixtyRatingDeadline: "9999-12-31" },
      held: true,
      hasLead: true,
      leadership: true,
    };
    requests = [{ ...alexAsked, employeeName: "Alex", reviewStatus: "DRAFT", isRequested: false }];
    // Even from a link to Requested, such as the request email's.
    show("?show=requested");
    // The forms say it counts toward their next PAR cycle; the list doesn't repeat it.
    expect(screen.queryByText(/No PAR cycle is taking feedback/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Due /)).not.toBeInTheDocument();
    // Nobody can ask between cycles: all of it is voluntary, so there's nothing to filter.
    expect(screen.queryByRole("group", { name: "Show" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Voluntary" })).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Share feedback proactively with anyone you have worked with, without needing a request. Please ensure your comments are professional, constructive, and detailed to add meaningful insights.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Alex")).toBeInTheDocument();
  });
});

describe("Provide Feedback", () => {
  it("has the person search on the tab, no button for it; a request is answered with Respond", async () => {
    const user = userEvent.setup();
    requests = [{ ...alexAsked, employeeName: "Alex" }];
    show();
    expect(screen.getByRole("combobox", { name: "Search people" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Provide Feedback" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Respond" }));
    expect(screen.getByText("PAR form for Alex")).toBeInTheDocument();
  });

  it("asks for the person first, from everyone, and a leader gets the Leadership 360° form", async () => {
    const user = userEvent.setup();
    show();
    expect(screen.queryByRole("button", { name: /For a PAR/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "Search people" }));
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toHaveLength(3);
    expect(options[0]).toContain("Hannah");
    expect(screen.getByText("People you work with")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Elena/ })).toHaveTextContent("Leadership 360°");
    await user.click(screen.getByRole("option", { name: /Elena/ }));
    expect(screen.getByText("Leadership form for Elena")).toBeInTheDocument();
  });

  it("leaves out a lead's own reports, though a leader among them stays for Leadership 360°", async () => {
    const user = userEvent.setup();
    ownReports = new Set(["alex@example.com", "elena@example.com"]);
    show();
    await user.click(screen.getByRole("combobox", { name: "Search people" }));
    expect(screen.queryByRole("option", { name: /Alex/ })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Elena/ })).toHaveTextContent("Leadership 360°");
  });

  it("keeps the leadership team in the search when the cycle's people can't be loaded", async () => {
    const user = userEvent.setup();
    participantsError = new Error("HTTP 500");
    show();
    expect(screen.getByText(/Couldn't load people to choose from/)).toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "Search people" }));
    expect(screen.getByRole("option", { name: /Elena/ })).toHaveTextContent("Leadership 360°");
    expect(screen.queryByRole("option", { name: /Alex/ })).not.toBeInTheDocument();
  });

  it("waits for a lead's own reports before the search can be used", () => {
    ownReportsLoading = true;
    show();
    expect(screen.getByRole("combobox", { name: "Search people" })).toBeDisabled();
  });

  it("leaves out people already in your list: you respond or continue there", async () => {
    const user = userEvent.setup();
    requests = [{ ...alexAsked, employeeName: "Alex" }];
    show();
    await user.click(screen.getByRole("combobox", { name: "Search people" }));
    expect(screen.queryByRole("option", { name: /Alex/ })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Elena/ })).toBeInTheDocument();
  });

  it("shows an offer you opened but didn't answer as your draft, with nothing to decline", () => {
    requests = [{ ...alexAsked, employeeName: "Alex", isRequested: false }];
    show("?show=voluntary");
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Decline" })).not.toBeInTheDocument();
  });

  it("lets you discard feedback you offered, after confirming", async () => {
    const user = userEvent.setup();
    requests = [{ ...alexAsked, employeeName: "Alex", reviewStatus: "DRAFT", isRequested: false }];
    show("?show=voluntary");
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.getByText("Discard your feedback for Alex?")).toBeInTheDocument();
    expect(
      screen.getByText("Your draft will be deleted on Alex. You can offer feedback again later."),
    ).toBeInTheDocument();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Discard" }));
    expect(discardMutate).toHaveBeenCalledWith("alex@example.com", expect.anything());
  });

  it("has no Discard for feedback you were asked for, or once you've submitted an offer", () => {
    requests = [
      { ...alexAsked, employeeName: "Alex", reviewStatus: "DRAFT" },
      { ...alexAsked, employeeEmail: "sam@example.com", employeeName: "Sam", reviewStatus: "SHARED", isRequested: false },
    ];
    show();
    expect(screen.getByRole("button", { name: "Decline" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument();
  });

  it("confirms before offering PAR feedback nobody asked for, and Back returns to the list", async () => {
    const user = userEvent.setup();
    show();
    await pick(user, "Alex");
    expect(screen.getByText(/Offer feedback for Alex's 2026 H2 PAR\?/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back" }));
    // The confirmation fades out before the tab is reachable again.
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("combobox", { name: "Search people" })).toHaveValue("");
    expect(offerMutate).not.toHaveBeenCalled();
    await user.type(screen.getByRole("combobox", { name: "Search people" }), "Alex");
    await user.click(screen.getByRole("option", { name: /Alex/ }));
    expect(screen.queryByRole("button", { name: "Cross-team" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Offer feedback" }));
    expect(offerMutate).toHaveBeenCalledWith({ employeeEmail: "alex@example.com" }, expect.anything());
  });

  it("stays open while the offer is being made, then opens the feedback form from it", async () => {
    const user = userEvent.setup();
    const view = show();
    await pick(user, "Alex");
    await user.click(screen.getByRole("button", { name: "Offer feedback" }));
    offerPending = true;
    view.rerender(tab());
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.getByText(/Offer feedback for Alex's 2026 H2 PAR\?/)).toBeInTheDocument();
    offerPending = false;
    act(() => offerMutate.mock.calls[0][1].onSuccess());
    expect(await screen.findByText("PAR form for Alex")).toBeInTheDocument();
  });

  it("doesn't list someone you've already given PAR feedback", async () => {
    const user = userEvent.setup();
    requests = [{ ...alexAsked, reviewStatus: "SHARED" }];
    show();
    await user.click(screen.getByRole("combobox", { name: "Search people" }));
    expect(screen.queryByRole("option", { name: /Alex/ })).not.toBeInTheDocument();
  });

  it("can't pick a leader while no Leadership 360° survey is open", async () => {
    const user = userEvent.setup();
    currentSurvey = null;
    show();
    await user.click(screen.getByRole("combobox", { name: "Search people" }));
    const elenaOption = screen.getByRole("option", { name: /Elena/ });
    expect(elenaOption).toHaveAttribute("aria-disabled", "true");
    expect(elenaOption).toHaveTextContent("Leadership 360° closed");
  });

  it("marks each row with its kind", () => {
    requests = [{ ...alexAsked, employeeName: "Alex" }];
    show();
    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.getByText("PAR 360°")).toBeInTheDocument();
  });

  it("keeps leaders pickable after feedback, and the form knows the cycle's anonymous one is used", async () => {
    const user = userEvent.setup();
    mine = { ...noFeedback(), anonymous: [{ leaderEmail: "elena@example.com" }] };
    show();
    await user.click(screen.getByRole("combobox", { name: "Search people" }));
    const elenaOption = screen.getByRole("option", { name: /Elena/ });
    expect(elenaOption).not.toHaveAttribute("aria-disabled", "true");
    expect(elenaOption).toHaveTextContent("Leadership 360° · Submitted");
    await user.click(elenaOption);
    expect(screen.getByText("Leadership form for Elena (named only)")).toBeInTheDocument();
  });
});

describe("ParGiveFeedbackTab: the leadership team", () => {
  it("waits for it before the person search, so a leader isn't taken for anyone else", () => {
    leaders = { ...query(undefined), isLoading: true };
    show();
    expect(screen.getByRole("combobox", { name: "Search people" })).toBeDisabled();
  });

  it("says when it couldn't be loaded, instead of listing requests as PAR feedback", () => {
    leaders = { ...query(undefined), isError: true, error: new Error("HTTP 500") };
    show();
    expect(screen.getByText(/Couldn't load the leadership team/)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Search people" })).toBeDisabled();
  });
});
