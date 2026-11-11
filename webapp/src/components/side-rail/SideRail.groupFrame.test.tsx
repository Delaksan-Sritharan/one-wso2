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

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AwardIcon, NetworkIcon, TrendingUpIcon, UsersIcon } from "@wso2/oxygen-ui-icons-react";

// Same seams as SideRail.userGuide.test.tsx: the GRC fetch shim, the active
// perspective, and the visibility gates.
vi.mock("@features/security/grc/shim/useAuthApiClient", () => ({
  useAuthApiClient: () => vi.fn(),
}));
vi.mock("@context/perspective/PerspectiveContext", () => ({
  useActivePerspective: () => ({
    key: "people",
    label: "People Ops",
    icon: UsersIcon,
    path: "/people-ops",
    forwardsToFirstItem: true,
    sections: [
      { id: "org-chart", label: "Org Chart", icon: NetworkIcon, path: "/people-ops/org-chart" },
      {
        id: "promotion",
        label: "Promotion",
        icon: AwardIcon,
        children: [
          { id: "promotion-lead", label: "Lead", path: "/people-ops/promotion/lead" },
          { id: "promotion-board", label: "Board", path: "/people-ops/promotion/board" },
        ],
      },
      {
        id: "performance",
        label: "Performance",
        icon: TrendingUpIcon,
        children: [
          { id: "performance-lead", label: "Reviews", path: "/people-ops/performance/lead" },
          { id: "performance-admin", label: "Cycles", path: "/people-ops/performance/admin" },
        ],
      },
    ],
  }),
}));
vi.mock("./usePerspectiveVisibility", () => ({
  usePerspectiveVisibility: () => ({ resolveVisible: () => true }),
}));

import SideRail from "./SideRail";

function renderSideRail({ collapsed, at }: { collapsed: boolean; at: string }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[at]}>
        <SideRail collapsed={collapsed} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const px = (value: string) => parseFloat(value) || 0;

function horizontalSpace(el: Element): number {
  const s = getComputedStyle(el);
  return (
    px(s.marginLeft) + px(s.marginRight) +
    px(s.paddingLeft) + px(s.paddingRight) +
    px(s.borderLeftWidth) + px(s.borderRightWidth)
  );
}

function verticalSpace(el: Element): number {
  const s = getComputedStyle(el);
  return (
    px(s.marginTop) + px(s.marginBottom) +
    px(s.paddingTop) + px(s.paddingBottom) +
    px(s.borderTopWidth) + px(s.borderBottomWidth) +
    declaredBlockSpace(el)
  );
}

/**
 * jsdom leaves margin-block, padding-block, and border-block off the physical sides, so a group
 * can grow while marginTop and paddingTop stay empty. Those shorthands are read from the rules
 * that match the element.
 */
function declaredBlockSpace(element: Element): number {
  let marginStart = "";
  let marginEnd = "";
  let marginBlock = "";
  let paddingStart = "";
  let paddingEnd = "";
  let paddingBlock = "";
  let borderStart = "";
  let borderEnd = "";
  let borderBlock = "";
  for (const rule of styleRules()) {
    if (rule.selectorText.includes("::")) continue;
    if (!selectorMatches(element, rule.selectorText)) continue;
    const style = rule.style;
    const keep = (property: string, current: string) => style.getPropertyValue(property) || current;
    marginStart = keep("margin-block-start", marginStart);
    marginEnd = keep("margin-block-end", marginEnd);
    marginBlock = keep("margin-block", marginBlock);
    paddingStart = keep("padding-block-start", paddingStart);
    paddingEnd = keep("padding-block-end", paddingEnd);
    paddingBlock = keep("padding-block", paddingBlock);
    borderStart = keep("border-block-start-width", borderStart);
    borderEnd = keep("border-block-end-width", borderEnd);
    borderBlock = keep("border-block-width", "") || keep("border-block", borderBlock);
  }
  return (
    pair(marginStart, marginEnd, marginBlock) +
    pair(paddingStart, paddingEnd, paddingBlock) +
    pair(borderStart, borderEnd, borderBlock)
  );
}

function pair(start: string, end: string, shorthand: string): number {
  if (start || end) return px(start) + px(end);
  return bothSides(shorthand);
}

function bothSides(value: string): number {
  const sizes = value.trim().split(/\s+/).filter((part) => part === "0" || /^[\d.]+(px|rem|em|%)$/.test(part));
  if (sizes.length === 0) return 0;
  if (sizes.length === 1) return px(sizes[0]) * 2;
  return px(sizes[0]) + px(sizes[1]);
}

/**
 * Every element a group adds between the list the plain rows sit in and one of
 * the group's own rows, labelled with the space it takes, so a failure names
 * the element that moved the row.
 */
function wrappersAround(rowName: string, measure: (el: Element) => number): string[] {
  const plainRowList = screen.getByRole("button", { name: "Org Chart" }).closest("ul");
  const wrappers: string[] = [];
  let el = screen.getByRole("button", { name: rowName }).parentElement;
  while (el && el !== plainRowList) {
    wrappers.push(`${el.tagName.toLowerCase()}.${el.className.split(" ")[0]} ${measure(el)}px`);
    el = el.parentElement;
  }
  expect(el, "the group should sit in the same list as the plain rows").toBe(plainRowList);
  return wrappers;
}

const takingNoSpace = (wrappers: string[]) => wrappers.map((w) => w.replace(/ [\d.]+px$/, " 0px"));

// jsdom does no layout, so this can't measure where a row's icon and label
// land. It checks what decides that instead: Oxygen insets every row the same
// way, so a group's rows share the plain rows' icon and label columns exactly
// when nothing the group wraps them in takes horizontal room. A frame drawn
// with margin and border did, even while it was transparent.
describe("SideRail group rows", () => {
  it("line up with the plain rows while the group is open", () => {
    renderSideRail({ collapsed: false, at: "/people-ops/promotion/lead" });
    expect(screen.getByRole("button", { name: "Promotion" })).toHaveAttribute("aria-expanded", "true");

    const header = wrappersAround("Promotion", horizontalSpace);
    expect(header).toEqual(takingNoSpace(header));
    const down = wrappersAround("Promotion", verticalSpace);
    expect(down).toEqual(takingNoSpace(down));
    const child = wrappersAround("Board", horizontalSpace);
    expect(child).toEqual(takingNoSpace(child));
  });

  it("line up with, and are as tall as, the plain rows while the group is closed", () => {
    renderSideRail({ collapsed: false, at: "/people-ops/org-chart" });
    expect(screen.getByRole("button", { name: "Promotion" })).toHaveAttribute("aria-expanded", "false");

    const across = wrappersAround("Promotion", horizontalSpace);
    expect(across).toEqual(takingNoSpace(across));
    const down = wrappersAround("Promotion", verticalSpace);
    expect(down).toEqual(takingNoSpace(down));
  });

  it("line up with the plain rows on the collapsed rail", () => {
    renderSideRail({ collapsed: true, at: "/people-ops/promotion/lead" });

    const across = wrappersAround("Promotion", horizontalSpace);
    expect(across).toEqual(takingNoSpace(across));
  });

  it("counts a margin-block on the open group's list", () => {
    renderSideRail({ collapsed: false, at: "/people-ops/promotion/lead" });
    withRule(groupWrapper("Promotion"), "", "margin-block: 8px", () => {
      const down = wrappersAround("Promotion", verticalSpace);
      expect(down).not.toEqual(takingNoSpace(down));
    });
  });
});

const NO_OUTLINE = { border: "none", background: "none", shadow: "none" };

/**
 * Border, background, and shadow of the <li> around a group's rows. The rail used to paint the
 * border and tint on that element's ::before, and jsdom leaves pseudo-elements out of
 * getComputedStyle, so ::before and ::after are read from the rules that match the <li>. A border,
 * tint, or shadow on the <li> itself is its computed style.
 */
function outlineOf(groupName: string): { border: string; background: string; shadow: string } {
  const wrapper = groupWrapper(groupName);
  return joinPaint([
    paintOf(getComputedStyle(wrapper)),
    pseudoPaint(wrapper, "::before"),
    pseudoPaint(wrapper, "::after"),
  ]);
}

function groupWrapper(groupName: string): HTMLElement {
  const plainRowList = screen.getByRole("button", { name: "Org Chart" }).closest("ul");
  const wrapper = screen.getByRole("button", { name: groupName }).closest("li")?.parentElement?.closest("li");
  if (!(wrapper instanceof HTMLElement) || wrapper.parentElement !== plainRowList) {
    throw new Error(`no list around ${groupName}`);
  }
  return wrapper;
}

function joinPaint(parts: (typeof NO_OUTLINE)[]): typeof NO_OUTLINE {
  const pick = (key: keyof typeof NO_OUTLINE) =>
    parts.map((part) => part[key]).filter((value) => value !== "none").join("; ") || "none";
  return { border: pick("border"), background: pick("background"), shadow: pick("shadow") };
}

function paintOf(style: CSSStyleDeclaration): typeof NO_OUTLINE {
  const sides = [
    ["top", style.borderTopWidth, style.borderTopColor],
    ["right", style.borderRightWidth, style.borderRightColor],
    ["bottom", style.borderBottomWidth, style.borderBottomColor],
    ["left", style.borderLeftWidth, style.borderLeftColor],
  ] as const;
  const visible = sides.filter(([, width, color]) => px(width) > 0 && !isClear(color));
  return {
    border: visible.length === 0 ? "none" : visible.map(([side, width, color]) => `${side} ${width} ${color}`).join(", "),
    background: isClear(style.backgroundColor) ? "none" : style.backgroundColor,
    shadow: style.boxShadow && style.boxShadow !== "none" ? style.boxShadow : "none",
  };
}

function isClear(color: string): boolean {
  const value = color.trim().toLowerCase();
  if (value === "" || value === "transparent") return true;
  const rgba = value.match(/^rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)$/);
  if (rgba) return Number(rgba[1]) === 0;
  const withSlash = value.match(/^rgba?\(\s*[\d.]+\s+[\d.]+\s+[\d.]+\s*\/\s*([\d.]+)%?\s*\)$/);
  return withSlash !== null && Number(withSlash[1]) === 0;
}

function pseudoPaint(element: Element, pseudo: "::before" | "::after"): typeof NO_OUTLINE {
  const probe = document.createElement("div");
  document.body.appendChild(probe);
  try {
    for (const rule of pseudoRules(element, pseudo)) copyDeclarations(rule, probe);
    return paintOf(getComputedStyle(probe));
  } finally {
    probe.remove();
  }
}

function copyDeclarations(rule: CSSStyleRule, target: HTMLElement) {
  for (let index = 0; index < rule.style.length; index += 1) {
    const property = rule.style.item(index);
    target.style.setProperty(property, rule.style.getPropertyValue(property), rule.style.getPropertyPriority(property));
  }
}

function pseudoRules(element: Element, pseudo: "::before" | "::after"): CSSStyleRule[] {
  return styleRules().filter((rule) => {
    if (!rule.selectorText.endsWith(pseudo)) return false;
    return selectorMatches(element, rule.selectorText.slice(0, -pseudo.length));
  });
}

function styleRules(): CSSStyleRule[] {
  const rules: CSSStyleRule[] = [];
  const walk = (list: CSSRuleList) => {
    for (const rule of list) {
      if (rule instanceof CSSStyleRule) rules.push(rule);
      else if ("cssRules" in rule && rule.cssRules instanceof CSSRuleList) {
        walk(rule.cssRules);
      }
    }
  };
  for (const sheet of document.styleSheets) {
    try {
      walk(sheet.cssRules);
    } catch {
      // A sheet from another origin does not expose its rules.
    }
  }
  return rules;
}

function selectorMatches(element: Element, selector: string): boolean {
  try {
    return element.matches(selector);
  } catch {
    // jsdom throws when it cannot parse the selector.
    return false;
  }
}

describe("SideRail group outline", () => {
  it("does not outline the open group you are in, or a group opened beside it", () => {
    renderSideRail({ collapsed: false, at: "/people-ops/promotion/lead" });
    fireEvent.click(screen.getByRole("button", { name: "Performance" }));

    expect(screen.getByRole("button", { name: "Promotion" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Performance" })).toHaveAttribute("aria-expanded", "true");
    expect(outlineOf("Promotion")).toEqual(NO_OUTLINE);
    expect(outlineOf("Performance")).toEqual(NO_OUTLINE);
  });

  it("notices a border, a shadow, or a ::before on the group list", () => {
    renderSideRail({ collapsed: false, at: "/people-ops/promotion/lead" });
    const wrapper = groupWrapper("Promotion");

    withRule(wrapper, "", "border: 1px solid rgb(255, 122, 0); box-shadow: 0 0 0 1px rgb(255, 122, 0)", () => {
      expect(outlineOf("Promotion")).not.toEqual(NO_OUTLINE);
    });
    expect(outlineOf("Promotion")).toEqual(NO_OUTLINE);

    withRule(wrapper, "::before", 'content: ""; border: 1px solid rgb(255, 122, 0); background-color: rgba(255, 122, 0, 0.04)', () => {
      expect(outlineOf("Promotion")).not.toEqual(NO_OUTLINE);
    });
    withRule(wrapper, "::after", 'content: ""; border: 1px solid rgb(255, 122, 0)', () => {
      expect(outlineOf("Promotion")).not.toEqual(NO_OUTLINE);
    });
  });
});

function withRule(element: Element, pseudo: "" | "::before" | "::after", declarations: string, run: () => void) {
  const style = document.createElement("style");
  document.head.appendChild(style);
  try {
    style.sheet?.insertRule(`${ownSelector(element)}${pseudo} { ${declarations} }`, 0);
    run();
  } finally {
    style.remove();
  }
}

function ownSelector(element: Element): string {
  const classes = [...element.classList];
  if (classes.length === 0) throw new Error("the group list has no class");
  return `.${classes.join(".")}`;
}
