import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { webhookUrl, source, payload } = await req.json();

    if (!webhookUrl || typeof webhookUrl !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid webhookUrl", _proxyError: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate URL
    try {
      new URL(webhookUrl);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid URL format", _proxyError: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the body to forward: if `payload` is provided, use it directly;
    // otherwise fall back to the legacy { source, timestamp } shape for reads.
    const forwardBody = payload
      ? JSON.stringify(payload)
      : JSON.stringify({ source, timestamp: new Date().toISOString() });

    // Forward request server-to-server (no CORS restrictions)
    const response = await fetch(webhookUrl, {
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
