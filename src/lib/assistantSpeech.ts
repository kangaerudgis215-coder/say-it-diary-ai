/** Shared browser TTS helpers for SO-KI assistant messages. */

export function stopAssistantSpeech(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

function sanitizeForSpeech(text: string): string {
  if (!text) return '';
  let cleaned = text;
  try {
    cleaned = cleaned.replace(/\p{Extended_Pictographic}/gu, '');
    cleaned = cleaned.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u200D]/gu, '');
  } catch {
    cleaned = cleaned.replace(/[\u2600-\u27BF\uFE0F]/g, '');
  }
  return cleaned.replace(/\s{2,}/g, ' ').trim();
}

function pickNaturalEnglishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;
  const en = voices.filter((v) => /^en(-|_|$)/i.test(v.lang));
  if (en.length === 0) return null;

  const preferred = [
    /Google US English/i,
    /Samantha/i,
    /Ava/i,
    /Allison/i,
    /Karen/i,
    /Serena/i,
    /Microsoft (Aria|Jenny|Guy|Davis|Sonia)/i,
    /Natural/i,
    /Neural/i,
    /Premium/i,
    /Enhanced/i,
  ];
  for (const re of preferred) {
    const hit = en.find((v) => re.test(v.name));
    if (hit) return hit;
  }
  return en.find((v) => /en[-_]US/i.test(v.lang)) ?? en[0];
}

export function createAssistantUtterance(text = ''): SpeechSynthesisUtterance | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const utterance = new SpeechSynthesisUtterance(sanitizeForSpeech(text));
  utterance.lang = 'en-US';
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;
  const voice = pickNaturalEnglishVoice();
  if (voice) utterance.voice = voice;
  return utterance;
}

export function speakAssistantImmediately(text: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const clean = sanitizeForSpeech(text);
  const utterance = createAssistantUtterance(clean);
  if (!utterance) return;
  try {
    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(utterance);
  } catch {
    /* Browser may still block if this is not called from a user gesture. */
  }
}

export function speakAssistant(text: string, preparedUtterance?: SpeechSynthesisUtterance | null): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const clean = sanitizeForSpeech(text);
  if (!clean) return;

  const ss = window.speechSynthesis;

  const doSpeak = () => {
    const utterance = preparedUtterance ?? createAssistantUtterance();
    if (!utterance) return;
    try { ss.cancel(); } catch { /* ignore */ }
    utterance.text = clean;
    if (!utterance.voice) {
      const v = pickNaturalEnglishVoice();
      if (v) utterance.voice = v;
    }
    try {
      try { ss.resume(); } catch { /* ignore */ }
      ss.speak(utterance);
      let attempts = 0;
      const tick = () => {
        if (attempts >= 3) return;
        attempts += 1;
        if (!ss.speaking && !ss.pending) {
          try {
            ss.resume();
            ss.speak(utterance);
          } catch { /* ignore */ }
          window.setTimeout(tick, 300);
        }
      };
      window.setTimeout(tick, 250);
    } catch {
      /* Browser may block speech before first user gesture. */
    }
  };

  if (preparedUtterance) {
    doSpeak();
    return;
  }

  const voices = ss.getVoices();
  if (voices && voices.length > 0) {
    doSpeak();
    return;
  }
  let fired = false;
  const onVoices = () => {
    if (fired) return;
    fired = true;
    try { ss.removeEventListener?.('voiceschanged', onVoices); } catch { /* ignore */ }
    doSpeak();
  };
  try { ss.addEventListener?.('voiceschanged', onVoices); } catch { /* ignore */ }
  window.setTimeout(onVoices, 400);
}