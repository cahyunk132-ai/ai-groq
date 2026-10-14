#!/bin/bash
SESSION="${SESSION:-omnibot}"
CMD="${1:-npm start}"

if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "Sesi tmux '$SESSION' sudah berjalan. Jalankan 'tmux attach -t $SESSION' untuk melihat."
else
  # Buat sesi tmux dengan auto-restart loop jika bot disconnect
  tmux new-session -d -s "$SESSION"
  tmux send-keys -t "$SESSION" "cd /root/wsbot && while true; do $CMD; echo 'Bot terputus. Mencoba reconnect dalam 35 detik...'; sleep 35; done" C-m
  echo "OmniBot berhasil dijalankan di background dalam sesi tmux '$SESSION' ($CMD)!"
  echo "Dilengkapi fitur auto-reconnect jika koneksi server terputus."
  echo "Gunakan 'tmux attach -t $SESSION' untuk melihat console bot."
  echo "Gunakan 'tmux kill-session -t $SESSION' untuk menghentikan bot."
fi
