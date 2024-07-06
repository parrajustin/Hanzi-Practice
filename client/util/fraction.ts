/** Represents the fractional value of something from 0 to 1. */
export class FractionD {
  constructor(f: number) {
    this.fraction = Math.max(0.0, Math.min(1.0, f));
  }
  public readonly fraction: number;

  public static MAX = new FractionD(1.0);
  public static MIN = new FractionD(0.0);
  public static ZERO = FractionD.MIN;
}
