import { describe, expect, it } from "vitest";
import {
  advanceFloatingFruits,
  createFloatingFruits,
  type FloatingFruit,
  type PlacementFocus,
} from "$lib/utils/animation/floatingFruit";

const createSeededRandom = (initialSeed: number) => {
  let seed = initialSeed;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
};

describe("floating fruit animation", () => {
  it("uses fewer and smaller fruits on compact screens", () => {
    const desktop = createFloatingFruits(
      { width: 1000, height: 700 },
      false,
      undefined,
      createSeededRandom(1),
    );
    const compact = createFloatingFruits(
      { width: 390, height: 700 },
      true,
      undefined,
      createSeededRandom(1),
    );

    expect(desktop).toHaveLength(10);
    expect(compact).toHaveLength(6);
    expect(Math.max(...compact.map((fruit) => fruit.size))).toBeLessThan(
      Math.max(...desktop.map((fruit) => fruit.size)),
    );
  });

  it.each([
    { bounds: { width: 1200, height: 800 }, compact: false },
    { bounds: { width: 390, height: 700 }, compact: true },
  ])("starts without overlapping fruit", ({ bounds, compact }) => {
    for (let seed = 1; seed <= 25; seed += 1) {
      const fruits = createFloatingFruits(
        bounds,
        compact,
        undefined,
        createSeededRandom(seed),
      );

      for (let firstIndex = 0; firstIndex < fruits.length; firstIndex += 1) {
        for (
          let secondIndex = firstIndex + 1;
          secondIndex < fruits.length;
          secondIndex += 1
        ) {
          const first = fruits[firstIndex];
          const second = fruits[secondIndex];
          const distance = Math.hypot(
            second.x + second.size / 2 - (first.x + first.size / 2),
            second.y + second.size / 2 - (first.y + first.size / 2),
          );
          expect(distance).toBeGreaterThanOrEqual(
            first.size * 0.44 + second.size * 0.44,
          );
        }
      }
    }
  });

  it("randomizes the initial arrangement between page loads", () => {
    const bounds = { width: 1200, height: 800 };
    const first = createFloatingFruits(
      bounds,
      false,
      undefined,
      createSeededRandom(20),
    );
    const second = createFloatingFruits(
      bounds,
      false,
      undefined,
      createSeededRandom(21),
    );

    expect(first.map(({ name, x, y }) => ({ name, x, y }))).not.toEqual(
      second.map(({ name, x, y }) => ({ name, x, y })),
    );
  });

  it("places fruit near but outside the sign-in card", () => {
    const bounds = { width: 1200, height: 800 };
    const focus: PlacementFocus = {
      x: 360,
      y: 260,
      width: 480,
      height: 280,
    };
    const fruits = createFloatingFruits(
      bounds,
      false,
      focus,
      createSeededRandom(30),
    );
    const focusCenterX = focus.x + focus.width / 2;
    const focusCenterY = focus.y + focus.height / 2;

    for (const fruit of fruits) {
      const overlapsCard = !(
        fruit.x + fruit.size < focus.x ||
        fruit.x > focus.x + focus.width ||
        fruit.y + fruit.size < focus.y ||
        fruit.y > focus.y + focus.height
      );
      const distanceFromCardCenter = Math.hypot(
        fruit.x + fruit.size / 2 - focusCenterX,
        fruit.y + fruit.size / 2 - focusCenterY,
      );

      expect(overlapsCard).toBe(false);
      expect(distanceFromCardCenter).toBeLessThan(520);
    }
  });

  it("moves fruit according to its velocity", () => {
    const [fruit] = createFloatingFruits(
      { width: 1000, height: 700 },
      false,
      undefined,
      createSeededRandom(40),
    );
    const startingX = fruit.x;
    const expectedX = startingX + fruit.velocityX * 0.05;

    advanceFloatingFruits([fruit], { width: 1000, height: 700 }, 0.05);

    expect(fruit.x).toBeCloseTo(expectedX);
  });

  it("rotates continuously after rendering", () => {
    const [fruit] = createFloatingFruits(
      { width: 1000, height: 700 },
      false,
      undefined,
      createSeededRandom(42),
    );
    const startingRotation = fruit.rotation;

    advanceFloatingFruits([fruit], { width: 1000, height: 700 }, 0.05);

    expect(fruit.rotation).not.toBe(startingRotation);
    expect(Math.abs(fruit.rotationSpeed)).toBeGreaterThanOrEqual(2);
  });

  it("steers distant fruit back toward the sign-in area", () => {
    const focus: PlacementFocus = { x: 400, y: 250, width: 400, height: 260 };
    const fruit: FloatingFruit = {
      id: "returning-apple",
      name: "apple",
      size: 70,
      x: 10,
      y: 20,
      velocityX: -2,
      velocityY: -2,
      rotation: 0,
      rotationSpeed: 2,
    };

    advanceFloatingFruits([fruit], { width: 1200, height: 800 }, 0.05, focus);

    expect(fruit.velocityX).toBeGreaterThan(-2);
    expect(fruit.velocityY).toBeGreaterThan(-2);
  });

  it("bounces fruit away from the sign-in card", () => {
    const focus: PlacementFocus = { x: 300, y: 200, width: 400, height: 260 };
    const fruit: FloatingFruit = {
      id: "card-bound-peach",
      name: "peach",
      size: 80,
      x: 250,
      y: 280,
      velocityX: 10,
      velocityY: 0,
      rotation: 0,
      rotationSpeed: 2,
    };

    advanceFloatingFruits([fruit], { width: 1000, height: 700 }, 0.05, focus);

    expect(fruit.x + fruit.size / 2).toBeLessThan(focus.x);
    expect(fruit.velocityX).toBeLessThan(0);
  });

  it("separates overlapping fruit and redirects their movement", () => {
    const first: FloatingFruit = {
      id: "first",
      name: "apple",
      size: 100,
      x: 100,
      y: 100,
      velocityX: 10,
      velocityY: 0,
      rotation: 0,
      rotationSpeed: 0,
    };
    const second: FloatingFruit = {
      ...first,
      id: "second",
      x: 150,
      velocityX: -10,
    };

    advanceFloatingFruits([first, second], { width: 800, height: 600 }, 0);

    expect(second.x - first.x).toBeGreaterThanOrEqual(88);
    expect(first.velocityX).toBeLessThan(0);
    expect(second.velocityX).toBeGreaterThan(0);
  });

  it("transfers angular momentum during a glancing collision", () => {
    const first: FloatingFruit = {
      id: "spinning-first",
      name: "apple",
      size: 100,
      x: 100,
      y: 100,
      velocityX: 10,
      velocityY: 4,
      rotation: 0,
      rotationSpeed: 2,
    };
    const second: FloatingFruit = {
      ...first,
      id: "spinning-second",
      x: 165,
      y: 120,
      velocityX: -8,
      velocityY: -2,
      rotationSpeed: -2,
    };

    advanceFloatingFruits([first, second], { width: 800, height: 600 }, 0);

    expect(first.rotationSpeed).not.toBe(2);
    expect(second.rotationSpeed).not.toBe(-2);
    expect(Math.abs(first.rotationSpeed)).toBeLessThanOrEqual(9);
    expect(Math.abs(second.rotationSpeed)).toBeLessThanOrEqual(9);
  });
});
