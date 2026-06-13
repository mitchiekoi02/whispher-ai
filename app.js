import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const supabase = createClient(
  "https://zhdvwebtxiejrssudulj.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoZHZ3ZWJ0eGllanJzc3VkdWxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NTE2MDUsImV4cCI6MjA5NjMyNzYwNX0.a2s-fwh7_SRSlTGqDl9ppiY6heKfYR-_Jxy7iERub6E"
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
   AUTH
====================== */

window.signup = async () => {
  const emailVal = $("email")?.value?.trim();
  const passVal = $("password")?.value;

  const { error } = await supabase.auth.signUp({
    email: emailVal,
    password: passVal,
  });

  if (error) return alert(error.message);

  alert("Account created. Please login.");
};

window.login = async () => {
  const emailVal = $("email")?.value?.trim();
  const passVal = $("password")?.value;

  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailVal,
    password: passVal,
  });

  if (error) return alert(error.message);

  user = data.user;

  $("loginBox")?.classList.add("hidden");
  $("characterBox")?.classList.remove("hidden");

  await loadCharacters();
};

/* ======================
   CHARACTERS
====================== */

async function loadCharacters() {
  const { data, error } = await supabase
    .from("characters")
    .select("id,name,archetype,system_prompt,voice_id");

  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  characters = data || [];
  renderCharacters();
}

function renderCharacters() {
  const grid = $("characterGrid");
  if (!grid) return;

  grid.innerHTML = "";

  characters.forEach((c) => {
    const div = document.createElement("div");
    div.className = "character-card";

    // ✅ CLEAN UI: ONLY NAME
    div.innerHTML = `<h3>${c.name}</h3>`;

    div.onclick = () => selectCharacter(c);
    grid.appendChild(div);
  });
}

/* ======================
   CHARACTER SELECT
====================== */

function selectCharacter(c) {
  if (!c?.id) return;

  selectedCharacter = c;

  $("characterBox")?.classList.add("hidden");
  $("chatBox")?.classList.remove("hidden");

  const nameEl = $("charName");
  const chat = $("chat");

  if (nameEl) nameEl.innerText = c.name;
  if (chat) chat.innerHTML = "";

  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}

/* ======================
   CHAT
====================== */

window.sendMessage = async () => {
  const input = $("msg");
  const text = input?.value?.trim();

  if (!text || !user || !selectedCharacter) return;

  addMessage("user", text);
  input.value = "";

  try {
    const response = await fetch(
      "https://zhdvwebtxiejrssudulj.supabase.co/functions/v1/whisper-chat",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          character_id: selectedCharacter.id,
          message: text,
          language: navigator.language?.slice(0, 2) || "en",
        }),
      }
    );

    const data = await response.json();

    if (!data.ok) {
      addMessage("ai", data.error || "Server error");
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
    addMessage("ai", "Something went wrong. Please try again.");
  }
};

/* ======================
   UI
====================== */

function addMessage(role, text) {
  const chat = $("chat");
  if (!chat) return;

  const div = document.createElement("div");
  div.className = `message ${role}`;
  div.textContent = `${role === "user" ? "You: " : ""}${text}`;

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}
