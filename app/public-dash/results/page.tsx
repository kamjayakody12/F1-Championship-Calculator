'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DataTable from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/db';
import { Result } from '@/models/Result';

interface Track {
  id: string;
  name: string;
  type: 'Race' | 'Sprint';
}

interface Driver {
  id: string;
  name: string;
  number: number;
  team: string;
}

interface Team {
  id: string;
  name: string;
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
}

export default function ResultsPage() {
  const [selectedTrack, setSelectedTrack] = useState<string>('');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [results, setResults] = useState<ExtendedResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use dummy tracks data
  useEffect(() => {
    setTracks(dummyTracks);
  }, []);

  // Dummy data for testing
  const dummyTeams = [
    { id: '1', name: 'Red Bull Racing', color: '#3671C6' },
    { id: '2', name: 'Mercedes', color: '#6CD3BF' },
    { id: '3', name: 'Ferrari', color: '#F91536' },
    { id: '4', name: 'McLaren', color: '#F58020' },
    { id: '5', name: 'Aston Martin', color: '#358C75' },
    { id: '6', name: 'Alpine', color: '#2293D1' },
    { id: '7', name: 'Williams', color: '#37BEDD' },
    { id: '8', name: 'AlphaTauri', color: '#5E8FAA' },
    { id: '9', name: 'Alfa Romeo', color: '#C92D4B' },
    { id: '10', name: 'Haas F1 Team', color: '#B6BABD' }
  ];

  const dummyDrivers = [
    { id: '1', name: 'Max Verstappen', number: 1, team: '1' },
    { id: '2', name: 'Sergio Perez', number: 11, team: '1' },
    { id: '3', name: 'Lewis Hamilton', number: 44, team: '2' },
    { id: '4', name: 'George Russell', number: 63, team: '2' },
    { id: '5', name: 'Charles Leclerc', number: 16, team: '3' },
    { id: '6', name: 'Carlos Sainz', number: 55, team: '3' },
    { id: '7', name: 'Lando Norris', number: 4, team: '4' },
    { id: '8', name: 'Oscar Piastri', number: 81, team: '4' },
    { id: '9', name: 'Fernando Alonso', number: 14, team: '5' },
    { id: '10', name: 'Lance Stroll', number: 18, team: '5' },
    { id: '11', name: 'Pierre Gasly', number: 10, team: '6' },
    { id: '12', name: 'Esteban Ocon', number: 31, team: '6' },
    { id: '13', name: 'Alex Albon', number: 23, team: '7' },
    { id: '14', name: 'Logan Sargeant', number: 2, team: '7' },
    { id: '15', name: 'Yuki Tsunoda', number: 22, team: '8' },
    { id: '16', name: 'Daniel Ricciardo', number: 3, team: '8' },
    { id: '17', name: 'Valtteri Bottas', number: 77, team: '9' },
    { id: '18', name: 'Zhou Guanyu', number: 24, team: '9' },
    { id: '19', name: 'Kevin Magnussen', number: 20, team: '10' },
    { id: '20', name: 'Nico Hulkenberg', number: 27, team: '10' }
  ];

  const dummyTracks: Track[] = [
    { id: '1', name: 'Bahrain Grand Prix', type: 'Race' },
    { id: '2', name: 'Saudi Arabian Grand Prix', type: 'Race' },
    { id: '3', name: 'Australian Grand Prix', type: 'Race' },
    { id: '4', name: 'Japanese Grand Prix', type: 'Race' },
    { id: '5', name: 'Chinese Grand Prix', type: 'Race' },
    { id: '6', name: 'Miami Grand Prix', type: 'Race' },
    { id: '7', name: 'Emilia Romagna Grand Prix', type: 'Race' },
    { id: '8', name: 'Monaco Grand Prix', type: 'Race' },
    { id: '9', name: 'Canadian Grand Prix', type: 'Race' },
    { id: '10', name: 'Spanish Grand Prix', type: 'Race' }
  ];

  // Generate random time gaps
  const generateTimeGap = (position: number): string => {
    if (position === 1) return '';
    const seconds = (Math.random() * 30 + position * 2).toFixed(3);
    return `+${seconds}s`;
  };

  // Generate random intervals
  const generateInterval = (position: number, prevGap: string): string => {
    if (position === 1) return '';
    const prevSeconds = parseFloat(prevGap.replace('+', ''));
    const intervalSeconds = (Math.random() * 5).toFixed(3);
    return `+${intervalSeconds}s`;
  };

  // Fetch results when track is selected
  useEffect(() => {
    const fetchResults = async () => {
      if (!selectedTrack) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // For testing, we'll use dummy data instead of fetching from Supabase
        const shuffledDrivers = [...dummyDrivers].sort(() => Math.random() - 0.5);
        const dummyResults: ExtendedResult[] = shuffledDrivers.map((driver, index) => {
          const position = index + 1;
          const gap = generateTimeGap(position);
          const interval = generateInterval(position, gap);
          const team = dummyTeams.find(t => t.id === driver.team)!;
          const racefinished = Math.random() > 0.1; // 10% chance of DNF
          const isFastestLap = position === Math.floor(Math.random() * 5) + 1; // Random driver in top 5 gets fastest lap
          const fastestLapTime = isFastestLap ? '1:19.409' : undefined;
          const fastestLapNumber = isFastestLap ? 45 : undefined;
          
          return {
            id: `result-${position}`,
            track: selectedTrack,
            position,
            driver: driver.id,
            pole: position === 1,
            fastestlap: isFastestLap,
            racefinished,
            driverDetails: driver,
            teamDetails: team,
            time: racefinished ? (position === 1 ? '1:35:21.231' : '') : 'DNF',
            gap: racefinished ? gap : '',
            interval: racefinished ? interval : '',
            points: calculatePoints(position, position === 1, isFastestLap, 'Race'),
            laps: racefinished ? 70 : Math.floor(Math.random() * 50) + 10,
            fastestLapTime,
            fastestLapNumber
          };
        });

        setResults(dummyResults);
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

  const columns = [
    {
      accessorKey: 'position',
      header: 'POS',
      cell: ({ row }: { row: { original: ExtendedResult } }) => <div className="font-mono">{row.original.position}</div>
    },
    {
      accessorKey: 'driverDetails.number',
      header: 'NO',
      cell: ({ row }: { row: { original: ExtendedResult } }) => (
        <div className="font-mono" style={{ color: row.original.teamDetails?.color }}>
          {row.original.driverDetails.number}
        </div>
      )
    },
    {
      accessorKey: 'driverDetails.name',
      header: 'DRIVER',
      cell: ({ row }: { row: { original: ExtendedResult } }) => (
        <div className="flex items-center gap-2">
          <span>{row.original.driverDetails.name}</span>
          {row.original.pole && <Badge variant="outline">POLE</Badge>}
          {row.original.fastestlap && <Badge variant="outline">FL</Badge>}
        </div>
      )
    },
    {
      accessorKey: 'teamDetails.name',
      header: 'TEAM',
      cell: ({ row }: { row: { original: ExtendedResult } }) => (
        <div style={{ color: row.original.teamDetails?.color }}>
          {row.original.teamDetails?.name}
        </div>
      )
    },
    {
      accessorKey: 'time',
      header: 'TIME',
      cell: ({ row }: { row: { original: ExtendedResult } }) => <div className="font-mono">{row.original.time || 'DNF'}</div>
    },
    {
      accessorKey: 'gap',
      header: 'GAP',
      cell: ({ row }: { row: { original: ExtendedResult } }) => <div className="font-mono">{row.original.gap || '-'}</div>
    },
    {
      accessorKey: 'interval',
      header: 'INTERVAL',
      cell: ({ row }: { row: { original: ExtendedResult } }) => <div className="font-mono">{row.original.interval || '-'}</div>
    },
    {
      accessorKey: 'points',
      header: 'PTS',
      cell: ({ row }: { row: { original: ExtendedResult } }) => <div className="font-mono">{row.original.points}</div>
    },
    {
      accessorKey: 'laps',
      header: 'LAPS',
      cell: ({ row }: { row: { original: ExtendedResult } }) => <div className="font-mono">{row.original.laps}</div>
    }
  ];

  // Helper function to format time
  const formatTime = (time: string) => {
    return time.includes(':') ? time : `${time}s`;
  };

  // Get highlight data
  const raceWinner = results.find(r => r.position === 1);
  const poleSitter = results.find(r => r.pole);
  const fastestLapDriver = results.find(r => r.fastestlap);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Race Results</h1>
        <Select value={selectedTrack} onValueChange={setSelectedTrack}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Select a track..." />
          </SelectTrigger>
          <SelectContent>
            {tracks.map((track) => (
              <SelectItem key={track.id} value={track.id}>
                {track.name} ({track.type})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Race Winner Box */}
          <Card className="bg-[#0B0F19] border-none">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-400">Race Winner</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 3h14l2 4h-18l2-4z"/>
                  <path d="M17 7v6h-10v-6"/>
                  <path d="M7 21v-4h10v4"/>
                  <path d="M7 17l-3-4h16l-3 4"/>
                </svg>
              </div>
              <div className="flex items-center gap-3">
                <div 
                  className="w-1 h-12" 
                  style={{ backgroundColor: raceWinner?.teamDetails.color }}
                />
                <div>
                  <div className="text-xl font-bold">{raceWinner?.driverDetails.name}</div>
                  <div className="text-2xl font-mono">{raceWinner?.time}</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Pole Position Box */}
          <Card className="bg-[#0B0F19] border-none">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-400">Pole Position</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="8" r="6"/>
                  <path d="M12 14v8"/>
                  <path d="M9 18h6"/>
                </svg>
              </div>
              <div className="flex items-center gap-3">
                <div 
                  className="w-1 h-12" 
                  style={{ backgroundColor: poleSitter?.teamDetails.color }}
                />
                <div>
                  <div className="text-xl font-bold">{poleSitter?.driverDetails.name}</div>
                  <div className="text-2xl font-mono">1:15.372</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Fastest Lap Box */}
          <Card className="bg-[#0B0F19] border-none">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-gray-400">Fastest Lap</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
              </div>
              <div className="flex items-center gap-3">
                <div 
                  className="w-1 h-12" 
                  style={{ backgroundColor: fastestLapDriver?.teamDetails.color }}
                />
                <div>
                  <div className="text-xl font-bold">{fastestLapDriver?.driverDetails.name}</div>
                  <div className="text-2xl font-mono">
                    {fastestLapDriver?.fastestLapNumber && fastestLapDriver?.fastestLapTime
                      ? `Lap ${fastestLapDriver.fastestLapNumber} - ${fastestLapDriver.fastestLapTime}`
                      : '-'
                    }
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      <Card className="p-6">
        {error ? (
          <div className="text-red-500">{error}</div>
        ) : loading ? (
          <div className="text-center py-4">Loading results...</div>
        ) : results.length > 0 ? (
          <DataTable columns={columns} data={results} />
        ) : (
          <div className="text-center py-4">
            {selectedTrack ? 'No results available for this track.' : 'Select a track to view results.'}
          </div>
        )}
      </Card>
    </div>
  );
}
