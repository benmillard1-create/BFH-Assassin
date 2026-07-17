BFH Assassin — Sprint 1

1. Open config.js.
2. Replace PASTE_YOUR_ANON_KEY_HERE with your Supabase anon key.
3. Upload index.html, styles.css, config.js and app.js to one GitHub repository.
4. Enable GitHub Pages from the main branch.
5. Open the Pages link on two devices to test create/join/lobby.

Expected tables:
games: id, code, host_name, status, created_at
players: id, game_id, name, alive
missions: id, player_id, target, object, room
