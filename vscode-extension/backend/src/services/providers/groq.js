// Groq Cloud — OpenAI-compatible endpoint
// Fast inference, free tier available at console.groq.com
const BASE    = "https://api.groq.com/openai/v1/chat/completions";
const MODEL   = process.env.GROQ_MODEL   || "llama-3.3-70b-versatile";
const API_KEY = process.env.GROQ_API_KEY;

function headers() {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${API_KEY}`,
  };
}

export async function complete(prompt) {
  const res = await fetch(BASE, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Groq error: ${res.status} ${JSON.stringify(err)}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

export async function* stream(prompt) {
  const res = await fetch(BASE, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      stream: true,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Groq stream error: ${res.status} ${JSON.stringify(err)}`);
  }

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of decoder.decode(value).split("\n")) {
      if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
      try {
        const json  = JSON.parse(line.slice(6));
        const token = json.choices?.[0]?.delta?.content;
        if (token) yield token;
      } catch { /* skip */ }
    }
  }
}