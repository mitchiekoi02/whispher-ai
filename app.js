import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  "https://zhdvwebtxiejrssudulj.supabase.co",
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoZHZ3ZWJ0eGllanJzc3VkdWxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NTE2MDUsImV4cCI6MjA5NjMyNzYwNX0.a2s-fwh7_SRSlTGqDl9ppiY6heKfYR-_Jxy7iERub6E"
);

let user = null;
let selectedCharacter = null;
let characters = [];

/* ---------------- AUTH ---------------- */

window.signup = async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  await supabase.auth.signUp({ email, password });
  alert("Signed up! Now login.");
};

window.login = async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const res = await supabase.auth.signInWithPassword({ email, password });
  user = res.data.user;

  loadCharacters();
};

/* ---------------- CHARACTERS ---------------- */

async function loadCharacters() {
  const { data } = await supabase.from("characters").select("*");
  characters = data;

  document.getElementById("loginBox").classList.add("hidden");
  document.getElementById("characterBox").classList.remove("hidden");
}

window.selectCharacter = (i) => {
  selectedCharacter = characters[i];

  document.getElementById("characterBox").classList.add("hidden");
  document.getElementById("chatBox").classList.remove("hidden");
};

/* ---------------- CHAT ---------------- */

window.sendMessage = async () => {
  const text = document.getElementById("msg").value;

  renderMessage("user", text);

  await supabase.from("messages").insert({
    user_id: user.id,
    character_id: selectedCharacter.id,
    role: "user",
    content: text
  });

  const { data: mem } = await supabase
    .from("memories")
    .select("*")
    .eq("user_id", user.id)
    .eq("character_id", selectedCharacter.id);

  const memoryText = mem?.map(m => m.memory_text).join(", ") || "";

  const prompt = `
${selectedCharacter.system_prompt}

Memory:
${memoryText}

User: ${text}
Respond naturally as the character.
`;

  const reply = await callGemini(prompt);

  renderMessage("ai", reply);

  await supabase.from("messages").insert({
    user_id: user.id,
    character_id: selectedCharacter.id,
    role: "ai",
    content: reply
  });

  document.getElementById("msg").value = "";
};

function renderMessage(role, text) {
  const div = document.createElement("div");
  div.className = "msg " + role;
  div.innerText = (role === "user" ? "You: " : "AI: ") + text;
  document.getElementById("chat").appendChild(div);
}

/* ---------------- GEMINI ---------------- */

async function callGemini(prompt) {
  const API_KEY = "YOUR_GEMINI_API_KEY";

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    }
  );

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text;
}
