import { format, isToday as isTodayFn, parseISO } from 'date-fns';

export function getChatWelcomeMessage(diaryDate: string) {
  const parsedDate = parseISO(diaryDate);
  const isToday = isTodayFn(parsedDate);
  const dateLabel = isToday ? 'today' : format(parsedDate, 'MMMM d, yyyy');

  return {
    content: isToday
      ? "Hi there! 🌙 How was your day today? Tell me about anything that happened - big or small. I'm here to listen and help you express it in English!"
      : `Hi there! 🌙 Let's write about ${dateLabel}. What happened that day? Tell me anything you remember!`,
    japanese: isToday
      ? 'こんばんは！🌙 今日はどんな一日でしたか？大きなことでも小さなことでも、何があったか教えてください。英語で表現するお手伝いをします！'
      : `こんばんは！🌙 ${dateLabel} のことを書きましょう。その日は何がありましたか？覚えていることを何でも教えてください！`,
  };
}