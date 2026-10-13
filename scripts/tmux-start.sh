#!/bin/bash
SESSION="omnibot"

if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "Sesi tmux '$SESSION' sudah berjalan. Jalankan 'npm run tmux:attach' untuk melihat."
else
  # Buat sesi tmux dengan auto-restart loop jika bot disconnect
  tmux new-session -d -s "$SESSION"
  tmux send-keys -t "$SESSION" "cd /root/wsbot && while true; do npm start; echo 'Bot terputus. Mencoba reconnect dalam 35 detik...'; sleep 35; done" C-m
  echo "OmniBot berhasil dijalankan di background dalam sesi tmux '$SESSION'!"
  echo "Dilengkapi fitur auto-reconnect jika koneksi server terputus."
  echo "Gunakan 'npm run tmux:attach' untuk melihat console bot."
  echo "Gunakan 'npm run tmux:stop' untuk menghentikan bot."
fi
