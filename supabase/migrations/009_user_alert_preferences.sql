-- Add alert preference columns to profiles table
ALTER TABLE profiles 
ADD COLUMN alert_low_stock BOOLEAN DEFAULT TRUE,
ADD COLUMN alert_overdue_tools BOOLEAN DEFAULT TRUE;
