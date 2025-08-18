-- Add qualifying_position field to results table to link with qualifying data
-- This allows race results to reference the starting grid position

-- Add the qualifying_position column to the results table
ALTER TABLE results ADD COLUMN qualifying_position INTEGER;

-- Add a comment to explain the field
COMMENT ON COLUMN results.qualifying_position IS 'The qualifying position for this driver (derived from qualifying table)';

-- Create an index for better performance when querying by qualifying position
CREATE INDEX idx_results_qualifying_position ON results(qualifying_position);

-- Optional: Create a function to automatically populate qualifying_position when inserting results
-- This function can be called to sync qualifying positions with race results
CREATE OR REPLACE FUNCTION sync_qualifying_positions(track_id UUID)
RETURNS void AS $$
BEGIN
    -- Update results table with qualifying positions for the specified track
    UPDATE results 
    SET qualifying_position = q.position
    FROM qualifying q
    WHERE results.track = track_id 
      AND results.driver = q.driver 
      AND q.track = track_id;
END;
$$ LANGUAGE plpgsql;

-- Example usage (uncomment to use):
-- SELECT sync_qualifying_positions('your-track-id-here');
