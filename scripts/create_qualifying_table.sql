-- Create qualifying table for F1 Championship Calculator
-- This table stores qualifying results for each track/event

CREATE TABLE qualifying (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track UUID NOT NULL REFERENCES selected_tracks(id),
  position INTEGER NOT NULL,
  driver UUID NOT NULL REFERENCES drivers(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes for better performance
CREATE INDEX idx_qualifying_track ON qualifying(track);
CREATE INDEX idx_qualifying_driver ON qualifying(driver);
CREATE INDEX idx_qualifying_position ON qualifying(track, position);

-- Add unique constraint to ensure one driver per position per track
ALTER TABLE qualifying ADD CONSTRAINT unique_driver_per_track UNIQUE (track, driver);
ALTER TABLE qualifying ADD CONSTRAINT unique_position_per_track UNIQUE (track, position);

-- Add RLS (Row Level Security) policies if needed
-- ALTER TABLE qualifying ENABLE ROW LEVEL SECURITY;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_qualifying_updated_at BEFORE UPDATE ON qualifying
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
