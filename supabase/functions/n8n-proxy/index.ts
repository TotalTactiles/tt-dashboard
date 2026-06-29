import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  // Auth gate — require a valid logged-in user
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  const token = authHeader?.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (!token) {
    return new Response(
      JSON.stringify({ error: "Unauthorized", _proxyError: true }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", _proxyError: true }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch {
    return new Response(
      JSON.stringify({ error: "Unauthorized", _proxyError: true }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
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

    // Abort upstream call before the edge function's 150s idle timeout fires
    const controller = new AbortController();
    const timeoutMs = 120_000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: forwardBody,
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      const aborted = (err as any)?.name === "AbortError";
      return new Response(
        JSON.stringify({
          _proxyError: true,
          error: aborted
            ? `Upstream n8n webhook did not respond within ${timeoutMs / 1000}s`
            : (err instanceof Error ? err.message : "Upstream fetch failed"),
          timeout: aborted,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    clearTimeout(timeoutId);

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

    console.log('[n8n-proxy] response keys:', Object.keys(data ?? {}));
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
