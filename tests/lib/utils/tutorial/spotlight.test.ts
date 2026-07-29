import { describe, expect, it } from "vitest";
import {
  getTutorialBorderRadius,
  getTutorialCardPosition,
  getTutorialRoundedRectPath,
  getTutorialSpotlightGap,
  getTutorialSpotlightRadii,
  getTutorialSpotlightRect,
  parseTutorialCornerRadius,
} from "$lib/utils/tutorial/spotlight";

describe("tutorial spotlight geometry", () => {
  it("keeps at least one-half rem between the target and spotlight", () => {
    expect(getTutorialSpotlightGap(16)).toBe(8);
    expect(getTutorialSpotlightGap(20)).toBe(10);
  });

  it("pads a target while keeping the spotlight inside the viewport", () => {
    expect(
      getTutorialSpotlightRect(
        {
          top: 4,
          right: 316,
          bottom: 100,
          left: 2,
          width: 314,
          height: 96,
        },
        { width: 320, height: 568 },
      ),
    ).toEqual({
      top: 8,
      right: 312,
      bottom: 108,
      left: 8,
      width: 304,
      height: 100,
    });
  });

  it("keeps the spotlight inside its owning view frame", () => {
    expect(
      getTutorialSpotlightRect(
        {
          top: 40,
          right: 292,
          bottom: 100,
          left: 28,
          width: 264,
          height: 60,
        },
        { width: 320, height: 568 },
        8,
        0,
        {
          top: 20,
          right: 300,
          bottom: 540,
          left: 20,
          width: 280,
          height: 520,
        },
      ),
    ).toEqual({
      top: 32,
      right: 300,
      bottom: 108,
      left: 20,
      width: 280,
      height: 76,
    });
  });

  it("parses pixel and elliptical percentage radii", () => {
    expect(
      parseTutorialCornerRadius("16px", { width: 100, height: 80 }),
    ).toEqual({ horizontal: 16, vertical: 16 });
    expect(
      parseTutorialCornerRadius("50% 25%", {
        width: 100,
        height: 80,
      }),
    ).toEqual({ horizontal: 50, vertical: 20 });
  });

  it("expands each target corner by the actual spotlight gap", () => {
    const radii = getTutorialSpotlightRadii(
      {
        topLeft: { horizontal: 12, vertical: 10 },
        topRight: { horizontal: 20, vertical: 18 },
        bottomRight: { horizontal: 4, vertical: 6 },
        bottomLeft: { horizontal: 0, vertical: 0 },
      },
      {
        top: 40,
        right: 292,
        bottom: 100,
        left: 28,
        width: 264,
        height: 60,
      },
      {
        top: 32,
        right: 300,
        bottom: 108,
        left: 20,
        width: 280,
        height: 76,
      },
    );

    expect(radii).toEqual({
      topLeft: { horizontal: 20, vertical: 18 },
      topRight: { horizontal: 28, vertical: 26 },
      bottomRight: { horizontal: 12, vertical: 14 },
      bottomLeft: { horizontal: 8, vertical: 8 },
    });
    expect(getTutorialBorderRadius(radii)).toBe(
      "20px 28px 12px 8px / 18px 26px 14px 8px",
    );
    expect(
      getTutorialRoundedRectPath(
        {
          top: 32,
          right: 300,
          bottom: 108,
          left: 20,
          width: 280,
          height: 76,
        },
        radii,
      ),
    ).toContain("A 28 26 0 0 1 300 58");
  });

  it("places the tutorial card below the spotlight when space is available", () => {
    expect(
      getTutorialCardPosition(
        {
          top: 40,
          right: 300,
          bottom: 120,
          left: 20,
          width: 280,
          height: 80,
        },
        { width: 280, height: 220 },
        { width: 320, height: 568 },
      ),
    ).toEqual({ top: 132, left: 20 });
  });

  it("places the tutorial card above a low spotlight", () => {
    expect(
      getTutorialCardPosition(
        {
          top: 400,
          right: 300,
          bottom: 500,
          left: 20,
          width: 280,
          height: 100,
        },
        { width: 280, height: 220 },
        { width: 320, height: 568 },
      ),
    ).toEqual({ top: 168, left: 20 });
  });
});
