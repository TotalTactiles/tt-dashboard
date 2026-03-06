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
    const { webhookUrl, source } = await req.json();

    if (!webhookUrl || typeof webhookUrl !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid webhookUrl" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate URL
    try {
      new URL(webhookUrl);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid URL format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Forward request server-to-server (no CORS restrictions)
    // n8n webhook contract here expects GET
    const targetUrl = new URL(webhookUrl);
    if (typeof source === "string" && source.trim()) {
      targetUrl.searchParams.set("source", source);
    }
    targetUrl.searchParams.set("timestamp", new Date().toISOString());

    const response = await fetch(targetUrl.toString(), {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    const rawText = await response.text();

    // Parse and unwrap n8n Code node output
    // n8n wraps Code node results in an array: [{ json: { quotes, cashflow, ... } }]
    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // Not JSON — return as-is
      return new Response(rawText, {
        status: response.status,
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
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("n8n-proxy error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
