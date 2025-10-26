// ============================================================================
// UTILITY FUNCTIONS FOR DRIVER STANDINGS
// ============================================================================

/**
 * Extract image URL from HTML string
 */
export function extractImageUrl(htmlString: string): string {
  if (!htmlString) return "";
  const match = htmlString.match(/src="([^"]+)"/);
  return match ? match[1] : "";
}

/**
 * Calculate points for a race result based on position and bonuses
 */
export function calculateResultPoints(
  result: any,
  rules: any,
  eventType: string
): number {
  if (!result.racefinished) return 0;

  const racePointsMapping = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
  const sprintPointsMapping = [8, 7, 6, 5, 4, 3, 2, 1];

  const pointsMapping =
    eventType === "Sprint" ? sprintPointsMapping : racePointsMapping;
  const maxPositions = eventType === "Sprint" ? 8 : 10;

  const position = result.finishing_position ?? result.position;
  const basePoints =
    position <= maxPositions ? pointsMapping[position - 1] : 0;

  const poleBonus = rules.polegivespoint && result.pole ? 1 : 0;
  const fastestLapBonus =
    rules.fastestlapgivespoint && result.fastestlap ? 1 : 0;

  return basePoints + poleBonus + fastestLapBonus;
}

/**
 * Brighten HSL color for better readability in tooltips
 */
export function brightenColor(hslColor: string): string {
  const match = hslColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (match) {
    const h = match[1];
    const s = match[2];
    const l = Math.min(parseInt(match[3]) + 25, 75); // Increase lightness, cap at 75%
    return `hsl(${h}, ${s}%, ${l}%)`;
  }
  return hslColor;
}
