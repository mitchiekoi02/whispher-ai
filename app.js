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
   IMAGE MAP
====================== */
const characterImages = {
  Luna: "./images/luna.png",
  Mia: "./images/mia.png",
  Aria: "./images/aria.png",
};

/* ======================
   TYPING SYSTEM
====================== */
let typingEl = null;

function showTyping(name) {
  const chat = $("chat");
  if (!chat) return;

  hideTyping();

  typingEl = document.createElement("div");
  typingEl.className = "message ai";
  typingEl.textContent = `${name} is typing...`;

  chat.appendChild(typingEl);
  chat.scrollTop = chat.scrollHeight;
}

function hideTyping() {
  if (typingEl) typingEl.remove();
  typingEl = null;
}

/* ======================
   AUTH
====================== */
window.signup = async () => {
  const email = $("email").value.trim();
  const password = $("password").value;

  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return alert(error.message);

  alert("Check email then login.");
};

window.login = async () => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: $("email").value.trim(),
    password: $("password").value,
  });

  if (error) return alert(error.message);

  user = data.user;

  $("loginBox").classList.add("hidden");
  $("characterBox").classList.remove("hidden");

  loadCharacters();
};

/* ======================
   CHARACTERS
====================== */
async function loadCharacters() {
  const { data } = await supabase
    .from("characters")
    .select("id,name,system_prompt,voice_id");

  characters = data || [];
  renderCharacters();
}

function renderCharacters() {
  const grid = $("characterGrid");
  grid.innerHTML = "";

  characters.forEach(c => {
    const div = document.createElement("div");
    div.className = "character-card";

    div.innerHTML = `
      <img src="${characterImages[c.name]}" />
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
  selectedCharacter = c;

  $("characterBox").classList.add("hidden");
  $("chatBox").classList.remove("hidden");

  $("charName").innerText = c.name;
  $("chat").innerHTML = "";

  if (currentAudio) currentAudio.pause();
}

/* ======================
   CHAT
====================== */
window.sendMessage = async () => {
  const text = $("msg").value.trim();
  if (!text || !user || !selectedCharacter) return;

  addMessage("user", text);
  $("msg").value = "";

  showTyping(selectedCharacter.name);

  const res = await fetch(
    "https://zhdvwebtxiejrssudulj.supabase.co/functions/v1/whisper-chat",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: user.id,
        character_id: selectedCharacter.id,
        message: text,
      }),
    }
  );

  const data = await res.json();

  hideTyping();

  if (!data.ok) {
    addMessage("ai", data.error);
    return;
  }

  addMessage("ai", data.reply);

  if (data.audio) {
    currentAudio = new Audio(data.audio);
    currentAudio.play().catch(() => {});
  }
};

/* ======================
   UI
====================== */
function addMessage(role, text) {
  const chat = $("chat");

  const div = document.createElement("div");
  div.className = `message ${role}`;
  div.textContent = role === "user" ? `You: ${text}` : text;

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}
