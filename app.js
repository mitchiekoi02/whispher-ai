import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const supabase = createClient(
  "https://zhdvwebtxiejrssudulj.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoZHZ3ZWJ0eGllanJzc3VkdWxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NTE2MDUsImV4cCI6MjA5NjMyNzYwNX0.a2s-fwh7_SRSlTGqDl9ppiY6heKfYR-_Jxy7iERub6E"
);

let user = null;
let characters = [];
let selectedCharacter = null;
let currentAudio = null;

let requestCounter = 0;
let selectedImage = null;

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

function getCharacterImage(name) {
  return characterImages[name] || "";
}

/* ======================
   EMOTION ENGINE
====================== */
function getTypingDelay(text = "") {
  const base = 650;
  const variability = Math.min(text.length * 9, 1200);
  return base + Math.random() * variability;
}

function showTyping(name) {
  removeTyping();

  const chat = $("chat");
  if (!chat) return;

  const div = document.createElement("div");
  div.className = "message ai typing";
  div.id = "typingIndicator";
  div.textContent = `${name} is thinking...`;

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function removeTyping() {
  document.getElementById("typingIndicator")?.remove();
}

/* subtle emotional response */
function emotionalPreResponse(text) {
  const chat = $("chat");
  if (!chat) return;

  const lower = text.toLowerCase();
  let reaction = null;

  if (lower.includes("love")) reaction = "…that’s a strong word.";
  else if (text.endsWith("?")) reaction = "…";
  else if (text.trim().length < 6) reaction = "hmm.";

  if (!reaction) return;

  const div = document.createElement("div");
  div.className = "message ai subtle";
  div.textContent = reaction;

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
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
    const div = document.createElement("div");
    div.className = "character-card";

    div.innerHTML = `
      <img src="${getCharacterImage(c.name)}" />
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

  $("characterBox")?.classList.add("hidden");
  $("chatBox")?.classList.remove("hidden");

  $("charName").innerText = c.name;
  $("chat").innerHTML = "";

  selectedImage = null;

  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  setTimeout(() => {
    addMessage("ai", `${c.name} is here...`);
  }, 200);
}

/* ======================
   IMAGE HANDLER (CAMERA + UPLOAD READY)
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

  if (!user || !selectedCharacter || (!text && !selectedImage)) return;

  const currentRequest = ++requestCounter;

  addMessage("user", text || "[image]");

  input.value = "";
  emotionalPreResponse(text || "");

  showTyping(selectedCharacter.name);

  const delay = getTypingDelay(text || "");

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
          character_id: selectedCharacter.id,
          message: text,
          image: imageToSend,
          emotion: "neutral",
          language: navigator.language?.slice(0, 2) || "en",
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
    }, delay);

  } catch (err) {
    removeTyping();
    addMessage("ai", "…connection feels unstable.");
  }
};

/* ======================
   MESSAGE RENDER (AVATAR AI)
====================== */
function addMessage(role, text) {
  const chat = $("chat");
  if (!chat) return;

  const div = document.createElement("div");
  div.className = `message ${role}`;

  if (role === "ai" && selectedCharacter) {
    div.innerHTML = `
      <div style="display:flex;gap:10px;align-items:flex-start;">
        <img src="${getCharacterImage(selectedCharacter.name)}"
             style="width:34px;height:34px;border-radius:50%;object-fit:cover;" />
        <div>${text}</div>
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

  if (!input) return;

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      window.sendMessage();
    }
  });
});
