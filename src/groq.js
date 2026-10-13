// Klien Groq (endpoint kompatibel OpenAI). Tidak butuh SDK tambahan; memakai fetch bawaan Node.
import { config as defaultConfig } from './config.js';

/** Budget token termasuk token reasoning. Dibuat secukupnya agar tidak kena limit TPM. */
export const MAX_COMPLETION_TOKENS = 1024; // Groq menghitung max_tokens ke kuota TPM

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

/** Model gpt-oss adalah model reasoning; untuk tugas klasifikasi cukup reasoning "low". */
export function buildRequestBody({ model, messages }) {
  const body = {
    model,
    messages,
    temperature: 0.2,
    max_tokens: MAX_COMPLETION_TOKENS,
    response_format: { type: 'json_object' },
  };
  if (model.startsWith('openai/gpt-oss')) body.reasoning_effort = 'low';
  return body;
}

async function callOnce(fetchImpl, url, apiKey, body, timeoutMs) {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Bukan JSON; pakai teks mentah di pesan error.
    }
    const err = parsed?.error;
    if (err?.code === 'json_validate_failed') {
      // Groq mengembalikan hasil generasi mentah. Coba selamatkan jika itu JSON yang utuh.
      const salvaged = typeof err.failed_generation === 'string' && err.failed_generation.trim()
        ? tryParse(err.failed_generation)
        : null;
      if (salvaged) return { salvaged };
      const error = new Error(`Groq json_validate_failed: ${String(err.failed_generation ?? '').slice(0, 120)}`);
      error.retryable = true;
      throw error;
    }
    throw new Error(`Groq HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('respons Groq tidak berisi konten');
  return { content };
}

function tryParse(text) {
  try {
    return parseJsonLoose(text);
  } catch {
    return null;
  }
}

/**
 * Mengirim percakapan ke Groq dan mengembalikan objek JSON hasil balasan.
 * Jika JSON gagal divalidasi Groq, dicoba satu kali lagi.
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
    retries = 1,
  } = opts;

  if (!apiKey) throw new Error('GROQ_API_KEY belum diset');

  const url = `${baseUrl}/chat/completions`;
  const body = buildRequestBody({ model, messages });

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await callOnce(fetchImpl, url, apiKey, body, timeoutMs);
      if (result.salvaged !== undefined) return result.salvaged;
      return parseJsonLoose(result.content);
    } catch (err) {
      lastError = err;
      if (!err.retryable) break;
    }
  }
  throw lastError;
}
