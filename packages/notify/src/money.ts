export function fmtKES(cents: number): string {
  return "KES " + (cents / 100).toLocaleString("en-KE", { maximumFractionDigits: 0 });
}
