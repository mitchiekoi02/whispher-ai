import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/* ======================
   SUPABASE
====================== */
const supabase = createClient(
  "https://zhdvwebtxiejrssudulj.supabase.co",
  "YOUR_ANON_KEY_HERE"
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

  $("loginBox").classList.add("hidden");
  $("onboardingBox").classList.remove("hidden");
};

/* ======================
   ONBOARDING → ROOM CREATION
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

  // STORE SESSION
  roomId = data.session.room_id;
  character = data.session.character;

  localStorage.setItem("room_id", roomId);
  localStorage.setItem("character", JSON.stringify(character));

  // UI TRANSITION
  $("onboardingBox").classList.add("hidden");
  $("chatBox").classList.remove("hidden");

  $("charName").innerText = character.name;

  addMessage("ai", `${character.name} is now with you...`);
};

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

  if (role === "ai" && character) {
    div.innerHTML = `
      <div style="display:flex;gap:10px;align-items:flex-start;">
        <div>
          <div>${text}</div>
        </div>
      </div>
    `;
  } else {
    div.textContent = role === "user" ? `You: ${text}` : text;
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
