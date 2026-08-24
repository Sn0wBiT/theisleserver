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

The bridge automatically applies the idempotent schema in
`bridge\sql\001_initial.sql` when it connects, so a separate migration command is
not required. The database user owns only this application database.

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
  "storage": "postgres",
  "databasePoolSize": 10,
  "snapshotFlushMs": 5000
}
```

Keep the password out of `config.json`. Set the connection URL in the account that
runs the game server:

```bat
setx TPNISLECONTROL_DATABASE_URL "postgresql://tpnislecontrol:URL_ENCODED_PASSWORD@127.0.0.1:5432/tpnislecontrol"
```

Restart the server process after `setx`; it does not change already-running
processes. Characters such as `@`, `:`, `/`, `?`, and `#` in the password must be
URL-encoded. Alternatively, `databaseUrl` can be placed in `config.json`, but that
file then contains a database credential and must not be committed or shared.

## 5. First start and JSON migration

Start the bridge normally. On its first PostgreSQL start it will:

1. Connect and create/update the required tables.
2. Import the configured `stateFile` (`bridge\data\state.json` by default), if present.
3. Record a `json_import_complete` marker so stale JSON cannot overwrite newer
   PostgreSQL state on later restarts.
4. Log `[store] PostgreSQL connected` before opening the HTTP listener.

The JSON file is retained as a recovery copy but is no longer written while
`storage` is `postgres`. Back it up, then archive it after verifying the import.

## 6. Verify the installation

Check the bridge console and health endpoint:

```bat
curl http://127.0.0.1:31990/health
```

The response must contain `"storage": "postgres"`. In `psql`, verify rows:

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
send a stable `dinosaurId` to distinguish slots. Existing snapshots do not yet
contain such an identifier and are imported into a `legacy` dinosaur slot; pawn
memory addresses are deliberately not used because they change across processes
and reconnects.

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

## Rollback

To temporarily return to the original file store, stop the bridge, change
`"storage"` to `"json"`, and start it again. PostgreSQL changes made after the
initial import are not copied back to `state.json`, so this is an operational
fallback, not a reverse migration.
