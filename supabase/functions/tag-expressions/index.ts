import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Get user's token to verify
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || '').auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all expressions for this user that don't have tags
    const { data: expressions, error: fetchError } = await supabase
      .from('expressions')
      .select('id, expression, meaning, example_sentence, scene_or_context, pos_or_type')
      .eq('user_id', user.id)
      .or('scene_or_context.is.null,pos_or_type.is.null,scene_or_context.eq.,pos_or_type.eq.');

    if (fetchError) {
      throw fetchError;
    }

    if (!expressions || expressions.length === 0) {
      return new Response(JSON.stringify({ 
        message: "All expressions are already tagged",
        updated: 0 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Tagging ${expressions.length} expressions for user ${user.id}`);

    // Process expressions in batches to avoid API limits
    const batchSize = 10;
    let updatedCount = 0;

    for (let i = 0; i < expressions.length; i += batchSize) {
      const batch = expressions.slice(i, i + batchSize);
      
      const prompt = `You are an expert at categorizing English expressions for language learners.

For each expression below, assign:
1. scene_or_context: A 1-2 word label for when this expression is typically used.
   Options: "daily life", "small talk", "school", "work", "feelings", "travel", "health", "hobbies", "food", "weather", "relationships", "other"
   
2. pos_or_type: A simple grammatical/phrase type label.
   Options: "verb phrase", "adjective phrase", "noun phrase", "fixed phrase", "adverb phrase", "idiom", "other"

Expressions to classify:
${batch.map((exp, idx) => `${idx + 1}. Expression: "${exp.expression}"
   Meaning: "${exp.meaning || 'N/A'}"
   Example: "${exp.example_sentence || 'N/A'}"`).join('\n\n')}

Respond with a JSON array in this exact format:
[
  {"id": "${batch[0]?.id}", "scene_or_context": "...", "pos_or_type": "..."},
  ...
]

Only return the JSON array, nothing else.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" }
        }),
      });

      if (!response.ok) {
        console.error("AI gateway error:", response.status);
        continue;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      try {
        // Parse the response - handle both array and object with array
        let tags;
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          tags = parsed;
        } else if (parsed.expressions && Array.isArray(parsed.expressions)) {
          tags = parsed.expressions;
        } else if (parsed.results && Array.isArray(parsed.results)) {
          tags = parsed.results;
        } else {
          // Try to find any array in the response
          const firstArray = Object.values(parsed).find(v => Array.isArray(v));
          tags = firstArray || [];
        }

        // Update each expression with its tags
        for (let j = 0; j < batch.length; j++) {
          const exp = batch[j];
          const tag = tags[j] || { scene_or_context: "other", pos_or_type: "other" };

          const { error: updateError } = await supabase
            .from('expressions')
            .update({
              scene_or_context: tag.scene_or_context || "other",
              pos_or_type: tag.pos_or_type || "other"
            })
            .eq('id', exp.id);

          if (!updateError) {
            updatedCount++;
          } else {
            console.error(`Failed to update expression ${exp.id}:`, updateError);
          }
        }
      } catch (parseError) {
        console.error("Failed to parse AI response:", parseError, content);
        // Fallback: tag with "other"
        for (const exp of batch) {
          await supabase
            .from('expressions')
            .update({
              scene_or_context: "other",
              pos_or_type: "other"
            })
            .eq('id', exp.id);
          updatedCount++;
        }
      }
    }

    return new Response(JSON.stringify({ 
      message: `Successfully tagged ${updatedCount} expressions`,
      updated: updatedCount 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("Tag expressions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
