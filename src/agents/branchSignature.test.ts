import { describe, expect, it } from "vitest";
import { branchSignature } from "./branchScoring";

const base = {
  cities: [
    { name: "Rome", nights: 4, lat: 41.9, lng: 12.5 },
    { name: "Florence", nights: 4, lat: 43.8, lng: 11.3 },
    { name: "Venice", nights: 3, lat: 45.4, lng: 12.3 }
  ],
  anchors: ["Uffizi Gallery", "Trastevere food walk"],
  movementPattern: "linear chain",
  register: "food-led"
};

describe("branchSignature", () => {
  it("treats rhythm branches with the same nights split as the same option", () => {
    // "Show more options" reliably produces a fresh title over an identical
    // nights split; for rhythm that split is the decision itself.
    const renamed = { ...base, anchors: ["Something else"], register: "iconic sights" };
    expect(branchSignature(renamed, "rhythm")).toBe(branchSignature(base, "rhythm"));
  });

  it("keeps rhythm branches that actually redistribute nights", () => {
    const shifted = {
      ...base,
      cities: [
        { name: "Rome", nights: 6, lat: 41.9, lng: 12.5 },
        { name: "Florence", nights: 3, lat: 43.8, lng: 11.3 },
        { name: "Venice", nights: 2, lat: 45.4, lng: 12.3 }
      ]
    };
    expect(branchSignature(shifted, "rhythm")).not.toBe(branchSignature(base, "rhythm"));
  });

  it("ignores nights for anchors, where an identical split is legitimate", () => {
    const differentAnchors = { ...base, anchors: ["Borghese Gallery", "Cinque Terre day trip"] };
    expect(branchSignature(differentAnchors, "anchors")).not.toBe(branchSignature(base, "anchors"));

    const reordered = { ...base, anchors: [...base.anchors].reverse() };
    expect(branchSignature(reordered, "anchors")).toBe(branchSignature(base, "anchors"));
  });

  it("compares city sets for tripShape regardless of nights", () => {
    const sameCitiesDifferentNights = {
      ...base,
      cities: base.cities.map((city) => ({ ...city, nights: 1 }))
    };
    expect(branchSignature(sameCitiesDifferentNights, "tripShape")).toBe(branchSignature(base, "tripShape"));
  });
});
