import { createClient } from "npm:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding/base64";

/* ======================
   CORS
====================== */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

/* ======================
   GEMINI
====================== */
async function callGemini(prompt: string) {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    console.error("Gemini error:", data);
    throw new Error("Gemini failed");
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) throw new Error("Empty Gemini response");

  return text.trim();
}

/* ======================
   ELEVENLABS
====================== */
async function generateSpeech(text: string, voiceId: string) {
  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");

  if (!apiKey || !voiceId) return null;

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!res.ok) {
      console.error("ElevenLabs error:", await res.text());
      return null;
    }

    const buffer = new Uint8Array(await res.arrayBuffer());
    const base64 = encodeBase64(buffer);

    return `data:audio/mpeg;base64,${base64}`;
  } catch (e) {
    console.error("TTS crash:", e);
    return null;
  }
}

/* ======================
   MEMORY SYSTEM
====================== */
async function saveMemory(supabase: any, userId: string, characterId: string, userMsg: string, aiReply: string) {
  try {
    const prompt = `
Extract only important personal facts about the user.

User: ${userMsg}
AI: ${aiReply}

Return:
- ONE sentence OR NONE
- Must start with "The user"
`;

    const result = await callGemini(prompt);

    if (!result || result.includes("NONE")) return;

    await supabase.from("memories").insert({
      user_id: userId,
      character_id: characterId,
      memory_text: result.trim(),
      importance_score: 2,
    });
  } catch (e) {
    console.error("Memory error:", e);
  }
}

/* ======================
   MAIN
====================== */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("CUSTOM_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      throw new Error("Missing env vars");
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    const { user_id, character_id, message } = await req.json();

    if (!user_id || !character_id || !message) {
      return jsonResponse({ ok: false, error: "Missing fields" }, 400);
    }

    /* ======================
       CHARACTER LOAD
    ====================== */
    const { data: character, error } = await supabase
      .from("characters")
      .select("*")
      .eq("id", character_id)
      .single();

    if (error || !character) {
      return jsonResponse({ ok: false, error: "Character not found" }, 404);
    }

    /* ======================
       MEMORY LOAD
    ====================== */
    const { data: memories } = await supabase
      .from("memories")
      .select("memory_text")
      .eq("user_id", user_id)
      .eq("character_id", character_id)
      .limit(6);

    const memoryText = memories?.length
      ? memories.map(m => `- ${m.memory_text}`).join("\n")
      : "No prior memory.";

    /* ======================
       PROMPT (FIXED FLOW)
    ====================== */
    const prompt = `
You are ${character.name}.

Personality:
${character.system_prompt}

Memory:
${memoryText}

RULES:
- Stay fully in character
- No robotic tone
- No repetition
- Natural conversation only

User: ${message}
${character.name}:
`;

    const reply = await callGemini(prompt);

    /* ======================
       VOICE
    ====================== */
    const audio = await generateSpeech(reply, character.voice_id);

    /* ======================
       MEMORY BACKGROUND
    ====================== */
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(
        saveMemory(supabase, user_id, character_id, message, reply)
      );
    } else {
      saveMemory(supabase, user_id, character_id, message, reply);
    }

    return jsonResponse({
      ok: true,
      reply,
      audio,
      voice: {
        enabled: !!audio,
        voice_id: character.voice_id,
      },
    });
  } catch (err) {
    console.error("whisper-chat error:", err);

    return jsonResponse(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      500
    );
  }
});
