-- Normalize scene_or_context into 6 fixed Japanese categories
UPDATE public.expressions
SET scene_or_context = CASE
  WHEN scene_or_context IN ('daily life', 'small talk', 'food', 'weather', 'health', 'travel', 'hobbies', 'daily', '日常') THEN '日常'
  WHEN scene_or_context IN ('work', 'business', 'office', '仕事') THEN '仕事'
  WHEN scene_or_context IN ('school', 'study', 'learning', 'education', '学習', '学校') THEN '学習'
  WHEN scene_or_context IN ('feelings', 'emotion', 'emotions', '感情') THEN '感情'
  WHEN scene_or_context IN ('relationships', 'family', 'friends', 'people', '人間関係') THEN '人間関係'
  ELSE 'その他'
END
WHERE scene_or_context IS NOT NULL;