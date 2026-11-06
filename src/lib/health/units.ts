export type UnitSystem = "metric" | "imperial";

const LB_PER_KG = 2.2046226218;
const INCHES_PER_CM = 1 / 2.54;
const FL_OZ_PER_ML = 0.0338140227;
const MILES_PER_METER = 0.000621371192;

export function kgToLb(kg: number): number {
  return kg * LB_PER_KG;
}

export function lbToKg(lb: number): number {
  return lb / LB_PER_KG;
}

export function cmToInches(cm: number): number {
  return cm * INCHES_PER_CM;
}

export function inchesToCm(inches: number): number {
  return inches / INCHES_PER_CM;
}

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cmToInches(cm);
  let feet = Math.floor(totalInches / 12);
  let inches = Math.round(totalInches - feet * 12);
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }
  return { feet, inches };
}

export function feetInchesToCm(feet: number, inches: number): number {
  return inchesToCm(feet * 12 + inches);
}

export function mlToFlOz(ml: number): number {
  return ml * FL_OZ_PER_ML;
}

export function flOzToMl(flOz: number): number {
  return flOz / FL_OZ_PER_ML;
}

export function metersToKilometers(meters: number): number {
  return meters / 1000;
}

export function kilometersToMeters(kilometers: number): number {
  return kilometers * 1000;
}

export function metersToMiles(meters: number): number {
  return meters * MILES_PER_METER;
}

export function milesToMeters(miles: number): number {
  return miles / MILES_PER_METER;
}

export function kilometersToMiles(kilometers: number): number {
  return metersToMiles(kilometersToMeters(kilometers));
}

export function milesToKilometers(miles: number): number {
  return metersToKilometers(milesToMeters(miles));
}

export function formatWeight(kg: number, unitSystem: UnitSystem): string {
  const value = unitSystem === "metric" ? kg : kgToLb(kg);
  return `${value.toFixed(1)} ${unitSystem === "metric" ? "kg" : "lb"}`;
}

export function formatHeight(cm: number, unitSystem: UnitSystem): string {
  if (unitSystem === "metric") return `${Math.round(cm)} cm`;
  const { feet, inches } = cmToFeetInches(cm);
  return `${feet} ft ${inches} in`;
}

export function formatVolume(ml: number, unitSystem: UnitSystem): string {
  if (unitSystem === "metric") return `${Math.round(ml)} ml`;
  return `${mlToFlOz(ml).toFixed(1)} fl oz`;
}

export function formatDistance(meters: number, unitSystem: UnitSystem): string {
  if (unitSystem === "metric") {
    const km = metersToKilometers(meters);
    return `${km.toFixed(km >= 10 ? 1 : 2)} km`;
  }
  return `${metersToMiles(meters).toFixed(2)} mi`;
}
