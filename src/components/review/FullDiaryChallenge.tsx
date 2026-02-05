/**
 * Full Diary Challenge - User tries to say the entire diary from Japanese prompts
 */
import { useState, useCallback } from 'react';
import { Mic, MicOff, Keyboard, Loader2, ArrowLeft, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useVocabularyLog } from '@/hooks/useVocabularyLog';
import { cn } from '@/lib/utils';
import { ReviewSentence } from './types';

interface FullDiaryChallengeProps {
  sentences: ReviewSentence[];
  japaneseSummary: string;
  onComplete: (userAttempt: string) => void;
  onBack: () => void;
}

export function FullDiaryChallenge({ sentences, japaneseSummary, onComplete, onBack }: FullDiaryChallengeProps) {
  const [showTyping, setShowTyping] = useState(false);
  const [typedInput, setTypedInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { isListening, transcript, interimTranscript, isSupported, startListening, stopListening, resetTranscript } =
    useSpeechRecognition();
  const { logSpokenWords } = useVocabularyLog();

  const currentInput = showTyping ? typedInput : transcript;

  const handleMicClick = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      setTypedInput('');
      startListening();
    }
  }, [isListening, stopListening, resetTranscript, startListening]);

  const handleSubmit = useCallback(() => {
    if (!currentInput) return;
    setIsSubmitting(true);
    logSpokenWords(currentInput);
    onComplete(currentInput);
  }, [currentInput, logSpokenWords, onComplete]);

  return (
    <div className="flex flex-col h-full space-y-4 p-4">
      <div className="text-center">
        <h2 className="font-bold text-lg">🎯 Full Diary Challenge</h2>
        <p className="text-sm text-muted-foreground">Say the entire diary in English from memory</p>
      </div>

      {/* Japanese summary */}
      {japaneseSummary && (
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Japanese Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-japanese">{japaneseSummary}</p>
          </CardContent>
        </Card>
      )}

      {/* Japanese sentences list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Sentences to recall ({sentences.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sentences.map((s, i) => (
            <div key={i} className="py-2 border-b border-border last:border-0">
              <p className="text-sm font-japanese text-muted-foreground">
                {i + 1}. {s.japanese}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Input toggle */}
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setShowTyping(!showTyping)}>
          <Keyboard className="w-4 h-4 mr-1" />
          {showTyping ? 'Use mic' : 'Type'}
        </Button>
      </div>

      {/* Input area */}
      {showTyping ? (
        <Textarea
          value={typedInput}
          onChange={(e) => setTypedInput(e.target.value)}
          placeholder="Type the entire diary in English..."
          className="min-h-32 flex-1"
        />
      ) : (
        <div className="flex flex-col items-center gap-3 flex-1">
          {isSupported ? (
            <>
              <button
                onClick={handleMicClick}
                className={cn(
                  'w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300',
                  isListening ? 'bg-destructive/20 animate-pulse' : 'bg-primary/20 hover:bg-primary/30'
                )}
              >
                {isListening ? <MicOff className="w-8 h-8 text-destructive" /> : <Mic className="w-8 h-8 text-primary" />}
              </button>
              <p className="text-sm text-muted-foreground">{isListening ? 'Tap to stop' : 'Tap and say the whole diary'}</p>
            </>
          ) : (
            <p className="text-sm text-destructive">Speech not supported. Use typing instead.</p>
          )}

          {(transcript || interimTranscript) && (
            <div className="w-full p-4 rounded-lg bg-muted/50 border border-border max-h-48 overflow-y-auto">
              <p className="text-xs text-muted-foreground mb-1">Your response:</p>
              <p className="text-sm leading-relaxed">
                {transcript}
                {interimTranscript && <span className="text-muted-foreground italic"> {interimTranscript}</span>}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-auto flex flex-col gap-2 pt-4">
        <Button variant="glow" size="lg" className="w-full" onClick={handleSubmit} disabled={!currentInput || isSubmitting}>
          {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 mr-2" />}
          Submit & See Results
        </Button>
        <Button variant="ghost" size="sm" className="w-full" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to sentence review
        </Button>
      </div>
    </div>
  );
}
