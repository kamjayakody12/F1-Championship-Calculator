-- Debug script to check why points aren't being updated

-- 1. Check if rules table exists and has data
SELECT 'Rules table:' as check_type, * FROM rules LIMIT 5;

-- 2. Check recent results entries
SELECT 'Recent results:' as check_type, 
       finishing_position, driver, qualified_position, pole, fastestlap, racefinished 
FROM results 
ORDER BY created_at DESC 
LIMIT 10;

-- 3. Check current driver points
SELECT 'Driver points:' as check_type, 
       name, points, team 
FROM drivers 
ORDER BY points DESC 
LIMIT 10;

-- 4. Check current team points  
SELECT 'Team points:' as check_type, 
       name, points 
FROM teams 
ORDER BY points DESC 
LIMIT 10;

-- 5. Check if drivers have team assignments
SELECT 'Drivers without teams:' as check_type, 
       COUNT(*) as count 
FROM drivers 
WHERE team IS NULL;

-- 6. Sample driver-team relationship
SELECT 'Driver-team sample:' as check_type,
       d.name as driver_name, 
       d.points as driver_points,
       t.name as team_name,
       t.points as team_points
FROM drivers d
LEFT JOIN teams t ON d.team = t.id
LIMIT 5;
