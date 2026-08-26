# PostgreSQL setup for TPNIsleControl

The bridge can use PostgreSQL for quest progress, token balances, players, and
multiple dinosaurs per player. Live positions and the `/players` response remain in memory for
low latency. Snapshot writes are grouped on a timer; quest and token changes are
queued immediately, and claims write quest and balance changes in one transaction.

## Requirements

- PostgreSQL 16 or newer (PostgreSQL 18 is recommended for a new installation)
- Node.js 20 or newer (the bundled TPNIsleControl runtime is supported)
- An SSD or NVMe volume for the PostgreSQL data directory
- Local TCP access from the bridge to PostgreSQL, normally port `5432`
- Bridge dependencies installed with `npm install` in `TPNIsleControl\bridge`

## 1. Install PostgreSQL on Windows Server

Download the Windows installer from <https://www.postgresql.org/download/windows/>.
Install the PostgreSQL Server and command-line tools. pgAdmin is optional. Keep
PostgreSQL bound to localhost when the bridge and database run on the same server;
do not expose port 5432 to the public internet.

Record the administrator password in the server's password manager. Do not put it
in Git.

## 2. Create the database and restricted user

Open **SQL Shell (psql)** as the PostgreSQL administrator and run the following.
Replace the sample password with a generated password:

```sql
CREATE ROLE tpnislecontrol LOGIN PASSWORD 'REPLACE_WITH_A_LONG_RANDOM_PASSWORD';
CREATE DATABASE tpnislecontrol OWNER tpnislecontrol;
```

The bridge applies the single idempotent schema in
`bridge\sql\001_initial.sql` before opening its HTTP listener. The database user
owns only this application database.

## 3. Install bridge dependencies

From Command Prompt:

```bat
cd /d D:\TheIsleServer\TPNIsleControl\bridge
..\runtime\node\npm.cmd install --omit=dev
```

The required PostgreSQL driver is the `pg` package recorded in `package-lock.json`.

## 4. Configure the bridge

Set these fields in `bridge\config.json`:

```json
{
  "databasePoolSize": 10,
  "snapshotFlushMs": 5000
}
```

Keep the password out of `config.json`. Set the connection URL in the account that
runs the game server:

```bat
setx DATABASE_URL "postgresql://tpnislecontrol:URL_ENCODED_PASSWORD@127.0.0.1:5432/tpnislecontrol"
```

Restart the server process after `setx`; it does not change already-running
processes. Characters such as `@`, `:`, `/`, `?`, and `#` in the password must be
URL-encoded. `DATABASE_URL` is the only supported bridge database configuration.

## 5. First start

Start the bridge normally. It checks the PostgreSQL connection and applies the
single schema before opening the listener. There is no local state file, JSON
import, or JSON rollback path.

## 6. Verify the installation

Check the bridge console and health endpoint:

```bat
curl http://127.0.0.1:31990/health
```

The response must contain `"storage": "postgresql"` and
`"databaseConnected": true`. In `psql`, verify rows:

```sql
\c tpnislecontrol
SELECT count(*) FROM tpn_players;
SELECT count(*) FROM tpn_dinosaurs;
SELECT count(*) FROM tpn_quest_progress;
SELECT count(*) FROM tpn_token_balances;
```

Accept and complete a test quest, restart only the bridge, and verify that quest
progress and the token balance remain available.

Each dinosaur is keyed by `(steam_id, dinosaur_id)`. The snapshot producer must
send a stable `dinosaurId` to distinguish slots.

## Operations and performance

- Keep `databasePoolSize` at 10 unless measurements show connection contention.
- `snapshotFlushMs: 5000` batches durable player snapshots every five seconds.
  Lower values increase disk writes; higher values increase the recent snapshot
  data that can be lost in an abrupt shutdown.
- Quest/token writes use normal durable PostgreSQL commits. Do not disable `fsync`.
- Back up the database with `pg_dump`; copying live database files is not a backup.
- Monitor disk space, PostgreSQL logs, connection count, and backup success.
- For a remote database, require TLS and firewall port 5432 to the bridge host only.

Example backup:

```bat
pg_dump -Fc -d "postgresql://tpnislecontrol@127.0.0.1:5432/tpnislecontrol" -f D:\Backups\tpnislecontrol.dump
```

## Restore

Restore a PostgreSQL custom-format dump with `pg_restore` while the services are
stopped. NDJSON is only a game transport fallback; it is not a backup or durable
store.

## Integration tests

PostgreSQL integration tests run only when `TEST_DATABASE_URL` points to a
disposable test database. They never fall back to the bridge's normal
`DATABASE_URL`; without `TEST_DATABASE_URL`, `npm test` reports those tests as
skipped while running the unit suite.
