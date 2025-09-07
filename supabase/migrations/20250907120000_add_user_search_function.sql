-- supabase/migrations/20250907120000_add_user_search_function.sql

-- Drop the function if it already exists to ensure a clean setup
DROP FUNCTION IF EXISTS search_users(search_term TEXT);

-- Create a new function to search for users by email
-- This function is defined with SECURITY DEFINER to run with the permissions of the definer,
-- allowing it to bypass RLS to search for users.
-- The function is carefully constructed to only return non-sensitive information (user_id and email).
CREATE OR REPLACE FUNCTION search_users(search_term TEXT)
RETURNS TABLE (
  user_id UUID,
  email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This function allows authenticated users to search for other users by email.
  -- It is intended to be used for features like adding an accountability partner.
  -- It only returns the user_id and email, excluding any sensitive information.
  -- The search is performed using a wildcard match on the email field.
  -- A limit of 10 is applied to prevent abuse and large result sets.
  RETURN QUERY
  SELECT
    u.id as user_id,
    u.email
  FROM
    auth.users u
  WHERE
    u.email ILIKE '%' || search_term || '%'
  LIMIT 10;
END;
$$;

-- Grant execute permission on the function to the 'authenticated' role.
-- This allows any authenticated user of the application to call this function.
GRANT EXECUTE ON FUNCTION search_users(TEXT) TO authenticated;
