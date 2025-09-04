'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DataTable from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/db';
import { Result } from '@/models/Result';
import { IconTrophy, IconFlag, IconClock } from '@tabler/icons-react';
// Helper function to extract image URL from HTML string
function extractImageUrl(htmlString: string): string {
  if (!htmlString) return '';
  const match = htmlString.match(/src="([^"]+)"/);
  return match ? match[1] : '';
}


interface Track {
  id: string;
  name: string;
  type: 'Race' | 'Sprint';
}

interface TrackData {
  id: string;
  name: string;
  location?: string;
  country?: string;
}

interface Driver {
  id: string;
  name: string;
  driver_number: number | null;
  team: string;
}

interface Team {
  id: string;
  name: string;
  logo: string;
  color: string;
}

interface ExtendedResult extends Result {
  driverDetails: Driver;
  teamDetails: Team;
  time?: string;
  gap?: string;
  interval?: string;
  points: number;
  laps: number;
  fastestLapTime?: string;
  fastestLapNumber?: number;
  position: number; // Alias for finishing_position for easier access
  qualifyingTime?: string;
  q2Time?: string;
  q3Time?: string;
}

interface QualifyingResult {
  id: string;
  track: string;
  position: number;
  driver: string;
}

export default function ResultsPage() {
  const [selectedTrack, setSelectedTrack] = useState<string>('');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [results, setResults] = useState<ExtendedResult[]>([]);
  const [qualifyingResults, setQualifyingResults] = useState<QualifyingResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [tracksLoading, setTracksLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch tracks from selected-tracks API
  useEffect(() => {
    const fetchTracks = async () => {
      try {
        setTracksLoading(true);
        const response = await fetch('/api/selected-tracks');
        if (response.ok) {
          const tracksData = await response.json();
          console.log('Raw tracks data:', tracksData); // Debug log
          
          // Check if we have valid data
          if (tracksData && tracksData.length > 0) {
            // Transform the data to handle the nested track structure
            const transformedTracks: Track[] = tracksData.map((item: any) => {
              console.log('Processing item:', item); // Debug each item
              return {
                id: item.id,
                name: item.track?.name || 'Unknown Track',
                type: item.type || 'Race'
              };
            });
            console.log('Transformed tracks:', transformedTracks); // Debug log
            setTracks(transformedTracks);
          } else {
            console.log('No tracks data, trying direct tracks API');
            // Fallback to direct tracks API
            const tracksResponse = await fetch('/api/tracks');
            if (tracksResponse.ok) {
              const directTracks = await tracksResponse.json();
              const transformedDirectTracks: Track[] = directTracks.map((track: any) => ({
                id: track.id,
                name: track.name,
                type: 'Race' // Default to Race for direct tracks
              }));
              setTracks(transformedDirectTracks);
            } 
          }
        } else {
          console.error('Failed to fetch selected tracks, trying direct tracks API');
          // Fallback to direct tracks API
          const tracksResponse = await fetch('/api/tracks');
          if (tracksResponse.ok) {
            const directTracks = await tracksResponse.json();
            const transformedDirectTracks: Track[] = directTracks.map((track: any) => ({
              id: track.id,
              name: track.name,
              type: 'Race' // Default to Race for direct tracks
            }));
            setTracks(transformedDirectTracks);
          }
        }
      } catch (error) {
        console.error('Error fetching tracks:', error);
      } finally {
        setTracksLoading(false);
      }
    };

    fetchTracks();
  }, []);


  // Fetch results when track is selected
  useEffect(() => {
    const fetchResults = async () => {
      if (!selectedTrack) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Fetch race results
        const raceResponse = await fetch(`/api/results/with-details?track=${selectedTrack}`);
        if (raceResponse.ok) {
          const raceData = await raceResponse.json();
          setResults(raceData);
        } else {
          const errorData = await raceResponse.json();
          setError(errorData.error || 'Failed to load race results');
        }

        // Fetch qualifying results
        const qualifyingResponse = await fetch(`/api/qualifying?track=${selectedTrack}`);
        if (qualifyingResponse.ok) {
          const qualifyingData = await qualifyingResponse.json();
          setQualifyingResults(qualifyingData);
        } else {
          console.log('No qualifying data available');
          setQualifyingResults([]);
        }
      } catch (err) {
        setError('Failed to load results');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [selectedTrack]);

  const calculatePoints = (position: number, pole: boolean, fastestLap: boolean, type: 'Race' | 'Sprint'): number => {
    const racePoints = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
    const sprintPoints = [8, 7, 6, 5, 4, 3, 2, 1];
    
    const pointsMapping = type === 'Sprint' ? sprintPoints : racePoints;
    const basePoints = position <= pointsMapping.length ? pointsMapping[position - 1] : 0;
    
    // Add bonus points for pole and fastest lap (only in race)
    let bonusPoints = 0;
    if (type === 'Race') {
      if (pole) bonusPoints += 1;
      if (fastestLap) bonusPoints += 1;
    }
    
    return basePoints + bonusPoints;
  };
  // Reusable function for driver number styling
  const getDriverNumberStyles = (teamColor: string) => {
    const lightModeStyles: { [key: string]: { text: string, background: string } } = {
      '#002661': { text: '#1e40af', background: '#eff4fe' }, // Blue
      '#002d33': { text: '#0f766e', background: '#e2f8fb' }, // Teal
      '#461a08': { text: '#ea580c', background: '#fff3e9' }, // Orange
      '#520810': { text: '#dc2626', background: '#fffaee' }, // Red
      '#002f14': { text: '#16a34a', background: '#eaf6ed' }, // Green
      '#1b2d00': { text: '#65a30d', background: '#eef6e3' }, // Lime
      '#3a1659': { text: '#9333ea', background: '#f9f1ff' }, // Purple
      '#282828': { text: '#6b7280', background: '#f3f3f3' }, // Gray
      '#50003F': { text: '#c026d3', background: '#feeff9' }, // Magenta
    };

    const darkModeStyles: { [key: string]: { text: string, background: string } } = {
      '#002661': { text: '#dbeafe', background: '#1e40af' }, // Blue
      '#002d33': { text: '#ccfbf1', background: '#0f766e' }, // Teal
      '#461a08': { text: '#fed7aa', background: '#ea580c' }, // Orange
      '#520810': { text: '#fecaca', background: '#dc2626' }, // Red
      '#002f14': { text: '#bbf7d0', background: '#16a34a' }, // Green
      '#1b2d00': { text: '#d9f99d', background: '#65a30d' }, // Lime
      '#3a1659': { text: '#e9d5ff', background: '#9333ea' }, // Purple
      '#282828': { text: '#f3f4f6', background: '#6b7280' }, // Gray
      '#50003F': { text: '#fce7f3', background: '#c026d3' }, // Magenta
    };

    const light = lightModeStyles[teamColor] || { text: '#6b7280', background: '#f3f3f3' };
    const dark = darkModeStyles[teamColor] || { text: '#f3f4f6', background: '#6b7280' };

    return { light, dark };
  };
  // Race results columns
  const raceColumns = [
    {
      accessorKey: 'position',
      header: 'POS',
      cell: ({ row }: { row: { original: ExtendedResult } }) => (
        <div className="font-mono font-bold text-lg">{row.original.position}</div>
      )
    },
    {
      accessorKey: 'driverDetails.driver_number',
      header: 'NO',
      cell: ({ row }: { row: { original: ExtendedResult } }) => (
        <DriverNumberCell 
          driverNumber={row.original.driverDetails.driver_number} 
          teamColor={row.original.teamDetails?.color || '#282828'} 
        />
      )
    },
    {
      accessorKey: 'driverDetails.name',
      header: 'DRIVER',
      cell: ({ row }: { row: { original: ExtendedResult } }) => (
        <div className="font-semibold">{row.original.driverDetails.name}</div>
      )
    },
    {
      accessorKey: 'teamDetails.name',
      header: 'TEAM',
      cell: ({ row }: { row: { original: ExtendedResult } }) => (
        <div className="flex items-center gap-3">
          {(() => {
            const logoUrl = extractImageUrl(row.original.teamDetails?.logo || '');
            return logoUrl ? (
              <img
                src={logoUrl}
                alt={`${row.original.teamDetails?.name} logo`}
                className="w-6 h-6 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-6 h-6 flex items-center justify-center">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {row.original.teamDetails?.name?.charAt(0) || '?'}
                </span>
              </div>
            );
          })()}
          <span className="text-sm font-medium">
            {row.original.teamDetails?.name}
          </span>
        </div>
      )
    },
    {
      accessorKey: 'qualifyingPosition',
      header: 'STARTING GRID',
      cell: ({ row }: { row: { original: ExtendedResult } }) => {
        const qualifyingResult = qualifyingResults.find((q: QualifyingResult) => q.driver === row.original.driver);
        return (
          <div className="font-mono text-sm">
            {qualifyingResult?.position || '-'}
          </div>
        );
      }
    },
    {
      accessorKey: 'points',
      header: 'PTS',
      cell: ({ row }: { row: { original: ExtendedResult } }) => (
        <div className="font-mono font-bold text-lg">
          {row.original.points}
        </div>
      )
    }
  ];


  // Helper function to format time
  const formatTime = (time: string) => {
    return time.includes(':') ? time : `${time}s`;
  };

  // Reusable driver number cell component
  const DriverNumberCell = ({ driverNumber, teamColor }: { driverNumber: number | string | null, teamColor: string }) => {
    const { light, dark } = getDriverNumberStyles(teamColor);

    return (
      <>
        {/* Light Mode: Soft, bordered style */}
        <div 
          className="font-mono font-bold text-sm rounded-md px-2 py-1 inline-flex items-center justify-center min-w-[36px] dark:hidden"
          style={{ 
            color: light.text,
            backgroundColor: light.background,
            border: `1px solid ${light.text}33` // Subtle border with transparency
          }}
        >
          {driverNumber || '-'}
        </div>
        
        {/* Dark Mode: Solid, vibrant style */}
        <div 
          className="font-mono font-bold text-sm rounded-md px-2 py-1 hidden items-center justify-center min-w-[36px] dark:inline-flex"
          style={{ 
            color: dark.text,
            backgroundColor: dark.background
            // No border needed for the solid look in dark mode
          }}
        >
          {driverNumber || '-'}
        </div>
      </>
    );
  };

  // Get highlight data
  const raceWinner = results?.find((r: ExtendedResult) => r.position === 1);
  const poleSitter = results?.find((r: ExtendedResult) => r.pole);
  const fastestLapDriver = results?.find((r: ExtendedResult) => r.fastestlap);

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8">
      {/* Header with track selection */}
      {!tracksLoading && (
        <div className="flex items-center justify-between">
          <Select value={selectedTrack} onValueChange={setSelectedTrack}>
            <SelectTrigger className="w-48 md:w-[300px]">
              <SelectValue placeholder="Select a track...">
                {selectedTrack && tracks.find((t: Track) => t.id === selectedTrack) && (
                  <div className="flex items-center justify-between w-full">
                    <span className="font-medium truncate">
                      {tracks.find((t: Track) => t.id === selectedTrack)?.name}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {tracks.find((t: Track) => t.id === selectedTrack)?.type}
                    </span>
                  </div>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {tracks.map((track: Track) => (
                <SelectItem key={track.id} value={track.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{track.name}</span>
                    <span className="text-xs text-muted-foreground">{track.type}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {results && results.length > 0 && !loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 items-stretch animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          {/* Race Winner Card */}
          <Card className="min-h-[120px]">
            <CardHeader className="pb-2 min-h-[88px]">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-2xl font-bold mb-2 text-yellow-500">
                    {raceWinner?.driverDetails.name || '-'}
                  </CardTitle>
                  <div className="text-sm text-muted-foreground mb-4">Race Winner</div>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const logoUrl = extractImageUrl(raceWinner?.teamDetails?.logo || '');
                      return logoUrl ? (
                        <img
                          src={logoUrl}
                          alt={`${raceWinner?.teamDetails?.name} logo`}
                          className="w-4 h-4 object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-4 h-4 flex items-center justify-center">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            {raceWinner?.teamDetails?.name?.charAt(0) || '?'}
                          </span>
                        </div>
                      );
                    })()}
                    <span className="text-sm font-medium text-muted-foreground">
                      {raceWinner?.teamDetails?.name || '-'}
                    </span>
                  </div>
                </div>
                <IconTrophy className="h-6 w-6 text-yellow-500" />
              </div>
            </CardHeader>
          </Card>

          {/* Pole Position Card */}
          <Card className="min-h-[120px]">
            <CardHeader className="pb-2 min-h-[88px]">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-2xl font-bold mb-2 text-green-600">
                    {poleSitter?.driverDetails.name || '-'}
                  </CardTitle>
                  <div className="text-sm text-muted-foreground mb-4">Pole Position</div>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const logoUrl = extractImageUrl(poleSitter?.teamDetails?.logo || '');
                      return logoUrl ? (
                        <img
                          src={logoUrl}
                          alt={`${poleSitter?.teamDetails?.name} logo`}
                          className="w-4 h-4 object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-4 h-4 flex items-center justify-center">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            {poleSitter?.teamDetails?.name?.charAt(0) || '?'}
                          </span>
                        </div>
                      );
                    })()}
                    <span className="text-sm font-medium text-muted-foreground">
                      {poleSitter?.teamDetails?.name || '-'}
                    </span>
                  </div>
                </div>
                <IconFlag className="h-6 w-6 text-green-600" />
              </div>
            </CardHeader>
          </Card>

          {/* Fastest Lap Card */}
          <Card className="min-h-[120px]">
            <CardHeader className="pb-2 min-h-[88px]">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-2xl font-bold mb-2 text-purple-500">
                    {fastestLapDriver?.driverDetails.name || '-'}
                  </CardTitle>
                  <div className="text-sm text-muted-foreground mb-4">Fastest Lap</div>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const logoUrl = extractImageUrl(fastestLapDriver?.teamDetails?.logo || '');
                      return logoUrl ? (
                        <img
                          src={logoUrl}
                          alt={`${fastestLapDriver?.teamDetails?.name} logo`}
                          className="w-4 h-4 object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-4 h-4 flex items-center justify-center">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            {fastestLapDriver?.teamDetails?.name?.charAt(0) || '?'}
                          </span>
                        </div>
                      );
                    })()}
                    <span className="text-sm font-medium text-muted-foreground">
                      {fastestLapDriver?.teamDetails?.name || '-'}
                    </span>
                  </div>
                </div>
                <IconClock className="h-6 w-6 text-purple-500" />
              </div>
            </CardHeader>
          </Card>
        </div>
      )}

      {error ? (
        <div className="text-red-500 text-center py-8">{error}</div>
      ) : tracksLoading ? (
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <div className="text-muted-foreground">Loading tracks...</div>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <div className="text-muted-foreground">Loading results...</div>
        </div>
      ) : selectedTrack ? (
        <div className="w-full animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          {results && results.length > 0 ? (
            <div className="overflow-x-auto">
              <DataTable columns={raceColumns} data={results} />
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No race results available for this track.
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          Select a track to view results.
        </div>
      )}
    </div>
  );
}
