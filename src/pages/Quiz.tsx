import { useSearchParams } from 'react-router-dom';
import { QuizSession } from '@/components/quiz/QuizSession';
import { PendingRecallList } from '@/components/quiz/PendingRecallList';

export default function QuizPage() {
  const [params] = useSearchParams();
  // If a specific diary is requested, run the quiz directly.
  // Otherwise show the list of yet-to-review past diaries so the user
  // can pick which day to recall.
  if (params.get('diaryId')) return <QuizSession />;
  return <PendingRecallList />;
}
