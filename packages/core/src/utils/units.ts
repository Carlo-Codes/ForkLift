import type { Unit } from "@forklift/db/client";

const KG_PER_LB = 0.45359237;

// A weight in one unit expressed in the other, to the nearest 0.1.
export function convertWeight(weight: number, from: Unit, to: Unit): number {
  const converted = from === to ? weight : from === "kg" ? weight / KG_PER_LB : weight * KG_PER_LB;

  return Math.round(converted * 10) / 10;
}
