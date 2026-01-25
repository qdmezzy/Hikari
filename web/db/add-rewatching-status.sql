-- Add rewatching status to list_status_enum if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'list_status_enum'
    ) THEN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = 'list_status_enum'
              AND e.enumlabel = 'rewatching'
        ) THEN
            ALTER TYPE list_status_enum ADD VALUE 'rewatching';
        END IF;
    END IF;
END
$$;
