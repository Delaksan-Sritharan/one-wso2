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

import { describe, expect, it } from "vitest";
import { isPaidType } from "./engagementAccess";
import { defaultEnd, validateAllocation, validateTeamAllocation, type AllocationFormState } from "./allocationForm";
import {
  changesOf,
  engagementCode,
  needsFundingFields,
  newForm,
  subRegionLocked,
  validateForm,
  withAccount,
  type EngagementFormState,
} from "./engagementForm";
import { addDays, expiresIn, fmtRange, money } from "./format";
import { perDiemDays, perDiemTotal } from "./perDiem";
import { financeApproval, invoiceStage, nextAllocationStatuses, nextTravelStatuses, poApproval } from "./statuses";

describe("dates and amounts", () => {
  it("writes ranges the short way within a month or a year", () => {
    expect(fmtRange("2026-10-19", "2026-10-30")).toBe("19–30 Oct 2026");
    expect(fmtRange("2026-10-26", "2026-11-13")).toBe("26 Oct – 13 Nov 2026");
    expect(fmtRange("2026-12-28", "2027-01-03")).toBe("28 Dec 2026 – 3 Jan 2027");
  });

  it("steps civil dates across month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("shows LKR without cents, as the Travel app does", () => {
    expect(money(402000, "LKR")).toBe("LKR 402,000");
    expect(money(400, "GBP")).toBe("GBP 400.00");
  });

  it("says Expires In the legacy way", () => {
    expect(expiresIn(undefined, "2026-11-05").label).toBe("No expiry date");
    expect(expiresIn("2026-11-01", "2026-11-05")).toMatchObject({ label: "Expired", expired: true });
    expect(expiresIn("2026-12-05", "2026-11-05")).toMatchObject({ label: "1 mo", soon: true });
    expect(expiresIn("2029-11-05", "2026-11-05").label).toBe("3 yrs");
  });
});

describe("per diem maths (PerdiemInformation.js)", () => {
  it("counts the days inclusively", () => {
    expect(perDiemDays("2026-10-06T09:00", "2026-10-16T18:00")).toBe(11);
  });

  it("counts a first day starting after noon and a last day ending before noon as half days", () => {
    expect(perDiemTotal("2026-10-06T09:00", "2026-10-16T18:00", 70)).toBe(770);
    expect(perDiemTotal("2026-10-20T14:00", "2026-10-25T10:00", 330)).toBe(1650);
  });
});

describe("Create Engagement: the Engagement Code", () => {
  const opp = { id: "o", name: "Opp", lineItems: [{ id: "l", product: "P", code: "ORI-INT-0002-CO" }], preSalesCode: "ORI-INT-PR (Pre Sales)", postSalesCode: "ORI-INT-0002-CO" };
  it("uses the line item's code on a paid type", () => {
    expect(engagementCode({ typeId: 6, allocationType: "x" }, { opportunity: opp, lineItem: opp.lineItems[0] })).toBe("ORI-INT-0002-CO");
  });
  it("uses the pre-sales code on Non-Paid Pre Sale", () => {
    expect(engagementCode({ typeId: 3, allocationType: "x" }, { opportunity: opp })).toBe("ORI-INT-PR");
  });
  it("uses the post-sales code and the type's suffix on Non-Paid Post Sale", () => {
    expect(engagementCode({ typeId: 4, allocationType: "x" }, { opportunity: opp, allocationType: { id: "1", engagementTypeId: 4, name: "x", suffix: "QS" } })).toBe("ORI-QS");
  });
  it("uses the allocation type's default code and suffix otherwise", () => {
    expect(engagementCode({ typeId: 1, allocationType: "x" }, { allocationType: { id: "1", engagementTypeId: 1, name: "x", code: "MKT-BU_CHO", suffix: "GEN" } })).toBe("MKT-BU_CHO-GEN");
  });
});

describe("Create Engagement: the legacy checks", () => {
  const filled = (f: Partial<EngagementFormState>): EngagementFormState => ({
    ...newForm(1),
    title: "Bug bash",
    allocationType: "Bug Busting",
    nature: "Off-site",
    address: "Colombo\nSri Lanka",
    businessUnit: "Corporate",
    productUnit: "Corporate",
    subRegion: "Sri Lanka",
    start: "2026-11-10",
    end: "2026-11-12",
    ...f,
  });

  it("passes a complete internal engagement, line breaks and all", () => {
    expect(validateForm(filled({}), { edit: false, campaignRequired: false })).toEqual({});
  });

  it("asks for the funding fields only where the form supplies the funding source", () => {
    expect(needsFundingFields(1, false)).toBe(true); // internal
    expect(needsFundingFields(3, false)).toBe(true); // customer, not paid
    expect(needsFundingFields(7, false)).toBe(false); // paid customer: from the line item
    expect(needsFundingFields(5, false)).toBe(false); // marketing event: its own funding sources
    expect(needsFundingFields(1, true)).toBe(false); // edit keeps what the engagement has
    expect(needsFundingFields(0, false)).toBe(false); // no type yet
    const event = filled({ typeId: 5, campaignId: "7015g00000ApD26AAF", productUnit: "", subRegion: "",
      funding: [{ region: "APAC", subRegion: "", businessUnit: "IAM", productUnit: "", percentage: "100" }] });
    const x = validateForm(event, { edit: false, campaignRequired: true });
    expect(x.productUnit).toBeUndefined();
    expect(x.subRegion).toBeUndefined();
  });

  it("takes the account's fields on pick and drops the previous account's sub region", () => {
    const before = filled({ accountId: "001OLD", accountName: "Old", opportunityId: "006OLD", lineItemId: "00kOLD", subRegion: "APAC - SOUTH", country: "Sri Lanka" });
    const picked = withAccount(before, { id: "001NEW", name: "Acme Corp", country: "United States of America", subRegion: "NA - EAST", address: "1 Main St" });
    expect(picked).toMatchObject({ accountId: "001NEW", accountName: "Acme Corp", opportunityId: "", lineItemId: "", country: "United States of America", subRegion: "NA - EAST", address: "1 Main St" });
    const noRegion = withAccount(before, { id: "001NR", name: "Example Ltd" });
    expect(noRegion.subRegion).toBe("");
    expect(noRegion.country).toBe("Sri Lanka"); // kept when the account has none
    const cleared = withAccount(picked, null);
    expect(cleared).toMatchObject({ accountId: "", accountName: "", subRegion: "", address: "" });
  });

  it("locks the sales sub region to the account on customer create, open when the account has none", () => {
    const base = { cust: true, edit: false, pendingEdit: false, accountId: "001ABC", accountSubRegion: "NA - EAST" };
    expect(subRegionLocked(base)).toBe(true);
    expect(subRegionLocked({ ...base, accountSubRegion: "" })).toBe(false);
    expect(subRegionLocked({ ...base, accountId: "", accountSubRegion: "" })).toBe(true); // no account picked yet
    expect(subRegionLocked({ ...base, edit: true })).toBe(true);
    expect(subRegionLocked({ ...base, edit: true, pendingEdit: true })).toBe(false);
    expect(subRegionLocked({ ...base, cust: false })).toBe(false); // internal create
    expect(subRegionLocked({ ...base, cust: false, edit: true })).toBe(true);
  });

  it("needs a sales sub region on a paid customer create only when the account has none", () => {
    const paidType = 7;
    expect(isPaidType(paidType)).toBe(true);
    const paid = filled({ typeId: paidType, accountId: "001ABC", opportunityId: "006XYZ", lineItemId: "00kLINE", contact: "Jordan / +1 555", subRegion: "" });
    expect(validateForm(paid, { edit: false, campaignRequired: false, accountHasSubRegion: false }).subRegion).toBe("Select the sales sub region.");
    expect(validateForm(paid, { edit: false, campaignRequired: false, accountHasSubRegion: true }).subRegion).toBeUndefined();
    expect(validateForm({ ...paid, subRegion: "NA - EAST" }, { edit: false, campaignRequired: false, accountHasSubRegion: false }).subRegion).toBeUndefined();
    expect(validateForm(paid, { edit: true, campaignRequired: false, accountHasSubRegion: false }).subRegion).toBeUndefined();
  });

  it("needs the product unit and sales sub region the backend saves as the funding source", () => {
    const x = validateForm(filled({ productUnit: "", subRegion: "" }), { edit: false, campaignRequired: false });
    expect(x.productUnit).toBe("Select the product unit.");
    expect(x.subRegion).toBe("Select the sales sub region.");
    // Editing keeps what the engagement already has; only a create asks.
    expect(validateForm(filled({ productUnit: "", subRegion: "" }), { edit: true, campaignRequired: false }).productUnit).toBeUndefined();
  });

  it("needs a campaign for a new marketing event", () => {
    const x = validateForm(filled({ typeId: 5, funding: [{ region: "APAC", subRegion: "", businessUnit: "IAM", productUnit: "", percentage: "100" }] }), { edit: false, campaignRequired: true });
    expect(x.campaignId).toBe("Select the campaign.");
  });

  it("needs the funding sources to total 100% with no 0% row", () => {
    const base = { typeId: 5 as const, campaignId: "7015g00000ApD26AAF" };
    expect(validateForm(filled({ ...base, funding: [{ region: "APAC", subRegion: "", businessUnit: "IAM", productUnit: "", percentage: "60" }] }), { edit: false, campaignRequired: true }).funding).toBe(
      "Funding sources add up to 60%. They must total 100%.",
    );
    expect(
      validateForm(
        filled({
          ...base,
          funding: [
            { region: "APAC", subRegion: "", businessUnit: "IAM", productUnit: "", percentage: "100" },
            { region: "EU", subRegion: "", businessUnit: "IAM", productUnit: "", percentage: "0" },
          ],
        }),
        { edit: false, campaignRequired: true },
      ).funding,
    ).toBe("A funding source cannot be 0%.");
  });

  it("refuses an end date before the start", () => {
    expect(validateForm(filled({ end: "2026-11-01" }), { edit: false, campaignRequired: false }).end).toBe("The end date is before the start date.");
  });

  it("sends only what an edit changed, by the API's field names", () => {
    const orig = filled({});
    expect(changesOf(orig, orig)).toEqual({});
    expect(changesOf(orig, { ...orig, comment: "Café & co #2" })).toEqual({ comments: "Café & co #2" });
    expect(changesOf(orig, { ...orig, end: "2026-12-31" })).toEqual({ endDate: "2026-12-31" });
  });
});

describe("Add New Allocation: the legacy checks, in order", () => {
  const f: AllocationFormState = {
    start: "2026-12-07",
    end: "2026-12-11",
    hourly: false,
    timeZone: "Asia/Colombo",
    from: "09:00",
    to: "11:00",
    status: "Tentative",
    travel: "Yes",
    comment: "",
    tentative: false,
    preparation: false,
    preparationStart: "",
    postEngagement: false,
    postEngagementEnd: "",
  };
  const ctx = { engStart: "2026-12-07", engEnd: "2026-12-11", needsStatus: true };

  it("defaults the end to the engagement's end for two weeks or less, else twelve days in", () => {
    expect(defaultEnd("2026-12-07", "2026-12-11")).toBe("2026-12-11");
    expect(defaultEnd("2026-12-01", "2027-01-31")).toBe("2026-12-12");
  });

  it("passes a complete allocation", () => expect(validateAllocation(f, ctx)).toBeNull());
  it("needs Travel Required", () => expect(validateAllocation({ ...f, travel: "" }, ctx)).toBe("Some fields need attention."));
  it("keeps the dates inside the engagement", () => expect(validateAllocation({ ...f, end: "2026-12-12" }, ctx)).toBe("Start Date / End Date is not within the range"));
  it("needs the end time after the start time when hourly", () =>
    expect(validateAllocation({ ...f, hourly: true, from: "11:00", to: "10:00" }, ctx)).toBe("End Time should be higher than Start Time"));
  it("refuses team allocations more than 30 days back", () =>
    expect(validateTeamAllocation({ allocationType: "R&D", code: "RND-GEN", start: "2026-09-01", end: "2026-09-05" }, "2026-11-05", false)).toBe(
      "Dates cannot be less than  30 days from today",
    ));
});

describe("legacy status rules", () => {
  it("offers the Update Allocation Status transitions of the legacy list", () => {
    expect(nextAllocationStatuses("Clearance In Progress")).toEqual(["Accepted by Consultant", "Rejected by Consultant", "Allocation Cancelled"]);
    expect(nextAllocationStatuses("Rejected - Other")).toEqual(["Clearance In Progress", "Confirmed", "Confirmed - Visa Pending", "Allocation Cancelled"]);
  });

  it("offers the travel status transitions, the current status first", () => {
    expect(nextTravelStatuses("New")).toEqual(["New", "In Progress", "On Hold", "Cancelled"]);
  });

  it("places an invoice at its approval step; a push whose status did not come back is a sync failure", () => {
    expect(invoiceStage({ status: "Pending" })).toBe("po");
    expect(invoiceStage({ status: "Accepted by travel" })).toBe("finance");
    expect(invoiceStage({ status: "Accepted by finance" })).toBe("push");
    expect(invoiceStage({ status: "Accepted by finance", nsError: "timed out" })).toBe("failed");
    expect(invoiceStage({ status: "Complete" })).toBe("done");
  });

  it("reads PO and Finance Approval off the legacy status", () => {
    expect(poApproval({ status: "Rejected by finance" }).label).toBe("Approved");
    expect(financeApproval({ status: "Rejected by finance" }).label).toBe("Rejected");
    expect(financeApproval({ status: "Rejected by travel" }).label).toBe("Pending");
  });
});
