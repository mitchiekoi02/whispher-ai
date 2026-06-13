import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// Your frontend client initialization using the public anon token configuration
const supabase = createClient(
  "https://zhdvwebtxiejrssudulj.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoZHZ2ZWJ0eGllanJzc3VkdWxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NTE2MDUsImV4cCI6MjA5NjMyNzYwNX0.a2s-fwh7_SRSlTGqDl9ppiY6heKfYR-_Jxy7iERub6E"
);

let user = null;
let characters = [];
let selectedCharacter = null;
let currentAudio = null;

/* ======================
   HELPERS
====================== */
const $ = (id) => document.getElementById(id);

/* ======================
   IMAGE MAP (FIXED FOR GITHUB PAGES)
====================== */
const characterImages = {
  Luna: "./images/luna.png",
  Mia: "./images/mia.png",
  Aria: "./images/aria.png",
};

/* ======================
   AUTH PIPELINE
====================== */
window.signup = async () => {
  const email = $("email")?.value?.trim();
  const password = $("password")?.value;

  const { error } = await supabase.auth.signUp({
    email,
    password,
  });

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

  $("loginBox")?.classList.add("hidden");
  $("characterBox")?.classList.remove("hidden");

  await loadCharacters();
};

/* ======================
   LOAD CHARACTERS
====================== */
async function loadCharacters() {
  const { data, error } = await supabase
    .from("characters")
    .select("id,name,system_prompt,voice_id");

  if (error) {
    console.error("Character load error:", error);
    return alert(error.message);
  }

  characters = data || [];
  renderCharacters();
}

/* ======================
   RENDER NETFLIX CARDS
====================== */
function renderCharacters() {
  const grid = $("characterGrid");
  if (!grid) return;

  grid.innerHTML = "";

  characters.forEach((c) => {
    // Get the localized image path from your mapping, default to an empty string if missing
    const img = characterImages[c.name] || "";

    const div = document.createElement("div");
    div.className = "character-card";

    div.innerHTML = `
      <div class="character-image">
        <img src="${img}" alt="${c.name}" />
      </div>
      <h3>${c.name}</h3>
    `;

    div.onclick = () => selectCharacter(c);
    grid.appendChild(div);
  });
}

/* ======================
   SELECT CHARACTER
====================== */
function selectCharacter(c) {
  if (!c?.id) return;

  selectedCharacter = c;

  $("characterBox")?.classList.add("hidden");
  $("chatBox")?.classList.remove("hidden");

  $("charName").innerText = c.name;
  $("chat").innerHTML = "";

  // Stop current audio session if switching cards midway through speech
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}

/* ======================
   CHAT SYSTEM & MEDIA PLAYER
====================== */
window.sendMessage = async () => {
  const input = $("msg");
  const text = input?.value?.trim();

  if (!text || !user || !selectedCharacter) return;

  // Stop old audio playback if the user texts a new message quickly
  if (currentAudio) {
    currentAudio.pause();
  }

  addMessage("user", text);
  input.value = "";

  try {
    const res = await fetch(
      "https://zhdvwebtxiejrssudulj.supabase.co/functions/v1/whisper-chat",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: user.id,
          character_id: selectedCharacter.id,
          message: text,
          language: navigator.language?.slice(0, 2) || "en",
        }),
      }
    );

    const data = await res.json();

    if (!data.ok) {
      addMessage("ai", data.error || "Something went wrong");
      return;
    }

    addMessage("ai", data.reply);

    /* ========================================================
       AUDIO SUB-ENGINE (NATIVE BASE64 MP3 DECODER STREAM)
       ======================================================== */
    if (data.audio) {
      if (currentAudio) currentAudio.pause();

      currentAudio = new Audio(data.audio);
      currentAudio.play().catch((err) => {
        console.log("Autoplay blocked by browser media execution policy:", err);
      });
    }

  } catch (err) {
    console.error("Chat error:", err);
    addMessage("ai", "Network error. Try again.");
  }
};

/* ======================
   UI RENDER MATRIX
====================== */
function addMessage(role, text) {
  const chat = $("chat");
  if (!chat) return;

  const div = document.createElement("div");
  div.className = `message ${role}`;

  div.textContent = role === "user" ? `You: ${text}` : text;

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}
