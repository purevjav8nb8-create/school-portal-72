# Backend database migrations

Run each SQL migration in the Supabase project's SQL Editor before deploying the matching backend changes. The chat API accesses these tables through the backend service-role client; do not expose service-role credentials to the frontend.

Portal72 browser-extension credentials stay in the user's browser, encrypted with a vault master password. Do not create Supabase columns or tables for Gmail, Mozaik, Medle, ESIS, or LMS passwords. The extension requires no database migration.
