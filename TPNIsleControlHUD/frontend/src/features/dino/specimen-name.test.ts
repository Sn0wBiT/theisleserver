import { describe, expect, it } from "vitest";
import { specimenName } from "./specimen-name";

describe("specimenName", () => {
  it("keeps ordinary species names", () => {
    expect(specimenName("Omniraptor")).toBe("Omniraptor");
  });

  it("extracts the specimen from an Unreal generated class path", () => {
    expect(specimenName("BlueprintGeneratedClass /Game/TheIsle/Core/Character/Dinosaurs/BP_CeratosaurusCharacter.BP_CeratosaurusCharacter_C"))
      .toBe("Ceratosaurus");
  });
});
