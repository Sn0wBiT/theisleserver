# Windows Server deployment

This layout keeps the game server and persistent data on the existing game
volume while deploying only the production runtime for the web app and bridge.
It does not copy `node_modules`, source files, tests, or the Next.js build cache
to the host.

## Target layout

```text
D:\TheIsleServer\
  TheIsleServer.exe                 # existing game server installation
  TheIsle\...                       # existing game/mod files
  TPNIsleControl\bridge\           # bridge source + production dependencies
  TPNIsleControl\runtime\node\     # one shared Node runtime
  apps\tpn-dino\                   # Next standalone runtime
  config\tpn-dino.env              # secrets, created on the host
  logs\
```

Use `Deploy-TPNIsleServer.ps1` from a Windows checkout to build and copy the
small runtime packages. Run PowerShell as an administrator only when creating
startup tasks; the build/copy step itself does not require elevation.

## One-time host setup

1. Install SteamCMD and PostgreSQL on the data/system volume. Use one
   PostgreSQL instance with separate databases for the web app and bridge.
2. Ensure the repository contains the Windows Node runtime at
   `TPNIsleControl\runtime\node\node.exe`, or install Node 20+ and pass its
   path to the deploy script.
3. From the repository root, run:

   ```powershell
   .\deploy\windows\Deploy-TPNIsleServer.ps1 -DestinationRoot D:\TheIsleServer
   ```

4. Copy `config\tpn-dino.env.example` to `config\tpn-dino.env` and fill in
   secrets and database URLs. Set the same bridge token in `config\bridge.json`.
5. Copy `TPNIsleControl\bridge\config.example.json` to `config\bridge.json`,
   set its `modSavedDir` to the real absolute path, and point the bridge start
   script at it with `TPNISLECONTROL_CONFIG`.
6. Run `Register-TPNIsleTasks.ps1` as Administrator. It creates two Task
   Scheduler tasks that start at boot and restart after a crash. The game
   server remains controlled by the existing `start.bat` update/restart loop.

The bridge and Next.js bind to loopback. Expose only the reverse proxy (for
example Caddy) on ports 80/443; do not open bridge port 31990 publicly.

## Proximity voice (release-gated)

1. Create `config\livekit.yaml` from `livekit.yaml.example`, generate a unique API key/secret, restrict the file ACL to Administrators and SYSTEM, and copy the same values to `tpn-dino.env`. Never place the secret in the HUD package.
2. Point the voice DNS name at the public host. Add `Caddyfile.voice.example` to Caddy and verify its trusted certificate before allowing clients.
3. Run `Install-LiveKit.ps1`. It pins v1.9.12, downloads the release's `checksums.txt`, verifies SHA-256 before extraction, and registers a SYSTEM startup task with restart-on-failure.
4. Forward TCP 7881 and 5349 plus UDP 50000-50150 to the host. Allow TCP 443 for signaling through Caddy. Keep 7880 private. If TURN/TLS termination is moved to Caddy, update the LiveKit TURN configuration consistently.
5. Rotate LiveKit logs, monitor CPU/memory, WebRTC packet loss and jitter, and test startup with `Restart-ScheduledTask -TaskName TPN-LiveKit` after every upgrade.

No egress or recording component is installed. Before release, run 150 clients with 10 Hz telemetry and realistic overlapping speech on this exact host. Reject release if game tick stability, session continuity, packet loss/jitter, subscription permissions, or TURN fallback are unacceptable. In that case move LiveKit unchanged to a dedicated Linux VM, update `LIVEKIT_WS_URL`, DNS/NAT, and firewall rules, then repeat the load test. LiveKit's production guidance requires trusted TLS and explicit signaling/WebRTC/TURN exposure; see https://docs.livekit.io/transport/self-hosting/deployment/ and https://docs.livekit.io/transport/self-hosting/ports-firewall/.

## Storage choices

- Keep one Node runtime and use it for both processes.
- Use `npm ci --omit=dev` for the bridge.
- Keep PostgreSQL data outside the application package and back it up with
  `pg_dump`.
- Do not copy `.next/cache`, source maps, tests, or package manager caches.
- Keep game logs and append-only event files on a separate volume or rotate
  them regularly; those files can outgrow the application itself.
