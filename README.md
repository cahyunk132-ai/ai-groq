# ai-groq

Bot Minecraft otonom yang memakai **loop OODA** (Observe, Orient, Decide, Act):

- **Mineflayer** (Node.js) menjadi tubuh bot: melihat dunia, berjalan, menambang, bertarung, bertani.
- **Groq** menjadi otak: menerima state game dalam JSON dan membalas satu aksi dalam format JSON.
- Setiap keputusan Groq **divalidasi** terhadap state saat ini sebelum dijalankan. Jika Groq gagal atau
  memberi keputusan yang tidak masuk akal, bot memakai kebijakan cadangan berbasis aturan.

> Catatan: panduan awal menyebut Baritone. Baritone adalah mod untuk klien Java, sedangkan proyek ini
> memakai `mineflayer-pathfinder` agar berjalan di Node.js.

## Struktur

```
src/
  index.js      titik masuk: membuat bot dan menjalankan loop
  config.js     membaca konfigurasi dari .env
  state.js      OBSERVE + state parser -> JSON ringkas untuk Groq
  prompts.js    system prompt dan user prompt
  groq.js       klien Groq (fetch bawaan, tanpa SDK)
  brain.js      DECIDE: Groq -> validasi -> penyaring keselamatan (atau cadangan)
  actions.js    validasi JSON keputusan terhadap state
  policy.js     kebijakan cadangan dan penimpaan keselamatan (HP kritis)
  executor.js   ACT: menerjemahkan aksi menjadi perintah Mineflayer
  loop.js       loop OODA
  constants.js  ambang batas dan daftar blok/mob
test/           unit test (tanpa server Minecraft dan tanpa jaringan)
```

## Aksi yang didukung

| Aksi      | Target                         | Keterangan                                              |
|-----------|--------------------------------|---------------------------------------------------------|
| `explore` | -                              | Berjalan acak di sekitar bot                            |
| `mine`    | `[x, y, z]` dari `nearbyBlocks.ores` | Memakai pickaxe terbaik                          |
| `attack`  | id entitas dari `nearbyEntities`    | Hanya mob agresif; mob pasif hanya saat lapar; pemain dilarang |
| `farm`    | `[x, y, z]` tanaman matang atau farmland | Panen tanaman `age` maksimal, atau menanam bibit |
| `eat`     | `item_to_use` dari inventory   | Memakan makanan                                         |
| `flee`    | `[x, y, z]` atau `null`        | Kabur dari musuh terdekat                               |

Validasi memastikan koordinat dan id benar-benar ada di state. Groq tidak bisa meminta blok atau entitas
yang tidak terlihat oleh bot.

## Aturan keselamatan

- HP di bawah 30% dan musuh agresif dalam 4 blok: aksi dipaksa menjadi `flee`.
- HP di bawah 30% tanpa musuh dekat dan ada makanan: aksi dipaksa menjadi `eat`.
- Jika Groq timeout, error HTTP, atau JSON tidak valid: kebijakan cadangan berbasis aturan dipakai.

## Menjalankan

Butuh Node.js 18 atau lebih baru dan server Minecraft (Java Edition).

```bash
npm install
cp .env.example .env     # isi GROQ_API_KEY dan data server
npm test                 # unit test
npm start
```

Variabel penting di `.env`:

| Variabel          | Default                  | Keterangan                                                   |
|-------------------|--------------------------|--------------------------------------------------------------|
| `GROQ_API_KEY`    | -                        | Wajib                                                        |
| `GROQ_MODEL`      | `openai/gpt-oss-120b`    | Model Groq. `llama-3.3-70b-versatile` sudah dihentikan Groq pada 2026-08-16 |
| `MC_HOST`/`MC_PORT` | `localhost` / `25565`  | Alamat server                                                |
| `MC_AUTH`         | `offline`                | `offline` untuk server non-premium/LAN, `microsoft` untuk akun resmi |
| `LOOP_TICK_MS`    | `3000`                   | Jeda antar keputusan. Free tier Groq dibatasi 30 request/menit, jadi jangan lebih kecil dari 2000 |

## Batasan yang perlu diketahui

- Kode ini belum diuji langsung terhadap server Minecraft. Unit test mencakup validasi, kebijakan,
  state (dengan bot palsu), klien Groq (dengan fetch palsu), dan loop.
- Pembuatan alat baru (crafting) belum ada. Bot hanya memberi peringatan dan melewati `mine` jika
  pickaxe tersisa di bawah 10 durability.
- Bot tidak memakai "task" sebagai rencana panjang. Groq memutuskan satu aksi per tick, dan
  `currentTaskPriority` hanya ringkasan untuk membantu keputusan.
- Bot berkeliaran dan menyerang mob. Gunakan server pribadi atau server yang mengizinkan bot.
