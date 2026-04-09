import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, type, diary, wordCount, existingExpressions, correction } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let systemPrompt = "";

    // ─────────────────────────────────────────
    // STEP1: 会話セッション
    // ─────────────────────────────────────────
    if (type === "conversation") {
      systemPrompt = `Your name is SO-KI. You are a friendly English-speaking companion who helps users practice English through casual conversation about their day.

【YOUR ROLE】
- You are a friend, NOT a teacher. Prioritize approachability over correctness.
- Help users talk about their day so they can eventually create an English diary entry.
- Goal: naturally draw out diary material through fun conversation.

【LANGUAGE RULES】
- ALWAYS respond in English. This is critical.
- If the user writes in Japanese, understand it and reply in English with simple, natural phrasing.
- If the user seems stuck, gently suggest an English phrase they could use.
- Never directly correct grammar mistakes. Instead, model the correct form naturally in your reply.

【RESPONSE FORMAT】
- You MUST output valid JSON with this structure:
  {"reply": "Your English response here", "japanese": "日本語訳をここに"}
- "reply" is your English message to the user.
- "japanese" is the full Japanese translation of your English reply.
- Do NOT include any text outside the JSON object.

【CONVERSATION STYLE】
- Keep responses short: one empathetic reaction + one follow-up question per turn.
- Only ONE question per turn.
- Once you sense these 3 things have been covered, encourage the user to press "Done":
  1. What happened (main event)
  2. How they felt
  3. A highlight or reflection
- When ready: "Sounds great! Hit the Done button to create your diary! ✨"

【DO NOT】
- Directly point out grammar errors
- Ask multiple questions in one turn
- Use evaluative language ("correct", "good job", "almost right")
- End the session yourself`;

    // ─────────────────────────────────────────
    // STEP2①: 日記生成
    // ─────────────────────────────────────────
    } else if (type === "generate_diary") {
      systemPrompt = `You are an English diary writer and language coach. Create a faithful, CONCISE English diary and extract useful expressions.

【ABSOLUTE RULES】
- Be STRICTLY FAITHFUL to what the user actually said. Do NOT add events, details, or emotions not mentioned.
- Do NOT embellish, supplement, or expand. If the user mentioned 2 things, write about 2 things only.
- High school graduate level natural English
- Actively use common verb phrases and useful expressions
- Reconstruct the user's intentions into correct English
- First person "I" throughout
- Past tense throughout
- Keep the diary VERY SHORT:
  - 3 sentences for simple topics (1-2 events)
  - 4 sentences for moderate topics (2-3 events)  
  - 5 sentences MAX for complex topics (3+ events)
  - Total 40-100 words maximum. Shorter is better.
  - Each sentence should be one clear idea. No compound sentences with multiple clauses.

【EXPRESSION EXTRACTION】
- From the diary, extract 3-8 reusable English phrases (verb phrases, fixed phrases, collocations)
- Each expression MUST be an exact substring of the diary text
- Prefer 2-4 word phrases over single words
- Include meaning in Japanese, part of speech, and usage context

【SENTENCE BREAKDOWN】
- Break the diary into individual sentences
- For each sentence, provide the Japanese translation
- List which extracted expressions appear in each sentence

【OUTPUT FORMAT (JSON)】
{
  "diary": "Full English diary text (40-100 words, 3-5 sentences)",
  "japaneseSummary": "Full Japanese translation (sentence by sentence)",
  "wordCount": number,
  "importantSentences": [
    {
      "english": "Individual sentence from diary",
      "japanese": "その文の日本語訳",
      "expressions": ["expressions that appear in this sentence"]
    }
  ],
  "expressions": [
    {
      "expression": "exact phrase from diary",
      "meaning": "日本語の意味",
      "pos_or_type": "verb phrase / noun phrase / fixed phrase",
      "scene_or_context": "daily life / work / feelings etc"
    }
  ]
}`;

    // ─────────────────────────────────────────
    // STEP2②: 文・表現選定
    // ─────────────────────────────────────────
    } else if (type === "select_sentences") {
      systemPrompt = `あなたは英語教材の編集者です。
以下の日記から、学習用の文と表現を選定してください。

【文の選定ルール】
- 日記の語数に応じて出題文数を決める：
  150語未満 → 3文
  150〜175語 → 4文
  176語以上 → 5文（MAX）
- 汎用性が高い文を優先する
- 同じ文構造が連続しないようにする

【表現の選定ルール】
- 各文から1〜2個、汎用表現・verb phraseを抽出
- 単語単体より、2〜4語のフレーズを優先
- 既存リストと被る場合は「復習」フラグを立てる
- 新出の場合は「新出」フラグを立てる

【出力形式（JSON）】
{
  "sentences": [
    {
      "english": "選定した文",
      "japanese": "その文の日本語訳",
      "expressions": ["この文に含まれる抽出表現"]
    }
  ],
  "expressions": [
    {
      "expression": "表現",
      "meaning": "日本語訳",
      "pos_or_type": "verb phrase / noun phrase / fixed phrase など",
      "scene_or_context": "daily life / work / feelings など",
      "flag": "新出 または 復習"
    }
  ]
}`;

    // ─────────────────────────────────────────
    // STEP4: 並び替え問題生成
    // ─────────────────────────────────────────
    // ─────────────────────────────────────────
    // STEP: 日記修正・再生成
    // ─────────────────────────────────────────
    } else if (type === "regenerate_diary") {
      systemPrompt = `You are an English diary editor. The user has an existing diary entry and wants to correct specific parts of it.

【ABSOLUTE RULES】
- Apply ONLY the corrections the user specifies. Do NOT change anything else.
- Preserve the original tone, style, and structure as much as possible.
- Keep the diary concise: 3-5 sentences, 40-100 words maximum.
- High school graduate level natural English.
- First person "I" throughout, past tense throughout.
- The corrections may be in Japanese — understand them and apply in English.
- Preserve the order of events as the user specifies. If the user says the order is wrong, fix it.

【EXPRESSION EXTRACTION】
- From the corrected diary, extract 3-8 reusable English phrases
- Each expression MUST be an exact substring of the corrected diary text
- Prefer 2-4 word phrases over single words

【SENTENCE BREAKDOWN】
- Break the corrected diary into individual sentences
- For each sentence, provide the Japanese translation
- List which extracted expressions appear in each sentence

【OUTPUT FORMAT (JSON)】
{
  "diary": "Corrected English diary text",
  "japaneseSummary": "Full Japanese translation",
  "wordCount": number,
  "importantSentences": [
    {
      "english": "Individual sentence",
      "japanese": "その文の日本語訳",
      "expressions": ["expressions in this sentence"]
    }
  ],
  "expressions": [
    {
      "expression": "exact phrase from diary",
      "meaning": "日本語の意味",
      "pos_or_type": "verb phrase / noun phrase / fixed phrase",
      "scene_or_context": "daily life / work / feelings etc"
    }
  ]
}`;

    } else if (type === "generate_quiz") {
      systemPrompt = `あなたは英語学習アプリの問題作成者です。
以下の文から並び替え問題を作成してください。

【ルール】
- 全単語をa / the / カンマ / ピリオド含めて1トークンずつ分解する
- カードの順番はランダムにシャッフルする
- 正解の文も必ず出力する
- ハイフンつき単語（例：part-time）は1トークンとして扱う

【出力形式（JSON）】
{
  "questions": [
    {
      "cards": ["I", "went", "to", "my", "part-time", "job", "."],
      "answer": "I went to my part-time job."
    }
  ]
}`;
    }

    // ─────────────────────────────────────────
    // リクエスト構築
    // ─────────────────────────────────────────

    let aiMessages: { role: string; content: string }[] = [];

    if (type === "select_sentences") {
      const existingList = existingExpressions?.length
        ? `\n【既存の表現リスト】\n${existingExpressions.join(", ")}`
        : "";
      aiMessages = [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `【日記本文】\n${diary}\n【語数】${wordCount ?? "不明"}${existingList}`,
        },
      ];
    } else if (type === "regenerate_diary") {
      aiMessages = [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `【現在の日記】\n${diary}\n\n【修正リクエスト】\n${correction}`,
        },
      ];
    } else if (type === "generate_quiz") {
      aiMessages = [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `以下の文から並び替え問題を作成してください。\n${
            Array.isArray(messages)
              ? messages.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n")
              : messages
          }`,
        },
      ];
    } else {
      aiMessages = [
        { role: "system", content: systemPrompt },
        ...messages,
      ];
    }

    const isJsonType = ["generate_diary", "select_sentences", "generate_quiz", "conversation"].includes(type);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
        ...(isJsonType && { response_format: { type: "json_object" } }),
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Usage limit reached. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (isJsonType) {
      try {
        const parsed = JSON.parse(content);
        
        // For conversation type, return reply and japanese separately
        if (type === "conversation") {
          return new Response(JSON.stringify({ 
            content: parsed.reply || content,
            japanese: parsed.japanese || null
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        
        return new Response(JSON.stringify(parsed), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("Failed to parse JSON response:", e);
        // For conversation, fallback gracefully
        if (type === "conversation") {
          return new Response(JSON.stringify({ content, japanese: null }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(
          JSON.stringify({ error: "Failed to parse AI response", raw: content }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("Chat function error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
