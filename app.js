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
   CHARACTERS
====================== */
async function loadCharacters() {
  const { data, error } = await supabase
    .from("characters")
    .select("id,name,archetype,system_prompt,voice_id,image_url");

  if (error) {
    console.error(error);
    return alert(error.message);
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

    const imgSrc = c.image_url?.startsWith("http")
      ? c.image_url
      : c.image_url?.startsWith("./")
        ? c.image_url
        : `./${c.image_url}`; // SAFE fallback for GitHub Pages

    div.innerHTML = `
      <div class="character-image">
        <img src="${imgSrc}" alt="${c.name}" />
      </div>
      <h3>${c.name}</h3>
      <p>${c.archetype || ""}</p>
    `;

    div.onclick = () => selectCharacter(c);
    grid.appendChild(div);
  });
}

function selectCharacter(c) {
  if (!c?.id) return;

  selectedCharacter = c;

  $("characterBox")?.classList.add("hidden");
  $("chatBox")?.classList.remove("hidden");

  $("charName").innerText = c.name;

  $("chat").innerHTML = "";

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

    /* OPTIONAL AUDIO SUPPORT */
    if (data.audio) {
      if (currentAudio) currentAudio.pause();

      currentAudio = new Audio(data.audio);
      currentAudio.play().catch(() => {
        console.log("Autoplay blocked");
      });
    }

  } catch (err) {
    console.error(err);
    addMessage("ai", "Network error. Try again.");
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
