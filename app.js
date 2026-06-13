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
   CHARACTER IMAGES
====================== */
const characterImages = {
  Luna: "./images/luna.png",
  Mia: "./images/mia.png",
  Aria: "./images/aria.png",
};

/* ======================
   EMOTION ENGINE (NEW)
====================== */
function getTypingDelay(text = "") {
  const base = 800;
  const variability = Math.min(text.length * 12, 1800);
  return base + Math.random() * variability;
}

function showTyping(characterName) {
  const chat = $("chat");
  if (!chat) return;

  const div = document.createElement("div");
  div.className = "message ai typing";
  div.id = "typingIndicator";
  div.textContent = `${characterName} is thinking...`;

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function removeTyping() {
  const el = $("typingIndicator");
  if (el) el.remove();
}

/* emotional micro-responses BEFORE reply */
function emotionalPreResponse(name, text) {
  const chat = $("chat");
  if (!chat) return;

  let reaction = "";

  if (text.includes("?")) reaction = "…";
  else if (text.length < 10) reaction = "hmm.";
  else if (text.toLowerCase().includes("love")) reaction = "…that’s a strong word.";

  if (reaction) {
    const div = document.createElement("div");
    div.className = "message ai subtle";
    div.textContent = reaction;
    chat.appendChild(div);
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

  if (error) return alert(error.message);

  characters = data || [];
  renderCharacters();
}

/* ======================
   RENDER CHARACTERS
====================== */
function renderCharacters() {
  const grid = $("characterGrid");
  if (!grid) return;

  grid.innerHTML = "";

  characters.forEach((c) => {
    const img = characterImages[c.name] || "";

    const div = document.createElement("div");
    div.className = "character-card";

    div.innerHTML = `
      <img src="${img}" />
      <h3>${c.name}</h3>
    `;

    div.onclick = () => selectCharacter(c);
    grid.appendChild(div);
  });
}

/* ======================
   CHARACTER SELECT (FEELS ALIVE)
====================== */
function selectCharacter(c) {
  selectedCharacter = c;

  $("characterBox")?.classList.add("hidden");
  $("chatBox")?.classList.remove("hidden");

  $("charName").innerText = c.name;
  $("chat").innerHTML = "";

  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  // small emotional entrance moment
  setTimeout(() => {
    addMessage("ai", `${c.name} is here...`);
  }, 300);
}

/* ======================
   CHAT (EMOTIONALLY INTELLIGENT FLOW)
====================== */
window.sendMessage = async () => {
  const input = $("msg");
  const text = input?.value?.trim();

  if (!text || !user || !selectedCharacter) return;

  addMessage("user", text);
  input.value = "";

  /* STEP 1: emotional micro reaction */
  emotionalPreResponse(selectedCharacter.name, text);

  /* STEP 2: typing indicator */
  showTyping(selectedCharacter.name);

  const delay = getTypingDelay(text);

  try {
    const res = await fetch(
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

    const data = await res.json();

    setTimeout(() => {
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
    }, delay);

  } catch (err) {
    removeTyping();
    addMessage("ai", "…connection feels unstable.");
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

  div.textContent = role === "user" ? `You: ${text}` : text;

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}
