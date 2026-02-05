 // Text comparison utilities with normalization and token-level evaluation
 
 /**
  * Normalize text for comparison:
  * - Lowercase
  * - Replace hyphens with spaces
  * - Collapse multiple spaces
  * - Remove common punctuation
  */
 export function normalizeText(text: string): string {
   return text
     .toLowerCase()
     .replace(/-/g, ' ')       // Replace hyphens with spaces
     .replace(/[.,!?;:'"()]/g, '') // Remove punctuation
     .replace(/\s+/g, ' ')     // Collapse multiple spaces
     .trim();
 }
 
 /**
  * Tokenize text into words after normalization
  */
 export function tokenize(text: string): string[] {
   return normalizeText(text).split(' ').filter(w => w.length > 0);
 }
 
 /**
  * Simple Levenshtein distance for typo tolerance
  */
 export function levenshteinDistance(a: string, b: string): number {
   const matrix: number[][] = [];
   
   for (let i = 0; i <= b.length; i++) {
     matrix[i] = [i];
   }
   
   for (let j = 0; j <= a.length; j++) {
     matrix[0][j] = j;
   }
   
   for (let i = 1; i <= b.length; i++) {
     for (let j = 1; j <= a.length; j++) {
       if (b.charAt(i - 1) === a.charAt(j - 1)) {
         matrix[i][j] = matrix[i - 1][j - 1];
       } else {
         matrix[i][j] = Math.min(
           matrix[i - 1][j - 1] + 1,
           matrix[i][j - 1] + 1,
           matrix[i - 1][j] + 1
         );
       }
     }
   }
   
   return matrix[b.length][a.length];
 }
 
 /**
  * Compare two texts at the token level
  * Returns detailed information about matches, misses, and extras
  */
 export interface TokenComparisonResult {
   userTokens: Array<{ word: string; status: 'correct' | 'incorrect' | 'extra' }>;
   targetTokens: Array<{ word: string; status: 'matched' | 'missing' }>;
   matchedCount: number;
   totalTarget: number;
   accuracy: number; // 0-100
 }
 
 export function compareTokens(userText: string, targetText: string): TokenComparisonResult {
   const userWords = tokenize(userText);
   const targetWords = tokenize(targetText);
   
   // Track which target words have been matched
   const targetMatched = new Set<number>();
   
   // For each user word, find if it matches any target word
   const userTokens = userWords.map(word => {
     // Exact match first
     const exactMatchIndex = targetWords.findIndex((tw, idx) => 
       !targetMatched.has(idx) && tw === word
     );
     
     if (exactMatchIndex !== -1) {
       targetMatched.add(exactMatchIndex);
       return { word, status: 'correct' as const };
     }
     
     // Fuzzy match: partial match or substring
     const partialMatchIndex = targetWords.findIndex((tw, idx) => 
       !targetMatched.has(idx) && (
         tw.includes(word) || 
         word.includes(tw) ||
         // Allow for minor typos (1 char difference for words > 3 chars)
         (word.length > 3 && tw.length > 3 && levenshteinDistance(word, tw) <= 1)
       )
     );
     
     if (partialMatchIndex !== -1) {
       targetMatched.add(partialMatchIndex);
       return { word, status: 'correct' as const }; // Treat as correct for normalized matches
     }
     
     // Check if it's a similar word (incorrect but close)
     const similarIndex = targetWords.findIndex((tw, idx) => 
       !targetMatched.has(idx) && word.length > 2 && tw.length > 2 &&
       levenshteinDistance(word, tw) <= 2
     );
     
     if (similarIndex !== -1) {
       targetMatched.add(similarIndex);
       return { word, status: 'incorrect' as const };
     }
     
     return { word, status: 'extra' as const };
   });
   
   // Mark target words as matched or missing
   const targetTokens = targetWords.map((word, idx) => ({
     word,
     status: targetMatched.has(idx) ? 'matched' as const : 'missing' as const,
   }));
   
   const matchedCount = targetMatched.size;
   const totalTarget = targetWords.length;
   const accuracy = totalTarget > 0 ? Math.round((matchedCount / totalTarget) * 100) : 0;
   
   return {
     userTokens,
     targetTokens,
     matchedCount,
     totalTarget,
     accuracy,
   };
 }
 
 /**
  * Check if all tokens of an expression are present in the user text
  */
 export function checkExpressionPresent(userText: string, expression: string): {
   present: boolean;
   matchedTokens: string[];
   missingTokens: string[];
 } {
   const userTokens = tokenize(userText);
   const exprTokens = tokenize(expression);
   
   const matchedTokens: string[] = [];
   const missingTokens: string[] = [];
   const userTokensCopy = [...userTokens];
   
   for (const exprToken of exprTokens) {
     // Look for exact or close match
     const matchIndex = userTokensCopy.findIndex(ut => 
       ut === exprToken || 
       (ut.length > 3 && exprToken.length > 3 && levenshteinDistance(ut, exprToken) <= 1)
     );
     
     if (matchIndex !== -1) {
       matchedTokens.push(exprToken);
       userTokensCopy.splice(matchIndex, 1); // Remove matched token
     } else {
       missingTokens.push(exprToken);
     }
   }
   
   // Expression is present if at least 70% of tokens are matched
   const present = matchedTokens.length >= exprTokens.length * 0.7;
   
   return { present, matchedTokens, missingTokens };
 }
 
 /**
  * Check if user correctly produced all key expressions
  */
 export function checkKeyExpressions(userText: string, expressions: string[]): {
   allPresent: boolean;
   results: Array<{
     expression: string;
     present: boolean;
     matchedTokens: string[];
     missingTokens: string[];
   }>;
 } {
   if (!expressions || expressions.length === 0) {
     return { allPresent: true, results: [] };
   }
   
   const results = expressions.map(expr => ({
     expression: expr,
     ...checkExpressionPresent(userText, expr),
   }));
   
   const allPresent = results.every(r => r.present);
   
   return { allPresent, results };
 }
 
 /**
  * Check if user text contains the target expression (tolerant matching)
  */
 export function containsExpression(userText: string, targetExpression: string): boolean {
   const userNorm = normalizeText(userText);
   const targetNorm = normalizeText(targetExpression);
   
   // Direct containment
   if (userNorm.includes(targetNorm) || targetNorm.includes(userNorm)) {
     return true;
   }
   
   // Token-level check: if most target tokens are present
   const comparison = compareTokens(userText, targetExpression);
   return comparison.accuracy >= 70;
 }
 
 /**
  * Calculate scores based on token-level comparison
  */
 export function calculateTokenScores(userText: string, targetText: string): {
   meaning: 'excellent' | 'good' | 'needs_work';
   structure: 'excellent' | 'good' | 'needs_work';
   fluency: 'excellent' | 'good' | 'needs_work';
   accuracy: number;
 } {
   const comparison = compareTokens(userText, targetText);
   const accuracy = comparison.accuracy;
   
   // Meaning: based on accuracy
   const meaning = accuracy >= 85 ? 'excellent' : accuracy >= 60 ? 'good' : 'needs_work';
   
   // Structure: based on word order and completeness
   const extraCount = comparison.userTokens.filter(t => t.status === 'extra').length;
   const missingCount = comparison.targetTokens.filter(t => t.status === 'missing').length;
   const structurePenalty = (extraCount + missingCount) * 5;
   const structureScore = Math.max(0, accuracy - structurePenalty);
   const structure = structureScore >= 80 ? 'excellent' : structureScore >= 55 ? 'good' : 'needs_work';
   
   // Fluency: be generous
   const fluency = accuracy >= 70 ? 'excellent' : accuracy >= 40 ? 'good' : 'needs_work';
   
   return { meaning, structure, fluency, accuracy };
 }