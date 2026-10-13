// Klien Groq (endpoint kompatibel OpenAI). Tidak butuh SDK tambahan; memakai fetch bawaan Node.
import { config as defaultConfig } from './config.js';

/** Mengurai teks menjadi JSON. Menerima JSON yang dibungkus teks tambahan. */
export function parseJsonLoose(text) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error('respons Groq bukan JSON yang valid');
  }
}

/**
 * Mengirim percakapan ke Groq dan mengembalikan objek JSON hasil balasan.
 * @param {Array<{role:string,content:string}>} messages
 * @param {object} [opts]
 */
export async function askGroq(messages, opts = {}) {
  const {
    apiKey = defaultConfig.groq.apiKey,
    model = defaultConfig.groq.model,
    baseUrl = defaultConfig.groq.baseUrl,
    timeoutMs = defaultConfig.groq.timeoutMs,
    fetchImpl = fetch,
  } = opts;

  if (!apiKey) throw new Error('GROQ_API_KEY belum diset');

  const res = await fetchImpl(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      max_tokens: 800,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Groq HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('respons Groq tidak berisi konten');
  return parseJsonLoose(content);
}
