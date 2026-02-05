-- CourseCorrect Seed Data
-- Sample data for development and testing

-- Note: This seed file assumes you have a test user in auth.users
-- In development, create a user first via the Supabase Auth UI or API

-- Sample projects (will need a valid user_id)
-- Uncomment and update user_id after creating a test user

/*
INSERT INTO projects (id, user_id, title, description, goal, target_audience, standards_context, status)
VALUES
  (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'YOUR_USER_ID_HERE',
    'OSHA 10-Hour Construction Safety',
    'Comprehensive construction safety training covering fall protection, scaffolding, and PPE requirements.',
    'regulatory',
    'Construction workers, site supervisors',
    'OSHA 29 CFR 1926',
    'draft'
  ),
  (
    'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    'YOUR_USER_ID_HERE',
    'HIPAA Privacy Fundamentals',
    'Healthcare privacy and security training for medical staff.',
    'full',
    'Healthcare professionals, administrative staff',
    'HIPAA 45 CFR Parts 160, 162, 164',
    'draft'
  ),
  (
    'c3d4e5f6-a7b8-9012-cdef-123456789012',
    'YOUR_USER_ID_HERE',
    'Food Safety Manager Certification',
    'ServSafe-aligned food safety training for restaurant managers.',
    'visual',
    'Food service managers, kitchen supervisors',
    'FDA Food Code 2022, ServSafe',
    'draft'
  );
*/

-- You can also insert sample regulatory updates, analyses, etc. after creating projects
