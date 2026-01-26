-- Create function to calculate streak based on diary_date (consecutive calendar days)
CREATE OR REPLACE FUNCTION public.calculate_user_streak(p_user_id UUID)
RETURNS TABLE(current_streak INTEGER, longest_streak INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_streak INTEGER := 0;
  v_longest_streak INTEGER := 0;
  v_prev_date DATE := NULL;
  v_temp_streak INTEGER := 0;
  v_today DATE := CURRENT_DATE;
  rec RECORD;
BEGIN
  -- Get all unique diary dates for the user, sorted descending
  FOR rec IN 
    SELECT DISTINCT date as diary_date
    FROM diary_entries
    WHERE user_id = p_user_id
    ORDER BY date DESC
  LOOP
    IF v_prev_date IS NULL THEN
      -- First entry
      -- Check if the most recent diary is today or yesterday (streak is active)
      IF rec.diary_date = v_today OR rec.diary_date = v_today - 1 THEN
        v_temp_streak := 1;
      ELSE
        -- Gap from today, streak is broken but we still count for longest
        v_temp_streak := 1;
        v_current_streak := 0; -- Current streak is 0 since there's a gap
      END IF;
    ELSE
      -- Check if consecutive (previous date - 1 = current date since we're going backwards)
      IF v_prev_date - 1 = rec.diary_date THEN
        v_temp_streak := v_temp_streak + 1;
      ELSE
        -- Gap found, check if this ends the current streak
        IF v_current_streak = 0 AND v_temp_streak > 0 THEN
          -- We already know current streak is broken
          NULL;
        END IF;
        -- Update longest if needed
        IF v_temp_streak > v_longest_streak THEN
          v_longest_streak := v_temp_streak;
        END IF;
        -- Reset temp streak
        v_temp_streak := 1;
      END IF;
    END IF;
    v_prev_date := rec.diary_date;
  END LOOP;
  
  -- Final check for longest streak
  IF v_temp_streak > v_longest_streak THEN
    v_longest_streak := v_temp_streak;
  END IF;
  
  -- Calculate current streak (consecutive days including today or yesterday)
  v_current_streak := 0;
  v_prev_date := NULL;
  
  FOR rec IN 
    SELECT DISTINCT date as diary_date
    FROM diary_entries
    WHERE user_id = p_user_id
    ORDER BY date DESC
  LOOP
    IF v_prev_date IS NULL THEN
      -- Most recent entry must be today or yesterday to have an active streak
      IF rec.diary_date = v_today OR rec.diary_date = v_today - 1 THEN
        v_current_streak := 1;
        v_prev_date := rec.diary_date;
      ELSE
        EXIT; -- No current streak
      END IF;
    ELSE
      IF v_prev_date - 1 = rec.diary_date THEN
        v_current_streak := v_current_streak + 1;
        v_prev_date := rec.diary_date;
      ELSE
        EXIT; -- Streak broken
      END IF;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT v_current_streak, v_longest_streak;
END;
$$;

-- Create function to update profile streak
CREATE OR REPLACE FUNCTION public.update_profile_streak()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current INTEGER;
  v_longest INTEGER;
BEGIN
  -- Calculate new streak values
  SELECT cs.current_streak, cs.longest_streak 
  INTO v_current, v_longest
  FROM public.calculate_user_streak(COALESCE(NEW.user_id, OLD.user_id)) cs;
  
  -- Update profile
  UPDATE profiles
  SET 
    current_streak = v_current,
    longest_streak = GREATEST(longest_streak, v_longest),
    total_diary_entries = (
      SELECT COUNT(*) FROM diary_entries WHERE user_id = COALESCE(NEW.user_id, OLD.user_id)
    ),
    last_diary_date = (
      SELECT MAX(date) FROM diary_entries WHERE user_id = COALESCE(NEW.user_id, OLD.user_id)
    ),
    updated_at = now()
  WHERE user_id = COALESCE(NEW.user_id, OLD.user_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger to update streak on diary entry changes
DROP TRIGGER IF EXISTS update_streak_on_diary_change ON diary_entries;
CREATE TRIGGER update_streak_on_diary_change
AFTER INSERT OR UPDATE OR DELETE ON diary_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_profile_streak();