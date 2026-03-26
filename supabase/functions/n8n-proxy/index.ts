const DEFAULT_WEBHOOK_URL = "https://n8n.srv1437130.hstgr.cloud/webhook/bb826393-569e-4270-a033-6f6d8019e0e0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { webhookUrl, source, payload } = await req.json();

    const targetUrl =
      typeof webhookUrl === "string" && webhookUrl.trim().length > 0
        ? webhookUrl
        : DEFAULT_WEBHOOK_URL;

    try {
      new URL(targetUrl);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid URL format", _proxyError: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const forwardBody =
      payload !== undefined
        ? JSON.stringify(payload ?? {})
        : JSON.stringify(source ? { source, timestamp: new Date().toISOString() } : {});

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: forwardBody,
    });

    // Handle empty or non-JSON upstream responses gracefully
    let data: any = {};
    const text = await response.text();
    if (text && text.trim().length > 0) {
      try {
        let parsed = JSON.parse(text);
        // Unwrap n8n array envelope
        if (Array.isArray(parsed)) parsed = parsed[0];
        // Unwrap n8n Code node { json: {...} } convention
        if (parsed && typeof parsed === "object" && parsed.json && typeof parsed.json === "object") {
          parsed = parsed.json;
        }
        data = parsed ?? {};
      } catch {
        data = { raw: text, _proxyError: false };
      }
    }

    // If upstream returned an error status, flag it
    if (!response.ok) {
      data = { ...data, _proxyError: true, error: `n8n returned ${response.status}`, upstreamStatus: response.status };
    }

    // For write webhooks that return empty 200s, ensure success flag exists
    if (response.ok && Object.keys(data).length === 0 && !text.trim()) {
      data = { success: true };
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("n8n-proxy error:", message);
    return new Response(
      JSON.stringify({ error: message, _proxyError: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
