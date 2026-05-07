const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function clean(value: string | undefined): string {
  return (value ?? '').trim().replace(/^['"]|['"]$/g, '');
}

Deno.serve((req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const appId = clean(Deno.env.get('ONESIGNAL_APP_ID'));
  const safariWebId = clean(Deno.env.get('ONESIGNAL_SAFARI_WEB_ID'));

  return new Response(
    JSON.stringify({
      configured: Boolean(appId),
      appId: appId || null,
      safariWebId: safariWebId || null,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
