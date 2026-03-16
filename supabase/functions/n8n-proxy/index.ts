import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const DEFAULT_WEBHOOK_URL = "https://n8n.srv1437130.hstgr.cloud/webhook/bb826393-569e-4270-a033-6f6d8019e0e0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
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
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: forwardBody,
    });

    const rawText = await response.text();

    // If upstream returned an error, wrap it so client gets a 200 with error info
    if (!response.ok) {
      console.error(`n8n upstream error: ${response.status}`, rawText);
      return new Response(
        JSON.stringify({
          _proxyError: true,
          error: `n8n returned ${response.status}`,
          hint: rawText.substring(0, 500),
          upstreamStatus: response.status,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse and unwrap n8n Code node output
    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return new Response(rawText, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": response.headers.get("Content-Type") || "text/plain" },
      });
    }

    // Unwrap: array → first element
    if (Array.isArray(parsed)) {
      parsed = parsed[0];
    }

    // Unwrap: { json: { ... } } → inner object (n8n Code node convention)
    if (parsed && typeof parsed === "object" && parsed.json && typeof parsed.json === "object") {
      parsed = parsed.json;
    }

    return new Response(JSON.stringify(parsed), {
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
