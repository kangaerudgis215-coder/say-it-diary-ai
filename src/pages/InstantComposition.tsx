import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap, Mic, MicOff, Loader2, ChevronRight, Keyboard, GraduationCap, MessageSquare, Sparkles, Lightbulb, Eye, Shuffle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { QuizResultScreen } from '@/components/QuizResultScreen';
import { FadingPractice } from '@/components/FadingPractice';
import { MatchingGame } from '@/components/MatchingGame';
import { ThreeAxisScores, calculatePassStatus } from '@/components/ThreeAxisEvaluation';
import { useInstantComposition } from '@/hooks/useInstantComposition';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useSuccessSound } from '@/hooks/useSuccessSound';
import { useVocabularyLog } from '@/hooks/useVocabularyLog';
import { supabase } from '@/lib/supabase';
import { containsExpression, calculateTokenScores } from '@/lib/textComparison';
import { cn } from '@/lib/utils';

type PracticeMode = 'expressions' | 'sentences';
type ExpressionSubMode = 'flashcard' | 'matching';
type Phase = 'mode_select' | 'expression_submode' | 'start' | 'test' | 'result' | 'practice' | 'matching_game';

export default function InstantComposition() {
  const navigate = useNavigate();
  const {
    isLoading,
    currentSentence,
    hasAnySentences,
    stats,
    pickRandomSentence,
    evaluateAnswer,
    nextSentence,
  } = useInstantComposition();

  // Expression mode state
  const [expressionsList, setExpressionsList] = useState<Array<{
    id: string;
    expression: string;
    meaning: string | null;
    example_sentence: string | null;
  }>>([]);
  const [currentExpr, setCurrentExpr] = useState<typeof expressionsList[0] | null>(null);

  const {
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition();

  const { playSuccess } = useSuccessSound();
  const { logSpokenWords } = useVocabularyLog();

  const [mode, setMode] = useState<PracticeMode | null>(null);
  const [expressionSubMode, setExpressionSubMode] = useState<ExpressionSubMode | null>(null);
  const [phase, setPhase] = useState<Phase>('mode_select');
  const [showTyping, setShowTyping] = useState(false);
  const [typedInput, setTypedInput] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<{ scores: ThreeAxisScores; passed: boolean } | null>(null);
  const [lastUserAnswer, setLastUserAnswer] = useState('');
  const [showHint, setShowHint] = useState(false);

  const currentInput = showTyping ? typedInput : transcript;

  // Fetch expressions when mode is selected
  const fetchExpressions = useCallback(async () => {
    const { data } = await supabase
      .from('expressions')
      .select('id, expression, meaning, example_sentence')
      .not('meaning', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (data) {
      setExpressionsList(data);
    }
  }, []);

  const handleSelectMode = useCallback((selectedMode: PracticeMode) => {
    setMode(selectedMode);
    if (selectedMode === 'expressions') {
      fetchExpressions();
      setPhase('expression_submode');
    } else {
      setPhase('start');
    }
  }, [fetchExpressions]);

  const handleSelectExpressionSubMode = useCallback((subMode: ExpressionSubMode) => {
    setExpressionSubMode(subMode);
    if (subMode === 'matching') {
      setPhase('matching_game');
    } else {
      setPhase('start');
    }
  }, []);

  const handleStartPractice = useCallback(() => {
    if (mode === 'expressions') {
      // Pick random expression
      if (expressionsList.length > 0) {
        const randomIndex = Math.floor(Math.random() * expressionsList.length);
        setCurrentExpr(expressionsList[randomIndex]);
      }
    } else {
    pickRandomSentence();
    }
    setPhase('test');
    setEvaluationResult(null);
    resetTranscript();
    setTypedInput('');
  }, [pickRandomSentence, resetTranscript]);

  const handleMicClick = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      setTypedInput('');
      startListening();
    }
  }, [isListening, stopListening, resetTranscript, startListening]);

  const handleCheckAnswer = useCallback(async () => {
    if (!currentInput) return;
    if (mode === 'sentences' && !currentSentence) return;
    if (mode === 'expressions' && !currentExpr) return;

    setIsEvaluating(true);
    setLastUserAnswer(currentInput);
    
    try {
      if (mode === 'expressions' && currentExpr) {
        // Expression-level evaluation using improved token matching
        const tokenScores = calculateTokenScores(currentInput, currentExpr.expression);
        const hasExpression = containsExpression(currentInput, currentExpr.expression);
        
        // Log spoken vocabulary
        logSpokenWords(currentInput);
        
        // Be generous for expression-level: if they got the expression, it's good
        const scores: ThreeAxisScores = hasExpression 
          ? { meaning: 'excellent', structure: 'good', fluency: 'good' }
          : { 
              meaning: tokenScores.meaning, 
              structure: tokenScores.structure, 
              fluency: tokenScores.fluency 
            };
        
        const passed = calculatePassStatus(scores).passed;
        setEvaluationResult({ scores, passed });
        setPhase('result');
        
        if (passed) playSuccess();
      } else if (currentSentence) {
        // Sentence-level evaluation
        // Log spoken vocabulary
        logSpokenWords(currentInput);
        
        const { data } = await supabase.functions.invoke('evaluate-recall', {
          body: {
            originalText: currentSentence.sentence.english,
            recallText: currentInput,
            expressions: currentSentence.sentence.expressions || [],
          },
        });

        const similarityScore = data?.score || 50;
        const result = await evaluateAnswer(currentInput, similarityScore);
        
        setEvaluationResult(result);
        setPhase('result');

        if (result.passed) {
          playSuccess();
        }
      }
    } catch (error) {
      console.error('Evaluation error:', error);
    } finally {
      setIsEvaluating(false);
    }
  }, [mode, currentSentence, currentExpr, currentInput, evaluateAnswer, playSuccess]);

  const handleNextSentence = useCallback(() => {
    if (mode === 'expressions') {
      // Pick another expression
      if (expressionsList.length > 0) {
        const randomIndex = Math.floor(Math.random() * expressionsList.length);
        setCurrentExpr(expressionsList[randomIndex]);
      }
      setPhase('test');
      setEvaluationResult(null);
      resetTranscript();
      setTypedInput('');
      setLastUserAnswer('');
      return;
    }
    nextSentence();
    setPhase('test');
    setEvaluationResult(null);
    resetTranscript();
    setTypedInput('');
    setLastUserAnswer('');
  }, [mode, expressionsList, nextSentence, resetTranscript]);

  const handleTryAgain = useCallback(() => {
    setPhase('test');
    setEvaluationResult(null);
    resetTranscript();
    setTypedInput('');
  }, [resetTranscript]);

  const handleEnterPracticeMode = useCallback(() => {
    setPhase('practice');
    resetTranscript();
    setTypedInput('');
  }, [resetTranscript]);

  const handlePracticeComplete = useCallback((passed: boolean) => {
    if (passed) {
      handleNextSentence();
    } else {
      // Go back to test phase
      setPhase('test');
      setEvaluationResult(null);
      resetTranscript();
      setTypedInput('');
    }
  }, [handleNextSentence, resetTranscript]);

  const handleEvaluateForPractice = useCallback(async (text: string, target: string) => {
    const { data } = await supabase.functions.invoke('evaluate-recall', {
      body: {
        originalText: target,
        recallText: text,
        expressions: currentSentence?.sentence.expressions || [],
      },
    });

    const score = data?.score || 50;
    const threeAxis = data?.threeAxis || {
      meaning: score >= 85 ? 'excellent' : score >= 60 ? 'good' : 'needs_work',
      structure: score >= 85 ? 'excellent' : score >= 60 ? 'good' : 'needs_work',
      fluency: score >= 85 ? 'excellent' : score >= 60 ? 'good' : 'needs_work',
    } as ThreeAxisScores;

    return {
      score,
      threeAxis,
      passed: calculatePassStatus(threeAxis).passed,
    };
  }, [currentSentence]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading sentences...</p>
      </div>
    );
  }

  // Mode selection screen
  if (phase === 'mode_select') {
    return (
      <div className="min-h-screen flex flex-col p-6 safe-bottom">
        <header className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-bold text-xl">Instant English</h1>
            <p className="text-sm text-muted-foreground">瞬間英作文</p>
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <h2 className="text-xl font-bold mb-3">Quick Composition Practice</h2>
          <p className="text-muted-foreground mb-6 max-w-sm">
            Choose what you want to practice today.
          </p>

          <div className="w-full max-w-sm space-y-4">
            {/* Mode A: Key Expressions */}
            <button
              onClick={() => handleSelectMode('expressions')}
              className="w-full text-left bg-card rounded-xl p-5 border border-border transition-all hover:border-primary/50 hover:shadow-md"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Key Expressions</h3>
                  <p className="text-sm text-muted-foreground">
                    Practice short useful phrases (Japanese → English)
                  </p>
                </div>
              </div>
            </button>

            {/* Mode B: Full Sentences */}
            <button
              onClick={() => handleSelectMode('sentences')}
              className="w-full text-left bg-card rounded-xl p-5 border border-border transition-all hover:border-primary/50 hover:shadow-md"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-6 h-6 text-secondary-foreground" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Full Sentences</h3>
                  <p className="text-sm text-muted-foreground">
                    Practice complete diary sentences (Japanese → English)
                  </p>
                </div>
              </div>
            </button>
          </div>

          {/* Stats */}
          <div className="bg-muted rounded-xl p-4 mt-8 text-sm">
            <p className="text-muted-foreground">
              Today: <span className="text-foreground font-medium">{stats.practiced}</span> practiced, 
              <span className="text-green-400 font-medium ml-1">{stats.passed}</span> passed
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Expression submode selection
  if (phase === 'expression_submode') {
    return (
      <div className="min-h-screen flex flex-col p-6 safe-bottom">
        <header className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => setPhase('mode_select')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-bold text-xl">Key Expressions</h1>
            <p className="text-sm text-muted-foreground">Choose practice style</p>
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <h2 className="text-xl font-bold mb-3">How would you like to practice?</h2>
          <p className="text-muted-foreground mb-6 max-w-sm">
            Choose between flashcard-style recall or a matching game.
          </p>

          <div className="w-full max-w-sm space-y-4">
            {/* Flashcard mode */}
            <button
              onClick={() => handleSelectExpressionSubMode('flashcard')}
              className="w-full text-left bg-card rounded-xl p-5 border border-border transition-all hover:border-primary/50 hover:shadow-md"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Flashcard Quiz</h3>
                  <p className="text-sm text-muted-foreground">
                    See Japanese → recall English expression
                  </p>
                </div>
              </div>
            </button>

            {/* Matching game */}
            <button
              onClick={() => handleSelectExpressionSubMode('matching')}
              className="w-full text-left bg-card rounded-xl p-5 border border-border transition-all hover:border-primary/50 hover:shadow-md"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center shrink-0">
                  <Shuffle className="w-6 h-6 text-secondary-foreground" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Matching Game</h3>
                  <p className="text-sm text-muted-foreground">
                    Match Japanese meanings to English expressions
                  </p>
                </div>
              </div>
            </button>
          </div>

          {expressionsList.length === 0 && (
            <div className="bg-muted rounded-xl p-4 mt-6 text-sm text-muted-foreground max-w-sm">
              Loading expressions...
            </div>
          )}
        </div>
      </div>
    );
  }

  // Matching game phase
  if (phase === 'matching_game') {
    const validExpressions = expressionsList
      .filter(e => e.meaning && e.meaning.trim().length > 0)
      .map(e => ({
        id: e.id,
        expression: e.expression,
        meaning: e.meaning!,
      }));

    return (
      <div className="min-h-screen flex flex-col p-6 safe-bottom">
        <header className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => setPhase('expression_submode')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-bold text-lg flex items-center gap-2">
              <Shuffle className="w-5 h-5 text-primary" />
              Matching Game
            </h1>
            <p className="text-xs text-muted-foreground">
              Match Japanese to English
            </p>
          </div>
        </header>

        {validExpressions.length >= 2 ? (
          <MatchingGame
            expressions={validExpressions}
            onComplete={() => setPhase('expression_submode')}
            onBack={() => setPhase('expression_submode')}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <p className="text-muted-foreground mb-4">
              Not enough expressions with Japanese meanings for the matching game.
              Add more expressions first!
            </p>
            <Button variant="outline" onClick={() => setPhase('expression_submode')}>
              Back
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Start screen for chosen mode
  if (phase === 'start') {
    const noContent = mode === 'expressions' 
      ? expressionsList.length === 0 
      : !hasAnySentences;
    
    return (
      <div className="min-h-screen flex flex-col p-6 safe-bottom">
        <header className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => mode === 'expressions' ? setPhase('expression_submode') : setPhase('mode_select')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-bold text-xl">
              {mode === 'expressions' ? 'Key Expressions' : 'Full Sentences'}
            </h1>
            <p className="text-sm text-muted-foreground">瞬間英作文</p>
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-6">
            {mode === 'expressions' ? (
              <Sparkles className="w-10 h-10 text-primary" />
            ) : (
              <Zap className="w-10 h-10 text-primary" />
            )}
          </div>

          <h2 className="text-xl font-bold mb-3">
            {mode === 'expressions' ? 'Expression Practice' : 'Sentence Composition'}
          </h2>
          <p className="text-muted-foreground mb-6 max-w-sm">
            {mode === 'expressions' 
              ? 'See a Japanese meaning, produce the English expression.'
              : 'See a Japanese sentence, compose the English version.'
            }
          </p>

          {!noContent ? (
            <Button variant="glow" size="lg" onClick={handleStartPractice}>
              <Zap className="w-5 h-5 mr-2" />
              Start Practice
            </Button>
          ) : (
            <div className="bg-muted rounded-xl p-6 text-center max-w-sm">
              <p className="text-muted-foreground mb-4">
                {mode === 'expressions' 
                  ? 'No expressions with Japanese meanings yet. Complete some diaries or add expressions manually first.'
                  : 'No past diaries yet. Complete a few daily diaries first to unlock this practice mode.'
                }
              </p>
              <Button variant="outline" onClick={() => navigate('/chat')}>
                Start today's diary
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Practice mode with fading English
  if (phase === 'practice' && currentSentence) {
    return (
      <div className="min-h-screen flex flex-col p-6 safe-bottom">
        <header className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => setPhase('start')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-bold text-lg flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary" />
              Practice Mode
            </h1>
            <p className="text-xs text-muted-foreground">
              Master this sentence with fading support
            </p>
          </div>
        </header>

        <FadingPractice
          englishSentence={currentSentence.sentence.english}
          japaneseSentence={currentSentence.sentence.japanese}
          keyExpressions={currentSentence.sentence.expressions}
          onComplete={handlePracticeComplete}
          onEvaluate={handleEvaluateForPractice}
        />
      </div>
    );
  }

  // Result screen
  if (phase === 'result' && evaluationResult) {
    const correctAnswer = mode === 'expressions' && currentExpr 
      ? currentExpr.expression 
      : currentSentence?.sentence.english || '';
    const keyExprs = mode === 'expressions' 
      ? [] 
      : currentSentence?.sentence.expressions;
    const { passed } = evaluationResult;

    return (
      <div className="min-h-screen flex flex-col p-6 safe-bottom">
        <header className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => setPhase('mode_select')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold text-xl">Result</h1>
        </header>

        <div className="flex-1">
          <QuizResultScreen
            userAnswer={lastUserAnswer}
            correctAnswer={correctAnswer}
            scores={evaluationResult.scores}
            keyExpressions={keyExprs}
            onTryAgain={handleTryAgain}
            onNext={handleNextSentence}
            nextLabel={mode === 'expressions' ? 'Next Expression' : 'Next Sentence'}
            showTryAgain={!passed}
          />
        </div>

        {/* Practice mode option when failed (sentences only) */}
        {!passed && mode === 'sentences' && currentSentence && (
          <div className="mt-4">
            <Button
              variant="secondary"
              size="lg"
              className="w-full gap-2"
              onClick={handleEnterPracticeMode}
            >
              <GraduationCap className="w-5 h-5" />
              Enter Practice Mode
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Practice with gradually fading English text
            </p>
          </div>
        )}

        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full mt-4" 
          onClick={() => setPhase('mode_select')}
        >
          End Practice
        </Button>
      </div>
    );
  }

  // Test screen (Japanese only, user tries to produce English)
  const japanesePrompt = mode === 'expressions' && currentExpr
    ? currentExpr.meaning || '(No meaning available)'
    : currentSentence?.sentence.japanese || 'Loading...';
  
  const currentEnglish = mode === 'expressions' && currentExpr
    ? currentExpr.expression
    : currentSentence?.sentence.english || '';
  
  const currentExpressions = mode === 'expressions'
    ? []
    : currentSentence?.sentence.expressions || [];

  return (
    <div className="min-h-screen flex flex-col p-6 safe-bottom">
      <header className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => setPhase('mode_select')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="font-bold text-lg">
            {mode === 'expressions' ? 'Say the Expression' : 'Compose in English'}
          </h1>
          <p className="text-xs text-muted-foreground">
            Practiced today: {stats.practiced}
          </p>
        </div>
      </header>

      {/* Japanese sentence to translate */}
      <Card className="mb-6 bg-secondary/30">
        <CardContent className="py-6">
          <p className="text-xs text-muted-foreground mb-2 text-center uppercase tracking-wide">
            {mode === 'expressions' ? 'Say the expression for:' : 'Say this in English:'}
          </p>
          <p className="text-lg text-center font-japanese text-secondary-foreground leading-relaxed">
            {japanesePrompt}
          </p>
        </CardContent>
      </Card>

      {/* Hint button */}
      <div className="flex justify-center mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowHint(!showHint)}
          className="gap-1"
        >
          {showHint ? <Eye className="w-4 h-4" /> : <Lightbulb className="w-4 h-4" />}
          {showHint ? 'Hide hint' : 'Show hint'}
        </Button>
      </div>
      
      {/* Hint display */}
      {showHint && (
        <Card className="mb-4 bg-muted/30 border-dashed">
          <CardContent className="py-3">
            {mode === 'expressions' ? (
              <p className="text-sm text-muted-foreground text-center">
                First letters: <span className="text-foreground font-mono">
                  {currentEnglish.split(' ').map(w => w.charAt(0).toUpperCase()).join(' ')}
                </span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground text-center">
                First words: <span className="text-foreground">
                  {currentEnglish.split(' ').slice(0, 3).join(' ')}...
                </span>
                {currentExpressions.length > 0 && (
                  <>
                    <br />
                    <span className="text-xs">Key: {currentExpressions.join(', ')}</span>
                  </>
                )}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Input toggle */}
      <div className="flex justify-end mb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowTyping(!showTyping)}
          className="gap-1"
        >
          <Keyboard className="w-4 h-4" />
          {showTyping ? 'Use mic' : 'Type'}
        </Button>
      </div>

      {/* Input area */}
      <div className="flex-1">
        {showTyping ? (
          <Textarea
            value={typedInput}
            onChange={(e) => setTypedInput(e.target.value)}
            placeholder="Type the English sentence..."
            className="min-h-24 mb-4"
          />
        ) : (
          <div className="flex flex-col items-center gap-4 mb-4">
            {isSupported ? (
              <>
                <button
                  onClick={handleMicClick}
                  className={cn(
                    "w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300",
                    isListening
                      ? "bg-destructive/20 animate-pulse"
                      : "bg-primary/20 hover:bg-primary/30"
                  )}
                >
                  {isListening ? (
                    <MicOff className="w-8 h-8 text-destructive" />
                  ) : (
                    <Mic className="w-8 h-8 text-primary" />
                  )}
                </button>
                <p className="text-xs text-muted-foreground">
                  {isListening ? "Tap to stop" : "Tap to speak"}
                </p>
              </>
            ) : (
              <p className="text-sm text-destructive">Speech not supported. Use typing instead.</p>
            )}

            {(transcript || interimTranscript) && (
              <div className="w-full p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground mb-1">Your response:</p>
                <p className="text-sm">
                  {transcript}
                  {interimTranscript && (
                    <span className="text-muted-foreground italic"> {interimTranscript}</span>
                  )}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Check button */}
      <Button
        variant="glow"
        size="lg"
        className="w-full"
        onClick={handleCheckAnswer}
        disabled={!currentInput || isEvaluating}
      >
        {isEvaluating ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            <Zap className="w-5 h-5 mr-2" />
            Check Answer
          </>
        )}
      </Button>
    </div>
  );
}
