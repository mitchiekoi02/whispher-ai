import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  "https://zhdvwebtxiejrssudulj.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoZHZ3ZWJ0eGllanJzc3VkdWxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NTE2MDUsImV4cCI6MjA5NjMyNzYwNX0.a2s-fwh7_SRSlTGqDl9ppiY6heKfYR-_Jxy7iERub6E"
);

let user = null;
let characters = [];
let selectedCharacter = null;

/* ======================
   HELPERS
====================== */

const $ = (id) => document.getElementById(id);

/* ======================
   AUTH
====================== */

window.signup = async () => {
  const emailVal = $("email").value;
  const passVal = $("password").value;

  const { error } = await supabase.auth.signUp({
    email: emailVal,
    password: passVal,
  });

  if (error) return alert(error.message);

  alert("Check email then login.");
};

window.login = async () => {
  const emailVal = $("email").value;
  const passVal = $("password").value;

  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailVal,
    password: passVal,
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
  const { data, error } = await supabase
    .from("characters")
    .select("*");

  if (error) return alert(error.message);

  characters = data || [];

  renderCharacters();
}

function renderCharacters() {
  const grid = $("characterGrid");
  grid.innerHTML = "";

  characters.forEach((c) => {
    const div = document.createElement("div");
    div.className = "character-card";

    div.innerHTML = `
      <h3>${c.name}</h3>
      <p>${c.trait || ""}</p>
    `;

    div.onclick = () => selectCharacter(c);

    grid.appendChild(div);
  });
}

function selectCharacter(c) {
  if (!c) return;

  selectedCharacter = c;

  $("characterBox").classList.add("hidden");
  $("chatBox").classList.remove("hidden");

  $("charName").innerText = c.name;

  $("chat").innerHTML = "";
}

/* ======================
   CHAT
====================== */

window.sendMessage = async () => {
  const input = $("msg");
  const text = input.value.trim();

  if (!text || !user || !selectedCharacter) return;

  addMessage("user", text);
  input.value = "";

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

    if (!data.ok) {
      addMessage("ai", "Error: " + data.error);
      return;
    }

    addMessage("ai", data.reply);

  } catch (err) {
    console.error(err);
    addMessage("ai", "Something went wrong.");
  }
};

/* ======================
   UI
====================== */

function addMessage(role, text) {
  const chat = $("chat");

  const div = document.createElement("div");
  div.className = `message ${role}`;
  div.textContent = text;

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}
