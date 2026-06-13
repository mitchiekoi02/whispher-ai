import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/* ======================
   SUPABASE
====================== */
const supabase = createClient(
  "https://zhdvwebtxiejrssudulj.supabase.co",
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoZHZ3ZWJ0eGllanJzc3VkdWxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NTE2MDUsImV4cCI6MjA5NjMyNzYwNX0.a2s-fwh7_SRSlTGqDl9ppiY6heKfYR-_Jxy7iERub6E"
);

/* ======================
   STATE
====================== */
let user = null;
let roomId = null;
let character = null;

let currentAudio = null;
let requestCounter = 0;
let selectedImage = null;

/* ======================
   HELPERS
====================== */
const $ = (id) => document.getElementById(id);

/* ======================
   INIT SESSION
====================== */
document.addEventListener("DOMContentLoaded", async () => {
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.user) {
    user = session.user;
    await restoreSession();
  }
});

/* ======================
   RESTORE SESSION (FIXED)
====================== */
async function restoreSession() {
  try {
    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error) throw error;

    $("loginBox")?.classList.add("hidden");

    if (profile?.onboarding_completed) {
      $("chatBox")?.classList.remove("hidden");
      addMessage("ai", "Welcome back… resuming your experience.");
    } else {
      $("onboardingBox")?.classList.remove("hidden");
    }

  } catch (err) {
    console.error("Restore session error:", err);
    $("onboardingBox")?.classList.remove("hidden");
  }
}

/* ======================
   AUTH
====================== */
window.signup = async () => {
  const email = $("email")?.value?.trim();
  const password = $("password")?.value;

  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return alert(error.message);

  alert("Check your email to confirm your account.");
};

window.login = async () => {
  const email = $("email")?.value?.trim();
  const password = $("password")?.value;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) return alert(error.message);

  user = data.user;
  await restoreSession();
};

/* ======================
   LOAD ROOM + CHARACTER
====================== */
async function loadRoom(roomIdParam) {
  if (!roomIdParam) return;

  const { data: room } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", roomIdParam)
    .single();

  if (!room) return;

  const { data: char } = await supabase
    .from("characters")
    .select("*")
    .eq("id", room.character_id)
    .single();

  character = char || null;
  roomId = room.id;
}

/* ======================
   ONBOARDING
====================== */
window.startSession = async () => {
  const name = $("name")?.value?.trim();
  const location = $("location")?.value?.trim();
  const language = $("language")?.value?.trim();
  const personality = $("personality")?.value?.trim();

  if (!name || !language || !personality) {
    alert("Please complete required fields.");
    return;
  }

  try {
    const res = await fetch(
      "https://zhdvwebtxiejrssudulj.supabase.co/functions/v1/whisper-onboarding",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          name,
          location,
          language,
          personality,
        }),
      }
    );

    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Onboarding failed");
    }

    roomId = data.room_id;
    character = data.character;

    $("onboardingBox")?.classList.add("hidden");
    $("chatBox")?.classList.remove("hidden");

    addMessage("ai", `${character.name} is now with you...`);

  } catch (err) {
    console.error(err);
    alert("Network error during onboarding.");
  }
};

/* ======================
   MEMORY PREVIEW
====================== */
async function loadRoomMemoryPreview() {
  if (!roomId || !user) return;

  const { data } = await supabase
    .from("memories")
    .select("memory_text")
    .eq("user_id", user.id)
    .eq("room_id", roomId)
    .order("importance_score", { ascending: false })
    .limit(5);

  data?.forEach((m) => {
    addMessage("ai", `💭 ${m.memory_text}`);
  });
}

/* ======================
   IMAGE HANDLER
====================== */
window.setImage = (file) => {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    selectedImage = reader.result;
  };
  reader.readAsDataURL(file);
};

/* ======================
   CHAT CORE
====================== */
window.sendMessage = async () => {
  const input = $("msg");
  const text = input?.value?.trim();

  if (!user || !roomId || (!text && !selectedImage)) return;

  const requestId = ++requestCounter;

  addMessage("user", text || "[image]");
  input.value = "";

  showTyping();

  const imageToSend = selectedImage;
  selectedImage = null;

  try {
    const res = await fetch(
      "https://zhdvwebtxiejrssudulj.supabase.co/functions/v1/whisper-chat",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          room_id: roomId,
          message: text,
          image: imageToSend,
        }),
      }
    );

    const data = await res.json();

    if (requestId !== requestCounter) return;

    removeTyping();

    if (!data.ok) {
      addMessage("ai", data.error || "Something went wrong");
      return;
    }

    addMessage("ai", data.reply);

    if (data.audio) {
      if (currentAudio) currentAudio.pause();

      currentAudio = new Audio(data.audio);
      currentAudio.play().catch(() => {});
    }

  } catch (err) {
    console.error(err);
    removeTyping();
    addMessage("ai", "Connection unstable...");
  }
};

/* ======================
   TYPING
====================== */
function showTyping() {
  removeTyping();

  const chat = $("chat");
  const div = document.createElement("div");

  div.className = "message ai";
  div.id = "typing";
  div.textContent = `${character?.name || "AI"} is thinking...`;

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function removeTyping() {
  document.getElementById("typing")?.remove();
}

/* ======================
   MESSAGE RENDER
====================== */
function addMessage(role, text) {
  const chat = $("chat");
  if (!chat) return;

  const div = document.createElement("div");
  div.className = `message ${role}`;

  div.textContent = role === "user"
    ? `You: ${text}`
    : text;

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

/* ======================
   ENTER KEY
====================== */
document.addEventListener("DOMContentLoaded", () => {
  const input = $("msg");

  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      window.sendMessage();
    }
  });
});
