# Local Supabase Setup

This project can run fully against a local Supabase stack for safer schema work.

## What You Need

- Docker Desktop running.
- Supabase CLI available through `npx supabase` or installed globally.
- Node dependencies installed with `npm install`.

Current local ports from `supabase/config.toml`:

| Service | URL |
|---|---|
| API | `http://127.0.0.1:54321` |
| DB | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Studio | `http://127.0.0.1:54323` |
| Inbucket email UI | `http://127.0.0.1:54324` |
| Web app | `http://127.0.0.1:3000` |

## Start Local Supabase

1. Open Docker Desktop.
2. Wait until Docker says it is running.
3. From the repo root:

```bash
npm run supabase:start
```

If this is the first start, Supabase will download Docker images and apply every file in `supabase/migrations/`.

## Get Local Keys

After start finishes, run:

```bash
npm run supabase:status
```

Copy these values from the output:

- `API URL`
- `anon key`
- `service_role key`

## Configure the Web App for Local Supabase

Create or edit `.env.local` in the repo root:

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=PASTE_LOCAL_ANON_KEY_HERE
```

Use the local `anon key` from `npm run supabase:status` as `VITE_SUPABASE_PUBLISHABLE_KEY`.

Do not put the service role key in `.env.local`; the browser must never receive it.

## Configure Local Edge Functions If Needed

`supabase start` normally starts the local functions runtime. If you want to serve functions manually, copy:

```bash
cp supabase/local.env.example supabase/local.env
```

Then fill `supabase/local.env`:

```bash
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=PASTE_LOCAL_ANON_KEY_HERE
SUPABASE_SERVICE_ROLE_KEY=PASTE_LOCAL_SERVICE_ROLE_KEY_HERE
OPENAI_API_KEY=
```

Manual function serving command:

```bash
npx supabase functions serve --env-file supabase/local.env
```

## Run the App Locally

In another terminal:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:3000
```

## Reset Local Database

Use this after changing migrations or when local data can be discarded:

```bash
npm run supabase:reset
```

This drops local data, reapplies all migrations, and runs `supabase/seed.sql`.

## Check Migration State

Local:

```bash
npm run supabase:migrations
```

Remote:

```bash
npx supabase migration list --linked
```

Note: this repo has older migration history drift between local filenames and the remote project. The latest growth migration is aligned, but avoid `supabase db push --include-all` unless the drift is intentionally repaired first.

## Stop Local Supabase

```bash
npm run supabase:stop
```

## Troubleshooting

### Docker daemon error

Error:

```text
Cannot connect to the Docker daemon
```

Fix:

1. Open Docker Desktop.
2. Wait until Docker is fully running.
3. Run `npm run supabase:start` again.

### Port already in use

If ports `54321`, `54322`, `54323`, or `54324` are occupied, either stop the process using the port or change the matching port in `supabase/config.toml`.

### Remote DB password error

If `supabase db push --linked` asks for `SUPABASE_DB_PASSWORD`, that is for the hosted remote database. It is not needed for normal local development.

## Values You Need To Fill

For normal local web development, you only need:

- `.env.local` -> `VITE_SUPABASE_PUBLISHABLE_KEY`

For manual local Edge Function serving, you also need:

- `supabase/local.env` -> `SUPABASE_ANON_KEY`
- `supabase/local.env` -> `SUPABASE_SERVICE_ROLE_KEY`

All of these are printed by `npm run supabase:status` after local Supabase starts.
