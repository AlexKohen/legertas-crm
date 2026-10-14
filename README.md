# Legertas.lt CRM

Private CRM for Legertas.lt, deployed on the existing Vercel project.

## Required Vercel environment variables

- `DATABASE_URL`: Neon PostgreSQL connection string.
- `AUTH_PASSWORD_HASH`: scrypt password hash for the only allowed user.
- `AUTH_SESSION_SECRET`: strong random secret for signed session cookies.

The only permitted login email is:

```text
droneai@legertas.ai
```

## Deployment

1. Keep using the existing GitHub repository and Vercel project.
2. Create or connect a Neon PostgreSQL database.
3. Add the environment variables above in Vercel Project Settings.
4. Redeploy the existing Vercel project.
5. Sign in at `/login`.

The application creates its PostgreSQL tables automatically on first API request.

## Local generated credentials

Generated credentials are stored locally and are not committed:

```text
.credentials/legertas-crm-login.txt
```

Use the `AUTH_PASSWORD_HASH` and `AUTH_SESSION_SECRET` values from that file for Vercel. Retrieve the plaintext password from the same file only when adding it to a password manager, then keep the file private or delete it after the password has been stored safely.

## Backup

The previous Motivapp application was backed up locally before replacement:

```text
backups/motivapp-20261014
```
