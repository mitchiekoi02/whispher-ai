import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// Initialize Supabase using your distinct public client credentials
const supabase = createClient(
  "https://zhdvwebtxiejrssudulj.supabase.co",
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoZHZ2ZWJ0eGllanJzc3VkdWxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NTE2MDUsImV4cCI6MjA5NjMyNzYwNX0.a2s-fwh7_SRSlTGqDl9ppiY6heKfYR-_Jxy7iERub6E" // <-- Paste your actual long public key here!
);

let user = null;
let characters = [];
let selectedCharacter = null;
let currentAudio = null; // Track playing audio to allow interrupting it

/* ======================
   HELPERS
====================== */
const $ = (id) => document.getElementById(id);

/* ======================
   AUTH PIPELINE
====================== */
window.signup = async () => {
  const emailVal = $("email")?.value?.trim();
  const passVal = $("password")?.value;

  const { error } = await supabase.auth.signUp({
    email: emailVal,
    password: passVal,
  });

  if (error) return alert(error.message);
  alert("Account created successfully! Please log in.");
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

  const loginBox = $("loginBox");
  const characterBox = $("characterBox");

  if (loginBox) loginBox.classList.add("hidden");
  if (characterBox) characterBox.classList.remove("hidden");

  await loadCharacters();
};

/* ======================
   DATA RESOLUTION: CHARACTERS
====================== */
async function loadCharacters() {
  const { data, error } = await supabase
    .from("characters")
    .select("id,name,archetype,system_prompt,voice_id");

  if (error) {
    console.error("Character sync failure:", error);
    alert(error.message);
    return;
  }

  characters = data || [];
  console.log("Characters synchronized:", characters);
  renderCharacters();
}

function renderCharacters() {
  const grid = $("characterGrid");
  if (!grid) return;

  grid.innerHTML = "";

  characters.forEach((c) => {
    const div = document.createElement("div");
    div.className = "character-card";

    div.innerHTML = `
      <h3>${c.name}</h3>
      <p class="archetype-badge">${c.archetype || "Companion"}</p>
    `;

    div.onclick = () => selectCharacter(c);
    grid.appendChild(div);
  });
}

function selectCharacter(c) {
  if (!c?.id) {
    console.error("Invalid choice configuration parsed:", c);
    return;
  }

  selectedCharacter = c;
  console.log("Active Companion session locked:", c.name, c.id);

  const characterBox = $("characterBox");
  const chatBox = $("chatBox");
  const nameEl = $("charName");
  const chat = $("chat");

  if (characterBox) characterBox.classList.add("hidden");
  if (chatBox) chatBox.classList.remove("hidden");

  if (nameEl) nameEl.innerText = c.name;
  if (chat) chat.innerHTML = "";
  
  // Stop any playing audio from a previous character switch
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}

/* ======================
   CHAT & VOICE GENERATION
====================== */
window.sendMessage = async () => {
  const input = $("msg");
  const text = input?.value?.trim();

  if (!text || !user || !selectedCharacter) return;

  // Interrupt previous voice output if the user sends a new message quickly
  if (currentAudio) {
    currentAudio.pause();
  }

  addMessage("user", text);
  input.value = "";

  try {
    const response = await fetch(
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

    const data = await response.json();
    console.log("Edge Function processing matrix response:", data);

    if (!data.ok) {
      addMessage("ai", data.error || "Unknown edge execution issue.");
      return;
    }

    // Render text response directly to user screen
    addMessage("ai", data.reply);

    // VOICE PLAYBACK ENGINE: Handles automatic voice stream execution
    if (data.audio) {
      console.log("Audio payload detected. Executing browser speech stream...");
      currentAudio = new Audio(data.audio);
      currentAudio.play().catch((audioErr) => {
        console.warn("Browser audio execution policy blocked autoplay:", audioErr);
      });
    }

  } catch (err) {
    console.error("Network runtime dispatch exception:", err);
    addMessage("ai", "I had trouble reaching the server. Try again in a second!");
  }
};

/* ======================
   UI MATRIX MODIFICATION
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
