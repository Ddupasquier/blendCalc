export type FruitName =
  | "apple"
  | "banana"
  | "peach"
  | "pineapple"
  | "strawberry";

export type FloatingFruit = {
  id: string;
  name: FruitName;
  size: number;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  rotation: number;
  rotationSpeed: number;
};

export type AnimationBounds = {
  width: number;
  height: number;
};

export type PlacementFocus = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type RandomSource = () => number;

type FruitSeed = {
  name: FruitName;
  size: number;
};

const fruitSeeds: FruitSeed[] = [
  { name: "peach", size: 78 },
  { name: "pineapple", size: 92 },
  { name: "apple", size: 70 },
  { name: "banana", size: 88 },
  { name: "strawberry", size: 58 },
  { name: "peach", size: 62 },
  { name: "apple", size: 54 },
  { name: "banana", size: 74 },
  { name: "strawberry", size: 48 },
  { name: "pineapple", size: 72 },
];

const compactFruitIndexes = [0, 1, 2, 3, 4, 8];

const getFruitSeeds = (compact: boolean) => {
  return compact
    ? compactFruitIndexes.map((index) => fruitSeeds[index])
    : fruitSeeds;
};

const randomBetween = (minimum: number, maximum: number, random: RandomSource) => {
  return minimum + (maximum - minimum) * random();
};

const clamp = (value: number, minimum: number, maximum: number) => {
  return Math.min(Math.max(value, minimum), maximum);
};

const shuffle = <Value>(values: Value[], random: RandomSource) => {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled;
};

const getDefaultFocus = (
  bounds: AnimationBounds,
  compact: boolean,
): PlacementFocus => {
  const width = Math.min(bounds.width * (compact ? 0.82 : 0.5), 520);
  const height = Math.min(bounds.height * (compact ? 0.38 : 0.32), 320);
  return {
    x: (bounds.width - width) / 2,
    y: (bounds.height - height) / 2,
    width,
    height,
  };
};

const overlapsFocus = (
  x: number,
  y: number,
  size: number,
  focus: PlacementFocus,
  gap: number,
) => {
  return !(
    x + size < focus.x - gap ||
    x > focus.x + focus.width + gap ||
    y + size < focus.y - gap ||
    y > focus.y + focus.height + gap
  );
};

const overlapsFruit = (
  x: number,
  y: number,
  size: number,
  fruits: FloatingFruit[],
) => {
  const centerX = x + size / 2;
  const centerY = y + size / 2;
  return fruits.some((fruit) => {
    const distance = Math.hypot(
      centerX - (fruit.x + fruit.size / 2),
      centerY - (fruit.y + fruit.size / 2),
    );
    return distance < size * 0.44 + fruit.size * 0.44 + 8;
  });
};

const getInitialVelocity = (
  x: number,
  y: number,
  size: number,
  focus: PlacementFocus,
  speed: number,
  random: RandomSource,
) => {
  const fruitCenterX = x + size / 2;
  const fruitCenterY = y + size / 2;
  const focusCenterX = focus.x + focus.width / 2;
  const focusCenterY = focus.y + focus.height / 2;
  const differenceX = focusCenterX - fruitCenterX;
  const differenceY = focusCenterY - fruitCenterY;
  const distance = Math.max(Math.hypot(differenceX, differenceY), 1);
  const inwardX = differenceX / distance;
  const inwardY = differenceY / distance;
  const orbitDirection = random() < 0.5 ? -1 : 1;
  const tangentX = -inwardY * orbitDirection;
  const tangentY = inwardX * orbitDirection;
  const inwardWeight = randomBetween(0.35, 0.58, random);
  const directionX = inwardX * inwardWeight + tangentX * (1 - inwardWeight);
  const directionY = inwardY * inwardWeight + tangentY * (1 - inwardWeight);
  const directionLength = Math.max(Math.hypot(directionX, directionY), 1);

  return {
    x: (directionX / directionLength) * speed,
    y: (directionY / directionLength) * speed,
  };
};

const findPlacement = (
  size: number,
  index: number,
  count: number,
  bounds: AnimationBounds,
  focus: PlacementFocus,
  compact: boolean,
  fruits: FloatingFruit[],
  random: RandomSource,
) => {
  const centerX = focus.x + focus.width / 2;
  const centerY = focus.y + focus.height / 2;
  const gap = compact ? 8 : 14;
  const spread = compact ? 68 : 120;
  const angleOffset = random() * Math.PI * 2;
  let fallback = { x: centerX - size / 2, y: centerY - size / 2 };

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const sectorAngle = ((index + random() * 0.76) / count) * Math.PI * 2;
    const angle = sectorAngle + angleOffset + attempt * 2.399963;
    const directionX = Math.cos(angle);
    const directionY = Math.sin(angle);
    const horizontalDistance =
      (focus.width / 2 + size / 2 + gap) /
      Math.max(Math.abs(directionX), 0.08);
    const verticalDistance =
      (focus.height / 2 + size / 2 + gap) /
      Math.max(Math.abs(directionY), 0.08);
    const edgeDistance = Math.min(horizontalDistance, verticalDistance);
    const distance = edgeDistance + randomBetween(8, spread, random);
    const x = Math.min(
      Math.max(centerX + directionX * distance - size / 2, -size * 0.18),
      bounds.width - size * 0.82,
    );
    const y = Math.min(
      Math.max(centerY + directionY * distance - size / 2, -size * 0.18),
      bounds.height - size * 0.82,
    );

    fallback = { x, y };
    if (
      !overlapsFocus(x, y, size, focus, gap) &&
      !overlapsFruit(x, y, size, fruits)
    ) {
      return { x, y };
    }
  }

  return fallback;
};

export const createFloatingFruits = (
  bounds: AnimationBounds,
  compact: boolean,
  placementFocus?: PlacementFocus,
  random: RandomSource = Math.random,
): FloatingFruit[] => {
  const sizeScale = compact ? 0.62 : 1;
  const focus = placementFocus ?? getDefaultFocus(bounds, compact);
  const seeds = shuffle(getFruitSeeds(compact), random);
  const fruits: FloatingFruit[] = [];

  for (const [index, seed] of seeds.entries()) {
    const size = seed.size * sizeScale * randomBetween(0.88, 1.14, random);
    const placement = findPlacement(
      size,
      index,
      seeds.length,
      bounds,
      focus,
      compact,
      fruits,
      random,
    );
    const speed = randomBetween(compact ? 4 : 6, compact ? 7 : 10, random);
    const velocity = getInitialVelocity(
      placement.x,
      placement.y,
      size,
      focus,
      speed,
      random,
    );
    const rotationDirection = random() < 0.5 ? -1 : 1;
    fruits.push({
      id: `${seed.name}-${index}`,
      name: seed.name,
      size,
      x: placement.x,
      y: placement.y,
      velocityX: velocity.x,
      velocityY: velocity.y,
      rotation: randomBetween(-28, 28, random),
      rotationSpeed:
        rotationDirection * randomBetween(compact ? 1.5 : 2, compact ? 3.5 : 5, random),
    });
  }

  return fruits;
};

const wrapFruit = (fruit: FloatingFruit, bounds: AnimationBounds) => {
  const margin = fruit.size * 0.85;

  if (fruit.x < -fruit.size - margin) fruit.x = bounds.width + margin;
  if (fruit.x > bounds.width + margin) fruit.x = -fruit.size - margin;
  if (fruit.y < -fruit.size - margin) fruit.y = bounds.height + margin;
  if (fruit.y > bounds.height + margin) fruit.y = -fruit.size - margin;
};

const resolveCollision = (first: FloatingFruit, second: FloatingFruit) => {
  const firstRadius = first.size * 0.44;
  const secondRadius = second.size * 0.44;
  const firstCenterX = first.x + first.size / 2;
  const firstCenterY = first.y + first.size / 2;
  const secondCenterX = second.x + second.size / 2;
  const secondCenterY = second.y + second.size / 2;
  const differenceX = secondCenterX - firstCenterX;
  const differenceY = secondCenterY - firstCenterY;
  const minimumDistance = firstRadius + secondRadius;
  const distance = Math.hypot(differenceX, differenceY);

  if (distance >= minimumDistance) return;

  const normalX = distance === 0 ? 1 : differenceX / distance;
  const normalY = distance === 0 ? 0 : differenceY / distance;
  const overlap = minimumDistance - distance;
  first.x -= normalX * overlap * 0.5;
  first.y -= normalY * overlap * 0.5;
  second.x += normalX * overlap * 0.5;
  second.y += normalY * overlap * 0.5;

  const relativeVelocityX = second.velocityX - first.velocityX;
  const relativeVelocityY = second.velocityY - first.velocityY;
  const velocityAlongNormal =
    relativeVelocityX * normalX + relativeVelocityY * normalY;
  if (velocityAlongNormal >= 0) return;

  const firstMass = firstRadius * firstRadius;
  const secondMass = secondRadius * secondRadius;
  const inverseFirstMass = 1 / firstMass;
  const inverseSecondMass = 1 / secondMass;
  const restitution = 0.82;
  const impulse =
    (-(1 + restitution) * velocityAlongNormal) /
    (inverseFirstMass + inverseSecondMass);
  first.velocityX -= impulse * inverseFirstMass * normalX;
  first.velocityY -= impulse * inverseFirstMass * normalY;
  second.velocityX += impulse * inverseSecondMass * normalX;
  second.velocityY += impulse * inverseSecondMass * normalY;

  const tangentX = -normalY;
  const tangentY = normalX;
  const relativeTangentialVelocity =
    relativeVelocityX * tangentX + relativeVelocityY * tangentY;
  const spinTransfer = relativeTangentialVelocity * 0.38;
  const totalMass = firstMass + secondMass;
  first.rotationSpeed = clamp(
    first.rotationSpeed - spinTransfer * (secondMass / totalMass),
    -9,
    9,
  );
  second.rotationSpeed = clamp(
    second.rotationSpeed + spinTransfer * (firstMass / totalMass),
    -9,
    9,
  );
};

const resolveFocusCollision = (
  fruit: FloatingFruit,
  focus: PlacementFocus,
) => {
  const radius = fruit.size * 0.44;
  const centerX = fruit.x + fruit.size / 2;
  const centerY = fruit.y + fruit.size / 2;
  const gap = 5;
  const left = focus.x - gap;
  const right = focus.x + focus.width + gap;
  const top = focus.y - gap;
  const bottom = focus.y + focus.height + gap;
  const nearestX = clamp(centerX, left, right);
  const nearestY = clamp(centerY, top, bottom);
  let differenceX = centerX - nearestX;
  let differenceY = centerY - nearestY;
  let distance = Math.hypot(differenceX, differenceY);
  let correctionDistance = radius - distance;

  if (distance >= radius) return;

  if (distance === 0) {
    const distances = [
      { distance: centerX - left, normalX: -1, normalY: 0 },
      { distance: right - centerX, normalX: 1, normalY: 0 },
      { distance: centerY - top, normalX: 0, normalY: -1 },
      { distance: bottom - centerY, normalX: 0, normalY: 1 },
    ];
    const closestEdge = distances.reduce((closest, candidate) =>
      candidate.distance < closest.distance ? candidate : closest,
    );
    differenceX = closestEdge.normalX;
    differenceY = closestEdge.normalY;
    distance = 1;
    correctionDistance = radius + closestEdge.distance;
  }

  const normalX = differenceX / distance;
  const normalY = differenceY / distance;
  fruit.x += normalX * correctionDistance;
  fruit.y += normalY * correctionDistance;

  const velocityAlongNormal =
    fruit.velocityX * normalX + fruit.velocityY * normalY;
  if (velocityAlongNormal < 0) {
    const restitution = 0.76;
    fruit.velocityX -= (1 + restitution) * velocityAlongNormal * normalX;
    fruit.velocityY -= (1 + restitution) * velocityAlongNormal * normalY;

    const tangentSpeed = fruit.velocityX * -normalY + fruit.velocityY * normalX;
    fruit.rotationSpeed = clamp(
      fruit.rotationSpeed + tangentSpeed * 0.18,
      -9,
      9,
    );
  }
};

const steerTowardFocus = (
  fruit: FloatingFruit,
  focus: PlacementFocus,
  deltaSeconds: number,
) => {
  const fruitCenterX = fruit.x + fruit.size / 2;
  const fruitCenterY = fruit.y + fruit.size / 2;
  const focusCenterX = focus.x + focus.width / 2;
  const focusCenterY = focus.y + focus.height / 2;
  const differenceX = focusCenterX - fruitCenterX;
  const differenceY = focusCenterY - fruitCenterY;
  const distance = Math.max(Math.hypot(differenceX, differenceY), 1);
  const preferredDistance = Math.hypot(focus.width, focus.height) * 0.56;
  const attraction = distance > preferredDistance ? 2.4 : 0.45;

  fruit.velocityX += (differenceX / distance) * attraction * deltaSeconds;
  fruit.velocityY += (differenceY / distance) * attraction * deltaSeconds;

  const speed = Math.hypot(fruit.velocityX, fruit.velocityY);
  const maximumSpeed = 13;
  if (speed > maximumSpeed) {
    fruit.velocityX = (fruit.velocityX / speed) * maximumSpeed;
    fruit.velocityY = (fruit.velocityY / speed) * maximumSpeed;
  }
};

export const advanceFloatingFruits = (
  fruits: FloatingFruit[],
  bounds: AnimationBounds,
  deltaSeconds: number,
  focus?: PlacementFocus,
) => {
  const safeDelta = Math.min(Math.max(deltaSeconds, 0), 0.05);

  for (const fruit of fruits) {
    if (focus) steerTowardFocus(fruit, focus, safeDelta);
    fruit.x += fruit.velocityX * safeDelta;
    fruit.y += fruit.velocityY * safeDelta;
    fruit.rotation += fruit.rotationSpeed * safeDelta;
    if (focus) resolveFocusCollision(fruit, focus);
    wrapFruit(fruit, bounds);
  }

  for (let firstIndex = 0; firstIndex < fruits.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < fruits.length;
      secondIndex += 1
    ) {
      resolveCollision(fruits[firstIndex], fruits[secondIndex]);
    }
  }
};
