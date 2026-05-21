/** Shared browser TTS helpers for SO-KI assistant messages. */
import { forceReleaseActiveRecognition } from '@/lib/speechRecognition';
import { cancelQueuedSpeech, runSpeechWhenAudioRouteReady, markSpeechStart, markSpeechEnd } from '@/lib/audioSession';

export function stopAssistantSpeech(): void {
  cancelQueuedSpeech();
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
  // Balanced volume — TTS at 1.0 was much louder than effect chimes,
  // forcing users to raise OS volume just for TTS and making chimes
  // tiny. 0.6 puts speech roughly on parity with managed effects.
  utterance.volume = 0.6;
  const voice = pickNaturalEnglishVoice();
  if (voice) utterance.voice = voice;
  const stop = () => markSpeechEnd();
  const prevEnd = utterance.onend;
  const prevErr = utterance.onerror;
  utterance.onend = (e) => { stop(); prevEnd?.call(utterance, e as any); };
  utterance.onerror = (e) => { stop(); prevErr?.call(utterance, e as any); };
  return utterance;
}

export function speakAssistantImmediately(text: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const clean = sanitizeForSpeech(text);
  runSpeechWhenAudioRouteReady(() => {
    const utterance = createAssistantUtterance(clean);
    if (!utterance) return;
    try {
      // CRITICAL: any active SpeechRecognition session holds the system audio
      // route open and can clobber TTS playback (especially over Bluetooth on
      // mobile). Always release the mic before the assistant speaks.
      forceReleaseActiveRecognition();
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
      markSpeechStart();
      window.speechSynthesis.speak(utterance);
    } catch {
      /* Browser may still block if this is not called from a user gesture. */
    }
  });
}

export function speakAssistant(text: string, preparedUtterance?: SpeechSynthesisUtterance | null): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const clean = sanitizeForSpeech(text);
  if (!clean) return;

  const ss = window.speechSynthesis;

  const doSpeak = () => {
    const utterance = preparedUtterance ?? createAssistantUtterance();
    if (!utterance) return;
    // Make sure the mic is fully released before the assistant speaks so
    // TTS audio (and the chime that follows) actually play out loud.
    forceReleaseActiveRecognition();
    try { ss.cancel(); } catch { /* ignore */ }
    utterance.text = clean;
    if (!utterance.voice) {
      const v = pickNaturalEnglishVoice();
      if (v) utterance.voice = v;
    }
    try {
      try { ss.resume(); } catch { /* ignore */ }
      markSpeechStart();
      ss.speak(utterance);
    } catch {
      /* Browser may block speech before first user gesture. */
    }
  };

  const scheduleSpeak = (fn: () => void) => runSpeechWhenAudioRouteReady(fn);

  if (preparedUtterance) {
    scheduleSpeak(doSpeak);
    return;
  }

  const voices = ss.getVoices();
  if (voices && voices.length > 0) {
    scheduleSpeak(doSpeak);
    return;
  }
  let fired = false;
  const onVoices = () => {
    if (fired) return;
    fired = true;
    try { ss.removeEventListener?.('voiceschanged', onVoices); } catch { /* ignore */ }
    scheduleSpeak(doSpeak);
  };
  try { ss.addEventListener?.('voiceschanged', onVoices); } catch { /* ignore */ }
  window.setTimeout(onVoices, 400);
}