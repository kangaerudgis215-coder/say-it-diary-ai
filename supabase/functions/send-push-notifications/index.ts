// SO-KI nightly push notifications.
// Triggered by pg_cron daily at 12:00 UTC (= 21:00 JST).
// For each enabled push subscription, generates a SO-KI flavored message
// using the user's recent diaries (via Lovable AI) and sends a Web Push.

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

interface SubRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface DiaryRow {
  content: string;
  date: string;
}

interface ProfileRow {
  display_name: string | null;
}

const FALLBACK_MESSAGES = [
  'コンコンにゃ。今日はどんな一日だったにゃ？少しだけ話してにゃ〜',
  'やぁにゃ〜。今日のこと、ちょっとだけ聞かせてにゃ。',
  'おつかれにゃ〜。今日あったこと、一言でいいから話してにゃ。',
  '夜だにゃ〜。寝る前に今日のこと聞かせてにゃ？',
];

function pickFallback(): string {
  return FALLBACK_MESSAGES[Math.floor(Math.random() * FALLBACK_MESSAGES.length)];
}

async function generateSokiLine(
  diaries: DiaryRow[],
  displayName: string | null,
): Promise<string> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey || diaries.length === 0) return pickFallback();

  const sample = diaries.slice(0, 3).map((d) => `(${d.date}) ${d.content}`).join('\n');
  const namePart = displayName ? `相手の名前は「${displayName}」。` : '';
  const prompt = `あなたは猫のキャラ「SO-KI」。${namePart}
ユーザーの過去の英語日記を踏まえて、毎晩21時のリマインダー通知メッセージを1つだけ日本語で作って。

# ルール
- 1〜2文、最大60文字
- 「コンコンにゃ」または「やぁにゃ」で始める
- 日記の内容に軽く触れる（具体的に書きすぎない、ふんわりと）
- 最後は「今日のことも聞かせてにゃ」のような今日への誘いで締める
- 語尾は「にゃ」「にゃ〜」を自然に使う
- 絵文字は使わない
- 余計な前置き・解説・引用符なし。本文のみ返す

# 過去の日記
${sample}`;

  try {
    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      console.error('AI gateway error', res.status, await res.text());
      return pickFallback();
    }
    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content?.trim() ?? '';
    const cleaned = text.replace(/^["「『]|["」』]$/g, '').trim();
    if (!cleaned || cleaned.length > 100) return pickFallback();
    return cleaned;
  } catch (e) {
    console.error('AI generation failed', e);
    return pickFallback();
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  // Normalize defensively — saved secrets sometimes pick up whitespace,
  // quotes, padding, or standard-base64 chars (+/) that need URL-safe form.
  const normalizeB64 = (raw: string) =>
    raw
      .replace(/\s+/g, '') // strip ALL whitespace (including newlines)
      .replace(/^["']|["']$/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  const vapidPublic = normalizeB64(Deno.env.get('VAPID_PUBLIC_KEY') ?? '');
  const vapidPrivate = normalizeB64(Deno.env.get('VAPID_PRIVATE_KEY') ?? '');
  const vapidSubject =
    (Deno.env.get('VAPID_SUBJECT') ?? '').trim().replace(/^["']|["']$/g, '') ||
    'mailto:noreply@so-ki.app';

  // Lightweight GET endpoint so the web client always fetches the *current*
  // VAPID public key from the server. Hardcoding the key in client code
  // caused a fatal mismatch when the secret was rotated — Apple rejected
  // every push with "BadVapidPublicKey".
  const url = new URL(req.url);
  if (req.method === 'GET' || url.searchParams.get('action') === 'public-key') {
    return new Response(JSON.stringify({ publicKey: vapidPublic }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log(
    'VAPID public length:',
    vapidPublic.length,
    'first8:',
    vapidPublic.slice(0, 8),
    'last8:',
    vapidPublic.slice(-8),
    'private length:',
    vapidPrivate.length,
    'subject:',
    vapidSubject,
  );

  if (!vapidPublic || !vapidPrivate) {
    return new Response(
      JSON.stringify({ error: 'VAPID keys not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const admin = createClient(supabaseUrl, serviceKey);

  const { data: subs, error: subErr } = await admin
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .eq('enabled', true);

  if (subErr) {
    console.error('Failed to load subscriptions', subErr);
    return new Response(JSON.stringify({ error: subErr.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Group by user to avoid duplicate AI calls per device.
  const byUser = new Map<string, SubRow[]>();
  for (const s of (subs ?? []) as SubRow[]) {
    const list = byUser.get(s.user_id) ?? [];
    list.push(s);
    byUser.set(s.user_id, list);
  }

  let sent = 0;
  let failed = 0;
  const removed: string[] = [];

  for (const [userId, userSubs] of byUser) {
    const [{ data: diaries }, { data: profile }] = await Promise.all([
      admin
        .from('diary_entries')
        .select('content, date')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(5),
      admin
        .from('profiles')
        .select('display_name')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    const body = await generateSokiLine(
      (diaries ?? []) as DiaryRow[],
      (profile as ProfileRow | null)?.display_name ?? null,
    );

    const payload = JSON.stringify({
      title: 'SO-KI',
      body,
      url: '/',
      tag: 'soki-nightly',
    });

    for (const sub of userSubs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
          { TTL: 60 * 60 * 6 },
        );
        sent++;
        await admin
          .from('push_subscriptions')
          .update({ last_notified_at: new Date().toISOString() })
          .eq('id', sub.id);
      } catch (err: any) {
        failed++;
        const status = err?.statusCode;
        console.error('push error', status, err?.body);
        // 404 / 410 = subscription expired or unsubscribed → remove.
        if (status === 404 || status === 410) {
          removed.push(sub.endpoint);
          await admin.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    }
  }

  return new Response(
    JSON.stringify({ sent, failed, removed: removed.length }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});