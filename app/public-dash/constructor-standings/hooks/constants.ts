// Team color mapping for consistent chart colors
export const TEAM_COLOR_MAP: { [key: string]: string } = {
  'Red Bull': 'hsl(220, 100%, 30%)',
  'Mercedes': 'hsl(180, 100%, 50%)',
  'Mclaren': 'hsl(25, 100%, 50%)',
  'Ferrari': 'hsl(0, 100%, 50%)',
  'Sauber': 'hsl(120, 100%, 40%)',
  'Aston Martin': 'hsl(120, 100%, 25%)',
  'RB': 'hsl(230, 70%, 22%)',
  'Haas': 'hsl(0, 0%, 50%)',
  'Alpine': 'hsl(300, 100%, 35%)',
  'Williams': 'hsl(205, 90%, 50%)',
};

// Helper function to generate team color variations for stats chart
export const getTeamColorVariations = (teamName: string) => {
  const baseColor = TEAM_COLOR_MAP[teamName] || 'hsl(0, 0%, 50%)';

  const hslMatch = baseColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!hslMatch) {
    return {
      pointsFinishes: baseColor,
      podiums: baseColor,
      wins: baseColor,
      poles: baseColor,
      dnfs: baseColor,
    };
  }

  const [, h, s, l] = hslMatch.map(Number);

  return {
    pointsFinishes: `hsl(${h}, ${Math.min(s + 20, 100)}%, ${Math.min(l + 30, 85)}%)`,
    podiums: `hsl(${h}, ${s}%, ${Math.min(l + 15, 75)}%)`,
    wins: `hsl(${h}, ${s}%, ${l}%)`,
    poles: `hsl(${h}, ${Math.max(s - 10, 30)}%, ${Math.max(l - 15, 25)}%)`,
    dnfs: `hsl(${h}, ${Math.max(s - 20, 20)}%, ${Math.max(l - 30, 15)}%)`,
  };
};

// Helper function to extract image URL from HTML string
export const extractImageUrl = (htmlString: string): string => {
  if (!htmlString) return '';
  const srcMatch = htmlString.match(/src="([^"]+)"/);
  return srcMatch ? srcMatch[1] : '';
};
