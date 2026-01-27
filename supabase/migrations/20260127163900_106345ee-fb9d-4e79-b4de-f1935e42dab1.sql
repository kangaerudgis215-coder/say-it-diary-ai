-- Create trigger to automatically update profile streak when diary entries change
CREATE TRIGGER trigger_update_streak
AFTER INSERT OR UPDATE OR DELETE ON diary_entries
FOR EACH ROW
EXECUTE FUNCTION update_profile_streak();