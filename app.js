import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  "https://zhdvwebtxiejrssudulj.supabase.co",
  "YOUR_SUPABASE_ANON_KEY"
);

let user = null;
let selectedCharacter = null;
let characters = [];

/* =========================
   LANGUAGE SYSTEM
========================= */

function getLanguage() {
  return localStorage.getItem("lang") || navigator.language?.slice(0, 2) || "en";
}

document.getElementById("langSelect")?.addEventListener("change", (e) => {
  localStorage.setItem("lang", e.target.value);
});

/* =========================
   AUTH
========================= */

window.signup = async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    alert(error.message);
    return;
  }

  alert("Signed up! Now login.");
};

window.login = async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    alert(error.message);
    return;
  }

  user = data.user;
  loadCharacters();
};

/* =========================
   CHARACTERS
========================= */

async function loadCharacters() {
  const { data, error } = await supabase.from("characters").select("*");

  if (error) {
    alert(error.message);
    return;
  }

  characters = data || [];

  document.getElementById("loginBox").classList.add("hidden");
  document.getElementById("characterBox").classList.remove("hidden");

  renderCharacterList();
}

function renderCharacterList() {
  const container = document.getElementById("characterBox");
  container.innerHTML = "<h2>Choose Companion</h2>";

  characters.forEach((char, index) => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerText = `${char.name} (${char.trait || "Companion"})`;
    div.onclick = () => selectCharacter(index);
    container.appendChild(div);
  });
}

window.selectCharacter = (i) => {
  selectedCharacter = characters[i];

  document.getElementById("characterBox").classList.add("hidden");
  document.getElementById("chatBox").classList.remove("hidden");

  document.getElementById("chat").innerHTML = "";
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
      "https://YOUR_PROJECT.functions.supabase.co/whisper-chat",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      throw new Error(data.error || "AI request failed");
    }

    renderMessage("ai", data.reply);

    // Optional: future voice hook
    // playVoice(data.reply, data.voice?.voice_id);

  } catch (err) {
    renderMessage("ai", "Sorry, something went wrong.");
    console.error(err);
  }
};

/* =========================
   UI
========================= */

function renderMessage(role, text) {
  const div = document.createElement("div");
  div.className = "msg " + role;

  div.innerText = (role === "user" ? "You: " : "AI: ") + text;

  document.getElementById("chat").appendChild(div);

  // auto scroll
  const chat = document.getElementById("chat");
  chat.scrollTop = chat.scrollHeight;
}
