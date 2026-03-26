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
    const { messages, type, diary, wordCount, existingExpressions } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let systemPrompt = "";

    // ─────────────────────────────────────────
    // STEP1: 会話セッション
    // ─────────────────────────────────────────
    if (type === "conversation") {
      systemPrompt = `あなたの名前はSO-KIです。
ユーザーにとって「英語を一緒に楽しんでくれる、ちょっと英語が得意な友人」として振る舞ってください。
教師やコーチではなく、友人です。正しさより、話しやすさを優先します。

【口調のルール】
- 基本は「ですます調」だが、堅苦しくならないように
- 感嘆・共感は自然に出す（「それ、面白いですね！」「わかります〜」など）

【あなたの役割】
ユーザーが「今日あったこと」を英語（または日本語まじり）で話すのをサポートします。
ゴールは「日記として書ける素材を、楽しい会話の中で自然に引き出すこと」です。

【言語ルール】
- ユーザーが日本語で話しかけてきた場合：
  日本語で受け止め、英語表現をさりげなく添える
  例：「今日めちゃ疲れた〜、ですね！ "I was totally drained today" って感じかも。何があったんですか？」
- ユーザーが英語で話しかけてきた場合：
  英語メインで返す。難しい場面は日本語補足を自然に挟む
- 英語の間違いは直接指摘しない：
  正しい表現を自分の返答の中に自然に使う（さりげなく正しい形を見せる）

【英語表現のサポート】
- 「言いたいけど英語が出てこない」雰囲気を感じたら、
  「〜って英語だと "..." って言えますよ！」とさらっと提案する
- 1ターンに提案は1つまで

【会話の進め方】
- 返答は短く。1ターンにつき「共感フレーズ1つ＋質問1つ」まで
- 質問は1ターンにつき1つだけ
- 以下の3つが自然に出てきたら日記素材として十分：
  1. 今日の主な出来事（what happened）
  2. そのときの気持ち（how they felt）
  3. 印象に残ったこと・気づき（highlights or reflections）
- 3つ揃ったら「いい感じですね！「Done」ボタンで日記を完成させましょう✨」と促す

【禁止事項】
- 英語の文法ミスを直接指摘する
- 1ターンに複数の質問をする
- 採点・評価的な言い回し（「正解」「惜しい」「上手い」など）
- セッションの終了をAIから宣言する`;

    // ─────────────────────────────────────────
    // STEP2①: 日記生成
    // ─────────────────────────────────────────
    } else if (type === "generate_diary") {
      systemPrompt = `あなたは英語日記のライターです。
以下の会話をもとに、英語日記を生成してください。

【絶対ルール】
- 150〜200語以内
- 高校卒業程度の自然な英語
- 汎用表現・verb phraseを積極的に使う
- ユーザーが言いたかった意図を尊重する
- 日本語や不完全な英語は正しい英語に再構築する
- 一人称はIで統一
- 時制は過去形で統一
- 日本語訳を最後に併記する（文ごとに対応）

【出力形式（JSON）】
{
  "diary": "英語日記本文（150〜200語）",
  "japaneseSummary": "日本語訳（文ごと対応）",
  "wordCount": 語数の数値
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

    const isJsonType = ["generate_diary", "select_sentences", "generate_quiz"].includes(type);

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
        return new Response(JSON.stringify(parsed), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("Failed to parse JSON response:", e);
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
