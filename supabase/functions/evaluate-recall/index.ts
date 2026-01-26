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
  const score = Math.round((coverage * 0.7 + (lengthRatio / 1.5) * 0.3) * 100);
  
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
    
    // Expression is "used" if at least 60% of its significant words appear
    const matchedWords = expressionWords.filter(word => normalizedRecall.includes(word));
    const matchRatio = expressionWords.length > 0 ? matchedWords.length / expressionWords.length : 0;
    
    if (matchRatio >= 0.6 || normalizedRecall.includes(expression.toLowerCase())) {
      used.push(expression);
    } else {
      missed.push(expression);
    }
  }

  return { used, missed };
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

    // Generate feedback message based on score
    let feedback: string;
    if (score >= 80) {
      feedback = "Excellent! You recalled most of the diary brilliantly. Your memory is getting stronger! 🌟";
    } else if (score >= 60) {
      feedback = "Great job! You captured the main ideas well. Keep practicing for even more fluency! 💪";
    } else if (score >= 40) {
      feedback = "Good effort! You remembered some key parts. Review the hints and try again to improve. 📚";
    } else {
      feedback = "Nice try! Every attempt strengthens your memory. Use the hints and give it another go! 🌱";
    }

    return new Response(
      JSON.stringify({
        score,
        feedback,
        usedExpressions: expressionCheck.used,
        missedExpressions: expressionCheck.missed,
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
