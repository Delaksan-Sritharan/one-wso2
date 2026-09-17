// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy at
// http://www.apache.org/licenses/LICENSE-2.0

import { describe, expect, it } from "vitest";
import type { UmtUpdateProduct } from "../api/umtUpdates";
import { isDescriptionInstructionComplete, umtProductHasDescriptionInstruction } from "./umtDescriptionInstruction";

function product(description: string | null | undefined, instruction: string | null | undefined): UmtUpdateProduct {
  return { productId: 1, description, instruction };
}

describe("umtProductHasDescriptionInstruction", () => {
  it("is true when both fields are non-blank", () => {
    expect(umtProductHasDescriptionInstruction(product("Does a thing", "Do the thing"))).toBe(true);
  });

  it("is false when description is missing", () => {
    expect(umtProductHasDescriptionInstruction(product(null, "Do the thing"))).toBe(false);
    expect(umtProductHasDescriptionInstruction(product(undefined, "Do the thing"))).toBe(false);
  });

  it("is false when instruction is missing", () => {
    expect(umtProductHasDescriptionInstruction(product("Does a thing", null))).toBe(false);
  });

  it("is false when either field is whitespace-only", () => {
    expect(umtProductHasDescriptionInstruction(product("   ", "Do the thing"))).toBe(false);
    expect(umtProductHasDescriptionInstruction(product("Does a thing", "   "))).toBe(false);
  });
});

describe("isDescriptionInstructionComplete", () => {
  it("is vacuously true for an empty, null, or undefined product list", () => {
    expect(isDescriptionInstructionComplete([])).toBe(true);
    expect(isDescriptionInstructionComplete(null)).toBe(true);
    expect(isDescriptionInstructionComplete(undefined)).toBe(true);
  });

  it("is true when every product is complete", () => {
    expect(
      isDescriptionInstructionComplete([
        product("Description A", "Instruction A"),
        product("Description B", "Instruction B"),
      ]),
    ).toBe(true);
  });

  it("is false when one product among several is incomplete", () => {
    expect(
      isDescriptionInstructionComplete([
        product("Description A", "Instruction A"),
        product("Description B", null),
      ]),
    ).toBe(false);
  });
});
