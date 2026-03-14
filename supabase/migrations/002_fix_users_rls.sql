-- Fix: Allow users to SELECT their own row by auth.uid()
-- This breaks the circular dependency where get_user_tenant_id() queries the users table
-- but the users table RLS policy requires get_user_tenant_id() to return a value first.

CREATE POLICY "users_select_own" ON users
  FOR SELECT
  USING (id = auth.uid());
