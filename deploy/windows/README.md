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

## Storage choices

- Keep one Node runtime and use it for both processes.
- Use `npm ci --omit=dev` for the bridge.
- Keep PostgreSQL data outside the application package and back it up with
  `pg_dump`.
- Do not copy `.next/cache`, source maps, tests, or package manager caches.
- Keep game logs and append-only event files on a separate volume or rotate
  them regularly; those files can outgrow the application itself.
