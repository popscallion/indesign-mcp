export function toPoints(val: number | string, axis: "x"|"y"|"w"|"h", pageWidth: number, pageHeight: number): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    if (val.endsWith("%")) {
      const pct = parseFloat(val) / 100;
      if (axis === "x" || axis === "w") return pct * pageWidth;
      return pct * pageHeight;
    }
    if (val === "center") {
      return axis === "x" ? pageWidth / 2 : pageHeight / 2;
    }
    // Handle string numbers
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && val === parsed.toString()) {
      return parsed;
    }
  }
  throw new Error(`Unsupported coordinate value: ${val}`);
} 