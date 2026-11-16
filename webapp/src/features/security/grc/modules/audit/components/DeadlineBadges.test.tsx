import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UltimateStatusBadge } from "@features/security/grc/modules/audit/components/DeadlineBadges";

describe("UltimateStatusBadge", () => {
  it("shows Delayed when the ultimate deadline was missed", () => {
    render(<UltimateStatusBadge delayed={true} />);
    expect(screen.getByText("Delayed")).toBeTruthy();
  });

  it("shows On track when it was not", () => {
    render(<UltimateStatusBadge delayed={false} />);
    expect(screen.getByText("On track")).toBeTruthy();
  });

  it("shows a dash when it cannot be known", () => {
    render(<UltimateStatusBadge delayed={null} />);
    expect(screen.getByText("—")).toBeTruthy();
  });
});
