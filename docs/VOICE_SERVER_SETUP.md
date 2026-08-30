# Proximity voice server setup

The HUD voice feature needs four running services: the game telemetry bridge,
the `tpn-dino` Next.js API, LiveKit, and Caddy. LiveKit must not be exposed
without trusted TLS, valid secrets, and the firewall/NAT rules below.

## Required files and secrets

1. Install the pinned, checksum-verified LiveKit release from an elevated
   PowerShell window:

   ```powershell
   .\deploy\windows\Install-LiveKit.ps1 -DestinationRoot D:\TheIsleServer -VoiceDomain voice.your-domain.example
   ```

2. The installer creates `D:\TheIsleServer\config\livekit.yaml`, generates a
   random API key/secret, substitutes the supplied voice domain, and removes
   inherited ACLs so only Administrators and SYSTEM can read it. If the file
   already exists, the installer preserves its values and reapplies the ACL.
   Never copy this file into the HUD.

If the generated file is damaged or contains unusable credentials, deliberately
replace it with a fresh, atomically written configuration:

```powershell
.\deploy\windows\Install-LiveKit.ps1 -DestinationRoot D:\TheIsleServer -VoiceDomain voice.your-domain.example -RegenerateConfig
```

This rotates the LiveKit key and secret, so update `config\tpn-dino.env`
immediately afterward and restart Next.js.
4. Set the same API key and secret in `config\tpn-dino.env`, based on
   `deploy\windows\tpn-dino.env.example`:

   ```dotenv
   LIVEKIT_WS_URL=wss://voice.example.com
   LIVEKIT_API_KEY=<generated key from livekit.yaml>
   LIVEKIT_API_SECRET=<generated secret from livekit.yaml>
   LIVEKIT_TOKEN_TTL_SECONDS=120
   ```

5. Set `gameServerId` to the same non-empty value, such as `gateway-1`, in the
   UE4SS mod configuration and bridge configuration. Confirm that
   `QUEST_API_URL` and `QUEST_API_TOKEN` let Next.js reach the private bridge.

## DNS, TLS, firewall, and NAT

- Create an `A`/`AAAA` record for the voice hostname pointing to the public
  server address.
- Add `deploy\windows\Caddyfile.voice.example` to the active Caddyfile and
  verify that Caddy obtains a publicly trusted certificate.
- Forward and allow these inbound ports to the LiveKit host:

  | Protocol | Port(s) | Purpose |
  |---|---:|---|
  | TCP | 443 | Caddy TLS and LiveKit WebSocket signaling |
  | TCP | 7881 | WebRTC over TCP fallback |
  | UDP | 50000-50150 | WebRTC media; sized for the planned 150 users |
  | TCP/UDP | 5349 | Embedded TURN over TLS; match `livekit.yaml` |

- Keep TCP `7880` private/loopback-facing through Caddy. Never expose bridge
  port `31990` or the Next.js internal listener directly to the internet.
- If the machine is behind a router, configure static NAT/port forwarding and
  ensure `rtc.use_external_ip: true` can discover the correct public address.

Example Windows Firewall commands from an elevated PowerShell window:

```powershell
New-NetFirewallRule -DisplayName "TPN LiveKit WebRTC TCP" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 7881
New-NetFirewallRule -DisplayName "TPN LiveKit WebRTC UDP" -Direction Inbound -Action Allow -Protocol UDP -LocalPort 50000-50150
New-NetFirewallRule -DisplayName "TPN LiveKit TURN TCP" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5349
New-NetFirewallRule -DisplayName "TPN LiveKit TURN UDP" -Direction Inbound -Action Allow -Protocol UDP -LocalPort 5349
```

## Startup order

1. PostgreSQL and the game server.
2. `TPNIsleControl` bridge (`start-tpnislecontrol-bridge.cmd`).
3. Next.js API (`scripts\2.start_nextjs.bat` or its scheduled task).
4. LiveKit (`scripts\4.start_voice.bat`). The script starts the
   `TPN-LiveKit` scheduled task when installed and otherwise runs the newest
   local pinned binary directly.
5. Caddy (`scripts\3.start_caddy.bat`).

The normal production setup should use the scheduled tasks so the bridge,
Next.js, and LiveKit restart after crashes and system reboots.

## Checks before players connect

```powershell
Get-ScheduledTask -TaskName TPN-LiveKit | Get-ScheduledTaskInfo
Test-NetConnection voice.example.com -Port 443
Test-NetConnection 127.0.0.1 -Port 7880
Invoke-WebRequest http://127.0.0.1:31990/health -Headers @{ Authorization = "Bearer <bridge token>" }
```

Also verify `https://voice.example.com` has a trusted certificate, inspect
LiveKit/Caddy logs for binding or certificate errors, and test microphone
permission plus TURN fallback from a client outside the server network.

No LiveKit egress or recording service is required or permitted for this
deployment. Before public release, complete the planned 150-client load test
on the game host and confirm acceptable game performance, CPU/memory usage,
packet loss, jitter, subscription isolation, and restart recovery.
