/** MediaRecorder wrapper for short voice input. Returns base64 + mimeType. */
export class VoiceRecorder {
  private stream: MediaStream | null = null;
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private mime = "audio/webm";

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
    this.mime = candidates.find((m) => (window as any).MediaRecorder?.isTypeSupported?.(m)) || "audio/webm";
    this.rec = new MediaRecorder(this.stream, { mimeType: this.mime });
    this.chunks = [];
    this.rec.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data); };
    this.rec.start();
  }

  async stop(): Promise<{ base64: string; mimeType: string }> {
    return new Promise((resolve, reject) => {
      if (!this.rec) return reject(new Error("not recording"));
      this.rec.onstop = async () => {
        try {
          const blob = new Blob(this.chunks, { type: this.mime });
          const arr = await blob.arrayBuffer();
          const bytes = new Uint8Array(arr);
          let bin = "";
          const chunk = 0x8000;
          for (let i = 0; i < bytes.length; i += chunk) {
            bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
          }
          const base64 = btoa(bin);
          this.cleanup();
          resolve({ base64, mimeType: this.mime });
        } catch (e) { reject(e); }
      };
      this.rec.stop();
    });
  }

  cancel() { this.cleanup(); }

  private cleanup() {
    try { this.stream?.getTracks().forEach((t) => t.stop()); } catch {}
    this.stream = null;
    this.rec = null;
    this.chunks = [];
  }
}

export async function transcribeAudio(base64: string, mimeType: string, language?: string): Promise<string> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ audio: base64, mimeType, language }),
  });
  if (!resp.ok) throw new Error(`transcribe failed: ${resp.status}`);
  const j = await resp.json();
  return j.text || "";
}

let audioEl: HTMLAudioElement | null = null;

export async function speak(text: string): Promise<void> {
  if (!text.trim()) return;
  try {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tts`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ text }),
    });
    if (!resp.ok) return;
    const blob = await resp.blob();
    const objUrl = URL.createObjectURL(blob);
    if (audioEl) { try { audioEl.pause(); } catch {} }
    audioEl = new Audio(objUrl);
    audioEl.play().catch(() => {});
  } catch (e) {
    console.error("TTS failed", e);
  }
}

export function stopSpeaking() {
  try { audioEl?.pause(); } catch {}
}