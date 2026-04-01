const BASE    = "https://api.openai.com/v1/chat/completions";
const MODEL   = process.env.OPENAI_MODEL   || "gpt-4o-mini";
const API_KEY = process.env.OPENAI_API_KEY;

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
  if (!res.ok) throw new Error(`OpenAI error: ${res.status} ${res.statusText}`);
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
  if (!res.ok) throw new Error(`OpenAI stream error: ${res.status}`);

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