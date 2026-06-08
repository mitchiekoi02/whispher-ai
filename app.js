import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  "https://zhdvwebtxiejrssudulj.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoZHZ3ZWJ0eGllanJzc3VkdWxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NTE2MDUsImV4cCI6MjA5NjMyNzYwNX0.a2s-fwh7_SRSlTGqDl9ppiY6heKfYR-_Jxy7iERub6E"
);

let user = null;
let selectedCharacter = null;
let characters = [];

/* =========================
   LANGUAGE SYSTEM
========================= */

function getLanguage() {
  return (
    localStorage.getItem("lang") ||
    navigator.language?.slice(0, 2) ||
    "en"
  );
}

/* =========================
   AUTH
========================= */

window.signup = async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const { error } = await supabase.auth.signUp({ email, password });

  if (error) return alert(error.message);

  alert("Signed up! Now login.");
};

window.login = async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) return alert(error.message);

  user = data.user;
  loadCharacters();
};

/* =========================
   CHARACTERS
========================= */

async function loadCharacters() {
  const { data, error } = await supabase
    .from("characters")
    .select("*");

  if (error) return alert(error.message);

  characters = data || [];

  document.getElementById("loginBox").classList.add("hidden");
  document.getElementById("characterBox").classList.remove("hidden");

  renderCharacterList();
}

function renderCharacterList() {
  const container = document.getElementById("characterBox");

  container.innerHTML = "<h2>Choose Companion</h2>";

  characters.forEach((char) => {
    const div = document.createElement("div");

    div.className = "character-card";
    div.innerHTML = `
      <h3>${char.name}</h3>
      <p>${char.trait || "Companion AI"}</p>
    `;

    div.onclick = () => selectCharacter(char.id);

    container.appendChild(div);
  });
}

window.selectCharacter = (id) => {
  selectedCharacter = characters.find((c) => c.id === id);

  document.getElementById("characterBox").classList.add("hidden");
  document.getElementById("chatBox").classList.remove("hidden");

  document.getElementById("chat").innerHTML = "";

  document.getElementById("companionName").innerText =
    selectedCharacter?.name || "Companion";
};

/* =========================
   CHAT → EDGE FUNCTION
========================= */

window.sendMessage = async () => {
  const input = document.getElementById("msg");
  const text = input.value.trim();

  if (!text || !user || !selectedCharacter) return;

  renderMessage("user", text);

  input.value = "";

  const language = getLanguage();

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
          language: language,
        }),
      }
    );

    const data = await res.json();

    if (!data.ok) {
      throw new Error(data.error || "Request failed");
    }

    renderMessage("ai", data.reply);

    /* =========================
       🎤 VOICE PLAYBACK (ELEVENLABS)
    ========================= */

    if (data.audio) {
      const audio = new Audio(data.audio);

      audio.play().catch((err) => {
        console.log("Audio blocked or failed:", err);
      });
    }

  } catch (err) {
    console.error(err);
    renderMessage("ai", "Sorry, something went wrong.");
  }
};

/* =========================
   UI RENDER
========================= */

function renderMessage(role, text) {
  const div = document.createElement("div");

  div.className = `message ${role}`;

  div.innerText = (role === "user" ? "You: " : "AI: ") + text;

  const chat = document.getElementById("chat");
  chat.appendChild(div);

  chat.scrollTop = chat.scrollHeight;
}
