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
   AUTH
====================== */
window.signup = async () => {
  const email = $("email")?.value?.trim();
  const password = $("password")?.value;

  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return alert(error.message);

  alert("Check your email then login.");
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

  // CHECK IF USER HAS EXISTING ROOM (RESUME FEATURE)
  const { data: profile } = await supabase
    .from("customer_profiles")
    .select("current_room_id")
    .eq("id", user.id)
    .single();

  $("loginBox").classList.add("hidden");

  if (profile?.current_room_id) {
    roomId = profile.current_room_id;

    $("chatBox").classList.remove("hidden");

    addMessage("ai", "Welcome back… resuming your experience.");

    await loadRoomIntro();
  } else {
    $("onboardingBox").classList.remove("hidden");
  }
};

/* ======================
   ONBOARDING → CREATE ROOM
====================== */
window.startSession = async () => {
  const name = $("name").value.trim();
  const location = $("location").value.trim();
  const language = $("language").value.trim();
  const personality = $("personality").value.trim();

  if (!name || !language || !personality) {
    alert("Please fill required fields");
    return;
  }

  const res = await fetch(
    "https://zhdvwebtxiejrssudulj.supabase.co/functions/v1/whisper-onboarding",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: user.id,
        name,
        location,
        language_preference: language,
        personality_preference: personality,
      }),
    }
  );

  const data = await res.json();

  if (!data.ok) {
    alert(data.error || "Onboarding failed");
    return;
  }

  roomId = data.session.room_id;
  character = data.session.character;

  localStorage.setItem("room_id", roomId);
  localStorage.setItem("character", JSON.stringify(character));

  $("onboardingBox").classList.add("hidden");
  $("chatBox").classList.remove("hidden");

  addMessage("ai", `${character.name} is now with you...`);
};

/* ======================
   LOAD ROOM INTRO (RESUME)
====================== */
async function loadRoomIntro() {
  const { data: mem } = await supabase
    .from("memories")
    .select("memory_text")
    .eq("user_id", user.id)
    .eq("room_id", roomId)
    .order("importance_score", { ascending: false })
    .limit(5);

  if (mem?.length) {
    mem.forEach(m => {
      addMessage("ai", `💭 Memory: ${m.memory_text}`);
    });
  }
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
   CHAT CORE (ROOM BASED)
====================== */
window.sendMessage = async () => {
  const input = $("msg");
  const text = input?.value?.trim();

  if (!user || !roomId || (!text && !selectedImage)) return;

  const currentRequest = ++requestCounter;

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

    setTimeout(() => {
      if (currentRequest !== requestCounter) return;

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
    }, 600);

  } catch (err) {
    removeTyping();
    addMessage("ai", "Connection unstable...");
  }
};

/* ======================
   TYPING EFFECT
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

  const div = document.createElement("div");
  div.className = `message ${role}`;

  if (role === "user") {
    div.textContent = `You: ${text}`;
  } else {
    div.innerHTML = `
      <div style="display:flex;gap:10px;align-items:flex-start;">
        <div>${text}</div>
      </div>
    `;
  }

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

/* ======================
   ENTER KEY SUPPORT
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
