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
  policy.js     kebijakan cadangan (kebun, alat, tambang, bangun, chat, jeda menoleh) dan penimpaan keselamatan
  budget.js     pembatas panggilan Groq (jadwal, kuota harian, jeda setelah 429)
  build.js      template bangunan (platform, shelter, tower, wall) sebagai grid per lapisan
  site.js       pemilihan lokasi bangunan (tanah rata, ruang kosong, dekat bangunan sebelumnya)
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
- Penambangan tidak membuat lubang lurus ke bawah. Pathfinder tidak boleh menggali ke bawah (`src/movements.js`). Ore yang dalam dicapai dengan tangga menurun yang menggali ke arah ore, dan dibatalkan jika ada lava atau air. Ore lebih dari 12 blok di bawah kaki diabaikan.
- Groq tidak dipanggil di setiap tick. Panggilan dijadwalkan (rencana tiap 5 menit, chat tiap 1 menit) dan dibatasi kuota harian. Di antaranya, kebijakan cadangan yang menjalankan bot.

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
| `LOOP_TICK_MS`    | `3000`                   | Jeda antar tick (aksi). Groq tidak dipanggil di setiap tick |
| `GROQ_DAILY_CALL_CAP` | `50`                 | Maksimal panggilan Groq per hari (UTC). Free tier 200K token/hari, satu panggilan ~3100 token |
| `GROQ_PLAN_INTERVAL_MS` | `300000`           | Jeda minimal antar panggilan Groq untuk rencana biasa (5 menit) |
| `GROQ_CHAT_INTERVAL_MS` | `60000`            | Jeda minimal antar panggilan Groq saat ada chat yang belum dijawab (1 menit) |
| `GROQ_USAGE_FILE` | `.groq-usage.json`         | Berkas hitungan kuota harian, agar tetap terhitung setelah restart |

## Batasan yang perlu diketahui

- Kode ini belum diuji langsung terhadap server Minecraft. Unit test mencakup validasi, kebijakan,
  state (dengan bot palsu), klien Groq (dengan fetch palsu), dan loop.
- Pembuatan alat baru (crafting) belum ada. Bot hanya memberi peringatan dan melewati `mine` jika
  pickaxe tersisa di bawah 10 durability.
- Bot tidak memakai "task" sebagai rencana panjang. Groq memutuskan satu aksi per tick, dan
  `currentTaskPriority` hanya ringkasan untuk membantu keputusan.
- Bot berkeliaran dan menyerang mob. Gunakan server pribadi atau server yang mengizinkan bot.
