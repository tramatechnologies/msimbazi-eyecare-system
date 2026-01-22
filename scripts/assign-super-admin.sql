-- SQL script to assign super_admin role to user
-- Run this directly in Supabase SQL Editor

-- User ID to update
DO $$
DECLARE
    target_user_id UUID := '6ec25daf-c53d-45a4-b322-c02707e8d861';
    target_role app_role := 'super_admin'::app_role;
BEGIN
    -- Check if user_roles table exists and insert/update role
    IF EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = target_user_id
    ) THEN
        -- Update existing role (cast to app_role enum)
        UPDATE user_roles 
        SET 
            role = 'super_admin'::app_role,
            updated_at = NOW()
        WHERE user_id = target_user_id;
        
        RAISE NOTICE 'Updated user role to super_admin for user %', target_user_id;
    ELSE
        -- Insert new role (cast to app_role enum)
        INSERT INTO user_roles (user_id, role, created_at, updated_at)
        VALUES (target_user_id, 'super_admin'::app_role, NOW(), NOW());
        
        RAISE NOTICE 'Assigned super_admin role to user %', target_user_id;
    END IF;
    
    -- Verify the update
    IF EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = target_user_id AND role = 'super_admin'::app_role
    ) THEN
        RAISE NOTICE 'Verification successful: User % now has role super_admin', target_user_id;
    ELSE
        RAISE EXCEPTION 'Verification failed: Role was not assigned correctly';
    END IF;
END $$;

-- Verify the result
SELECT 
    user_id,
    role,
    created_at,
    updated_at
FROM user_roles
WHERE user_id = '6ec25daf-c53d-45a4-b322-c02707e8d861';
