import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple word-based similarity calculation
function calculateSimilarity(originalText: string, recallText: string): number {
  if (!recallText || recallText.trim().length === 0) return 0;
  if (!originalText || originalText.trim().length === 0) return 0;

  // Normalize texts: lowercase, remove punctuation, split into words
  const normalize = (text: string) => 
    text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2); // Only words with 3+ chars

  const originalWords = normalize(originalText);
  const recallWords = normalize(recallText);

  if (originalWords.length === 0) return 0;

  // Count matching words (with some fuzzy matching for typos)
  const matchedWords = new Set<string>();
  
  for (const recallWord of recallWords) {
    for (const originalWord of originalWords) {
      // Exact match or substring match (for conjugations, etc.)
      if (recallWord === originalWord || 
          originalWord.includes(recallWord) || 
          recallWord.includes(originalWord)) {
        matchedWords.add(originalWord);
        break;
      }
    }
  }

  // Calculate coverage of original content
  const coverage = matchedWords.size / originalWords.length;
  
  // Also factor in recall length relative to original
  const lengthRatio = Math.min(recallWords.length / originalWords.length, 1.5);
  
  // Weighted score: 70% content coverage, 30% effort (length)
  // Made more generous for the new 3-axis system
  const score = Math.round((coverage * 0.75 + (lengthRatio / 1.5) * 0.25) * 100);
  
  return Math.min(Math.max(score, 0), 100);
}

// Check which expressions the user used
function checkExpressions(recallText: string, expressions: string[]): { used: string[], missed: string[] } {
  if (!recallText || expressions.length === 0) {
    return { used: [], missed: expressions };
  }

  const normalizedRecall = recallText.toLowerCase();
  const used: string[] = [];
  const missed: string[] = [];

  for (const expression of expressions) {
    // Check if the expression (or key words from it) appears in the recall
    const expressionWords = expression.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    
    // Expression is "used" if at least 50% of its significant words appear (more generous)
    const matchedWords = expressionWords.filter(word => normalizedRecall.includes(word));
    const matchRatio = expressionWords.length > 0 ? matchedWords.length / expressionWords.length : 0;
    
    if (matchRatio >= 0.5 || normalizedRecall.includes(expression.toLowerCase())) {
      used.push(expression);
    } else {
      missed.push(expression);
    }
  }

  return { used, missed };
}

// Map score to grade
function mapToGrade(score: number): 'excellent' | 'good' | 'needs_work' {
  if (score >= 85) return 'excellent';
  if (score >= 60) return 'good';
  return 'needs_work';
}

// Calculate three-axis scores
function calculateThreeAxis(
  originalText: string,
  recallText: string,
  baseScore: number
): { meaning: string; structure: string; fluency: string } {
  const originalWords = originalText.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const recallWords = recallText.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  
  // Meaning: based on overall similarity
  const meaningScore = baseScore;
  
  // Structure: based on word count ratio and key structure words
  const wordCountRatio = Math.min(recallWords.length / Math.max(originalWords.length, 1), 1.3);
  const structureBase = baseScore * 0.7 + (wordCountRatio > 0.6 && wordCountRatio < 1.4 ? 30 : 10);
  const structureScore = Math.min(structureBase, 100);
  
  // Fluency: based on common patterns, bonus for natural flow
  const fluencyPenalty = recallText.includes('...') ? 10 : 0;
  const fluencyScore = Math.max(0, baseScore - fluencyPenalty + 5); // Small bonus for completing

  return {
    meaning: mapToGrade(meaningScore),
    structure: mapToGrade(structureScore),
    fluency: mapToGrade(fluencyScore),
  };
}

// Check if passed based on 70% rule
function checkPassed(grades: { meaning: string; structure: string; fluency: string }): boolean {
  const values = [grades.meaning, grades.structure, grades.fluency];
  const goodCount = values.filter(v => v === 'excellent' || v === 'good').length;
  return (goodCount / values.length) >= 0.7;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { originalText, recallText, expressions } = await req.json();

    if (!originalText || !recallText) {
      return new Response(
        JSON.stringify({ error: "Missing originalText or recallText" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const score = calculateSimilarity(originalText, recallText);
    const expressionCheck = checkExpressions(recallText, expressions || []);
    const threeAxis = calculateThreeAxis(originalText, recallText, score);
    const passed = checkPassed(threeAxis);

    // Generate feedback message based on pass/fail and grades
    let feedback: string;
    if (passed) {
      if (threeAxis.meaning === 'excellent' && threeAxis.structure === 'excellent') {
        feedback = "Excellent! You captured the meaning and structure brilliantly. 🌟";
      } else {
        feedback = "Great job! You conveyed the main ideas well. Keep practicing! 💪";
      }
    } else {
      if (threeAxis.meaning === 'needs_work') {
        feedback = "Try to include more of the key ideas. Review the original and try again! 📚";
      } else {
        feedback = "Good effort! Focus on the sentence structure and flow. You're getting there! 🌱";
      }
    }

    return new Response(
      JSON.stringify({
        score,
        feedback,
        usedExpressions: expressionCheck.used,
        missedExpressions: expressionCheck.missed,
        threeAxis,
        passed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Evaluation error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to evaluate recall" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
