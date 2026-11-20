# Backend database migrations

Run each SQL migration in the Supabase project's SQL Editor before deploying the matching backend changes. The chat API accesses these tables through the backend service-role client; do not expose service-role credentials to the frontend.

`20261113_usage_sizes.sql` adds the service-role-only RPC used by the data usage panel to read database and Storage sizes.

`20261120_teacher_attendance.sql` moves attendance records from Auth `app_metadata` to a service-role-only table and copies existing records.

`20261119_school_public_holidays.sql` creates the service-role-only annual public-holiday calendar. Authenticated users can view holiday markers; only the primary admin can add or remove dates.

`20261120_program_plan_approval_assets.sql` moves each manager's program-plan signature and stamp URLs out of Auth metadata into a service-role-only table. Existing image URLs are copied; each manager must reopen the signature/stamp settings and save once to create the transparent composite PNG before approving a plan.

`20261121_teacher_portal_records.sql` moves program plans, training, evaluations, activities, awards, professional degrees, teaching classes, survey responses, announcements, surveys, and teacher directory profiles into separate service-role-only PostgreSQL tables. Existing data is backfilled before the large Auth metadata keys are removed.

`20261122_school_schedule_and_years.sql` stores editable school-year terms, manager-imported teacher schedules, and monthly substitute-hour totals in service-role-only tables.

Back up the Supabase project first. Pause writes briefly, then run `20261119_school_public_holidays.sql`, `20261120_teacher_attendance.sql`, `20261120_program_plan_approval_assets.sql`, `20261121_teacher_portal_records.sql`, and `20261122_school_schedule_and_years.sql` in the Supabase SQL Editor, in that order. Deploy/restart the matching backend only after all scripts succeed, then verify public holidays, teacher lists, attendance, plans, announcements, surveys, and schedules before resuming normal use.

For new teachers created without an explicitly supplied password, configure the Supabase Auth Site URL and allowed redirect URLs so `invite_user_by_email` links return to the portal. The API no longer returns generated passwords.

The Render Free service can sleep, so its midnight scheduler is not guaranteed to run on time. The attendance listing still fills any missing record when the service wakes; use an always-on plan or an external scheduled job if exact midnight execution is required.

Portal72 browser-extension credentials stay in the user's browser, encrypted with a vault master password. Do not create Supabase columns or tables for Gmail, Mozaik, Medle, ESIS, or LMS passwords. The extension requires no database migration.
