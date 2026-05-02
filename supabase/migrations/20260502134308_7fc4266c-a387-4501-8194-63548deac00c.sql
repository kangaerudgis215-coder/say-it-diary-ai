REVOKE EXECUTE ON FUNCTION public.calculate_user_streak(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_profile_streak() FROM PUBLIC, anon, authenticated;