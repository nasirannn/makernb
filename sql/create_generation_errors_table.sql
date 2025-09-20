-- Create generation_errors table to store error messages for failed generations
-- This table can handle errors for both music generation and lyrics generation

CREATE TABLE IF NOT EXISTS generation_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    error_type VARCHAR(50) NOT NULL CHECK (error_type IN ('music_generation', 'lyrics_generation')),
    reference_id UUID NOT NULL, -- References music_generations.id or lyrics_generations.id
    error_code VARCHAR(100),
    error_message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_generation_errors_type_ref ON generation_errors(error_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_generation_errors_created_at ON generation_errors(created_at);

-- Add comments to document the purpose
COMMENT ON TABLE generation_errors IS 'Stores error messages for failed music and lyrics generations';
COMMENT ON COLUMN generation_errors.error_type IS 'Type of generation that failed: music_generation or lyrics_generation';
COMMENT ON COLUMN generation_errors.reference_id IS 'References the ID of the failed generation record';
COMMENT ON COLUMN generation_errors.error_code IS 'Error code from the API (e.g., API error 400)';
COMMENT ON COLUMN generation_errors.error_message IS 'Human-readable error message (e.g., contains sensitive words)';
