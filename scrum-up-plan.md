# Scrum-Up: Implementation Plan

## Top-Level Overview

**Goal:** Build a centralized agile/scrum workflow management platform called **Scrum-Up** that assists project heads, developers, and super-admins in planning, tracking, and reviewing software projects through sprint-based increments.

**Scope:**
- Greenfield Vue 3 + TypeScript + PrimeVue SPA, deployed on Vercel
- Supabase (PostgreSQL + Auth + Edge Functions) as the backend
- GitHub OAuth for login and repository integration
- OpenAI GPT-4o for AI sprint planning, task-to-developer matching, and sprint summaries
- Full sprint lifecycle: project creation → AI-assisted sprint/task planning → Kanban task tracking → GitHub data pull → metrics charts → AI-generated summaries

**Non-Goals (initial build):**
- Native mobile app
- Real-time collaborative editing (e.g. live cursor presence)
- Custom billing or payment flows

**Role Hierarchy:**
- **Super-Admin** — platform-level administrator; can promote other users to super-admin, designate Project Heads, and manage teams globally
- **Project Head** — can create projects, assign teams, and trigger AI planning; role is context-specific (per project/team)
- **Developer** — works on assigned tasks within sprints; has a developer profile auto-populated from GitHub

---

## Sub-Task 1 — Project Scaffolding

**Status:** `[x] done`

**Intent:**
Set up the complete project foundation so every subsequent sub-task has a consistent, runnable base to build on. This includes the Vue 3 + TypeScript + Vite app, PrimeVue component library, Supabase JS client, environment variable structure, folder layout, and Vercel deployment configuration.

**Expected Outcomes:**
- `npm run dev` starts the app locally with no errors
- PrimeVue components render correctly
- Supabase client initializes from environment variables
- Vercel config is present and the app is deployable
- Folder structure matches the conventions used in all future sub-tasks

**Todo List:**
1. Initialize Vite project: `npm create vite@latest scrum-up -- --template vue-ts`
2. Install dependencies: `primevue`, `primeicons`, `@primevue/themes`, `vue-router`, `pinia`, `@supabase/supabase-js`, `vue-chartjs`, `chart.js`
3. Configure PrimeVue in `main.ts` with the Aura or Lara theme preset
4. Set up `vue-router` with placeholder routes: `/`, `/login`, `/dashboard`, `/admin`, `/projects/:id`
5. Set up `pinia` store with an `auth` store stub
6. Add `.env.example` with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_OPENAI_API_KEY` (OpenAI key is for Edge Functions only — document this)
7. Create Supabase client singleton at `src/lib/supabase.ts`
8. Establish folder structure:
   - `src/components/` — shared UI components
   - `src/views/` — page-level Vue components
   - `src/stores/` — Pinia stores
   - `src/composables/` — reusable Vue composables
   - `src/lib/` — third-party client singletons
   - `src/types/` — shared TypeScript interfaces
   - `supabase/functions/` — Edge Function source files
   - `supabase/migrations/` — SQL migration files
9. Add `vercel.json` with SPA rewrite rule (`"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]`)
10. Confirm `npm run dev` and `npm run build` succeed with no errors

**Relevant Context:**
- Supabase JS v2 client docs: https://supabase.com/docs/reference/javascript
- PrimeVue v4 setup: https://primevue.org/installation/
- Vercel SPA rewrites: https://vercel.com/docs/frameworks/vite

---

## Sub-Task 2 — Auth and GitHub OAuth

**Status:** `[x] done`

**Intent:**
Implement authentication using Supabase Auth with GitHub as the OAuth provider. This single flow gives users a login session AND provides the GitHub access token needed later for repository integration. After login, new users are redirected to an onboarding/profile-completion step.

**Expected Outcomes:**
- Users can log in via GitHub OAuth and receive a Supabase session
- The GitHub access token from the OAuth flow is persisted in the user's record for later use by GitHub API calls
- A Pinia `auth` store exposes `user`, `session`, `role`, and `signOut`
- Route guards redirect unauthenticated users to `/login`
- New users (first login) are redirected to `/onboarding` to complete their profile
- Existing users are redirected to `/dashboard`

**Todo List:**
1. Enable GitHub OAuth provider in the Supabase project dashboard (set Client ID + Secret from a GitHub OAuth App)
2. Create `src/views/LoginView.vue` — single "Sign in with GitHub" button using `supabase.auth.signInWithOAuth({ provider: 'github', options: { scopes: 'read:user repo' } })`
3. Create `src/views/AuthCallbackView.vue` — handles the OAuth redirect, exchanges code for session, stores the `provider_token` (GitHub access token) to `users.github_token` via upsert
4. Update the `auth` Pinia store (`src/stores/auth.ts`):
   - `session`, `user`, `role` (fetched from `user_roles` table)
   - `initialize()` — called on app mount to restore session from `supabase.auth.getSession()`
   - `signOut()` — calls `supabase.auth.signOut()` and clears store
5. Add `src/router/guards.ts` — `requireAuth` guard that redirects to `/login` if no session; `requireRole(role)` guard for admin/project-head-only routes
6. Apply `requireAuth` guard to all routes except `/login` and `/auth/callback`
7. Create `src/views/OnboardingView.vue` — basic form to confirm display name; redirects to `/dashboard` on submit
8. Test: login flow, session persistence on page refresh, sign out, redirect behavior

**Relevant Context:**
- `src/lib/supabase.ts` — Supabase singleton from Sub-Task 1
- `src/stores/auth.ts` — auth store from Sub-Task 1 stub
- GitHub OAuth scopes needed: `read:user`, `repo` (for commit/PR access later)
- The `provider_token` from `supabase.auth.getSession()` is the GitHub access token — store it in the DB for use in Edge Functions

---

## Sub-Task 3 — Database Schema

**Status:** `[x] done`

**Intent:**
Define and apply the complete PostgreSQL schema via Supabase migrations. This establishes the data foundation for all features. Row-Level Security (RLS) policies enforce role-based access at the database level so the frontend never needs to re-implement access control.

**Expected Outcomes:**
- All tables exist in Supabase with correct columns, foreign keys, and indexes
- RLS is enabled on every table with policies matching the role model
- A `user_roles` table stores `(user_id, role, scope_type, scope_id)` to support context-specific roles
- The first super-admin can be seeded manually via the Supabase dashboard or a seed script

**Todo List:**
1. Create migration file `supabase/migrations/001_initial_schema.sql` with the following tables:

   **`users`** (extends `auth.users`)
   - `id` (uuid, FK → auth.users.id, PK)
   - `display_name` (text)
   - `avatar_url` (text)
   - `github_username` (text)
   - `github_token` (text) — encrypted at rest via Supabase Vault or pgcrypto
   - `created_at` (timestamptz)

   **`user_roles`**
   - `id` (uuid, PK)
   - `user_id` (uuid, FK → users.id)
   - `role` (text: `super_admin` | `project_head` | `developer`)
   - `scope_type` (text: `global` | `team` | `project`) — `global` for super_admin
   - `scope_id` (uuid, nullable) — team or project id for scoped roles

   **`developer_profiles`**
   - `id` (uuid, FK → users.id, PK)
   - `bio` (text)
   - `tech_stack` (text[]) — array of tech tags
   - `experience_years` (int)
   - `portfolio_url` (text)
   - `github_repos` (jsonb) — cached repo list from GitHub API
   - `languages` (jsonb) — aggregated language stats from GitHub

   **`clients`**
   - `id` (uuid, PK)
   - `name` (text)
   - `contact_email` (text)
   - `created_by` (uuid, FK → users.id)

   **`teams`**
   - `id` (uuid, PK)
   - `name` (text)
   - `created_by` (uuid, FK → users.id)
   - `created_at` (timestamptz)

   **`team_members`**
   - `team_id` (uuid, FK → teams.id)
   - `user_id` (uuid, FK → users.id)
   - `joined_at` (timestamptz)
   - PRIMARY KEY (`team_id`, `user_id`)

   **`projects`**
   - `id` (uuid, PK)
   - `name` (text)
   - `description` (text)
   - `requirements` (text) — raw requirements text entered by project head
   - `client_id` (uuid, FK → clients.id)
   - `created_by` (uuid, FK → users.id)
   - `team_id` (uuid, FK → teams.id)
   - `start_date` (date)
   - `end_date` (date)
   - `status` (text: `planning` | `active` | `completed` | `on_hold`)
   - `created_at` (timestamptz)

   **`github_repos`**
   - `id` (uuid, PK)
   - `project_id` (uuid, FK → projects.id, unique)
   - `repo_full_name` (text) — e.g. `org/repo`
   - `repo_url` (text)
   - `linked_by` (uuid, FK → users.id)
   - `linked_at` (timestamptz)

   **`sprints`**
   - `id` (uuid, PK)
   - `project_id` (uuid, FK → projects.id)
   - `name` (text) — e.g. `Sprint 1`
   - `goal` (text)
   - `start_date` (date)
   - `end_date` (date)
   - `status` (text: `planned` | `active` | `completed`)
   - `order` (int)
   - `ai_summary` (text, nullable) — generated by AI at sprint end
   - `retrospective_notes` (text, nullable)

   **`tasks`**
   - `id` (uuid, PK)
   - `sprint_id` (uuid, FK → sprints.id)
   - `title` (text)
   - `description` (text)
   - `priority` (text: `low` | `medium` | `high` | `critical`)
   - `status` (text: `todo` | `in_progress` | `done`)
   - `story_points` (int)
   - `order` (int) — for Kanban column ordering
   - `created_at` (timestamptz)

   **`task_assignments`**
   - `task_id` (uuid, FK → tasks.id)
   - `user_id` (uuid, FK → users.id)
   - `assigned_at` (timestamptz)
   - `ai_suggested` (boolean) — true if assigned by AI suggestion
   - PRIMARY KEY (`task_id`, `user_id`)

2. Write RLS policies:
   - `users` — users can read all, update only their own row; super-admins can update any
   - `user_roles` — only super-admins can insert/delete; all authenticated users can read their own roles
   - `developer_profiles` — owner can update; all authenticated users can read
   - `teams` — all authenticated users can read; only super-admins can create/update
   - `team_members` — super-admins and the team's project head can manage; members can read
   - `projects` — project team members can read; only project heads (scoped to team) can insert; super-admins can do all
   - `sprints` — project team members can read; project head can insert/update; super-admins can do all
   - `tasks` — project team members can read; project head can insert/update; assignee can update `status`; super-admins can do all
   - `task_assignments` — project head can manage; all team members can read
   - `github_repos` — project team members can read; project head can insert/update
   - `clients` — project head who created can manage; super-admins can do all

3. Apply migration: `supabase db push` or via Supabase dashboard SQL editor
4. Seed first super-admin: insert a row into `user_roles` with `role = 'super_admin'` and `scope_type = 'global'` for the target user ID
5. Verify schema in Supabase Table Editor — confirm all tables, FKs, and RLS policies are visible

**Relevant Context:**
- Supabase RLS docs: https://supabase.com/docs/guides/auth/row-level-security
- `user_roles.scope_type = 'global'` is used exclusively for `super_admin`
- GitHub token stored in `users.github_token` — consider Supabase Vault for encryption

---

## Sub-Task 4 — Super-Admin Panel

**Status:** `[x] done`

**Intent:**
Build the super-admin control panel where super-admins can view all registered users, promote users to super-admin, designate users as Project Heads (globally or scoped to a team), and manage teams. This is the governance layer of the platform.

**Expected Outcomes:**
- `/admin` route is only accessible to users with `role = 'super_admin'`
- Super-admins can see a paginated list of all users
- Super-admins can promote a user to `super_admin` or assign them as `project_head` for a given team
- Super-admins can create and manage teams (name, members)
- Role changes are immediately reflected in `user_roles`

**Todo List:**
1. Add `requireRole('super_admin')` route guard to the `/admin` route (using guard from Sub-Task 2)
2. Create `src/views/admin/AdminLayout.vue` — sidebar nav for: Users, Teams, Projects overview
3. Create `src/views/admin/UsersView.vue`:
   - PrimeVue `DataTable` listing all users (name, GitHub username, current roles)
   - "Assign Role" dialog: dropdown of `super_admin` / `project_head`, team scope selector for `project_head`
   - Calls Supabase upsert on `user_roles`
4. Create `src/views/admin/TeamsView.vue`:
   - List all teams with member count
   - "Create Team" dialog: name input, member multi-select (from users list)
   - Inserts into `teams` and `team_members`
   - Edit and delete team actions
5. Create `src/stores/admin.ts` Pinia store — exposes `users`, `teams`, `fetchUsers()`, `fetchTeams()`, `assignRole()`, `createTeam()`
6. Protect all Supabase queries with RLS (super-admin policies from Sub-Task 3 apply automatically)
7. Add admin link to main navigation visible only when `auth.role === 'super_admin'`

**Relevant Context:**
- `user_roles` table from Sub-Task 3
- `auth` Pinia store from Sub-Task 2 — use `role` field for guard checks
- PrimeVue `DataTable`, `Dialog`, `MultiSelect` components

---

## Sub-Task 5 — Developer Profiles

**Status:** `[x] complete`

**Intent:**
Allow each developer to have a profile that is auto-populated from their GitHub account (repos, languages, bio) and supplemented with manual fields. This profile data is later used by the AI to suggest task assignments.

**Expected Outcomes:**
- On first login (or from a profile page), a developer's GitHub data is fetched and stored in `developer_profiles`
- Profile shows: avatar, bio, tech stack tags, years of experience, portfolio URL, top GitHub repos, language breakdown
- Developer can manually edit tech stack, experience years, and portfolio URL
- Profile is readable by all authenticated users (needed for AI matching and project heads)

**Todo List:**
1. Create Supabase Edge Function `supabase/functions/sync-github-profile/index.ts`:
   - Accepts `user_id` in request body
   - Reads `github_token` from `users` table for that user
   - Calls GitHub API: `GET /user`, `GET /user/repos`, `GET /repos/{owner}/{repo}/languages` for top repos
   - Aggregates language stats across repos
   - Upserts into `developer_profiles`: `bio`, `github_repos` (top 10 by stars), `languages`, `tech_stack` (derived from languages)
2. Call `sync-github-profile` Edge Function automatically after onboarding completes (Sub-Task 2)
3. Create `src/views/ProfileView.vue`:
   - Display: avatar, GitHub username, bio, language bar chart (vue-chartjs), top repos list
   - Editable fields: `tech_stack` (PrimeVue `Chips` input), `experience_years` (number input), `portfolio_url` (text input)
   - "Sync from GitHub" button that re-invokes the Edge Function
   - Save button calls Supabase update on `developer_profiles`
4. Create `src/stores/profile.ts` — `fetchProfile(userId)`, `updateProfile(fields)`, `syncFromGitHub()`
5. Add `/profile` and `/profile/:userId` routes (own profile vs. viewing another's)

**Relevant Context:**
- `developer_profiles` table from Sub-Task 3
- GitHub token stored in `users.github_token` from Sub-Task 2
- Edge Function invoked via `supabase.functions.invoke('sync-github-profile', { body: { user_id } })`
- Language data will be reused in Sub-Task 8 (AI sprint planner) for task matching

---

## Sub-Task 6 — Team Management

**Status:** `[ ] pending`

**Intent:**
Allow super-admins to manage teams (created in Sub-Task 4) and give project heads visibility into their assigned teams and team members' profiles. This is the prerequisite for project creation — a project must be assigned to a team.

**Expected Outcomes:**
- A `/teams` page lists teams the current user belongs to or heads
- Clicking a team shows its members with links to their developer profiles
- Project heads can see team membership but cannot restructure teams (that is super-admin only)
- Team data is available in the project creation form (Sub-Task 7)

**Todo List:**
1. Create `src/views/teams/TeamsListView.vue`:
   - Lists teams the current user is a member of or heads
   - Each card shows team name, member count, and assigned projects count
2. Create `src/views/teams/TeamDetailView.vue`:
   - Member list with avatar, name, GitHub username, top skills (from `developer_profiles.tech_stack`)
   - Link to each member's profile page
   - If current user is super-admin: show "Manage in Admin" link to `/admin`
3. Create `src/stores/teams.ts` — `fetchMyTeams()`, `fetchTeamDetail(teamId)`, `fetchTeamMembers(teamId)`
4. Add `/teams` and `/teams/:id` routes with `requireAuth` guard

**Relevant Context:**
- `teams`, `team_members`, `developer_profiles` tables from Sub-Task 3
- Team creation and member management lives in the Admin Panel (Sub-Task 4)
- This view is read-only for non-super-admins

---

## Sub-Task 7 — Project Creation Flow

**Status:** `[x] complete`

**Intent:**
Build the project creation form that is only accessible to users with the `project_head` role. The form captures project name, requirements (free text), client, timeline (start/end dates), and the team to assign. On submission the project record is saved, sprints are not created yet (that is the AI planner in Sub-Task 8).

**Expected Outcomes:**
- `/projects/new` is guarded to `project_head` and `super_admin` roles only
- The form validates all required fields before submission
- Submitting creates a `projects` row and optionally creates a `clients` row if the client is new
- After creation, the user is redirected to the project's page where they can trigger AI sprint planning
- Existing projects are listed on `/projects` with status badges

**Todo List:**
1. Create `src/views/projects/ProjectsListView.vue`:
   - Lists projects the current user is associated with (as head or team member)
   - Status badge (planning / active / completed / on_hold), client name, team name, date range
   - "New Project" button visible only to `project_head` / `super_admin`
2. Create `src/views/projects/CreateProjectView.vue`:
   - Fields: project name, requirements (PrimeVue `Textarea`, large), client name + contact email (with existing client autocomplete), start date, end date, team assignment (dropdown of user's teams)
   - PrimeVue `Stepper` or single-page form with sections
   - On submit: upsert `clients`, insert `projects`
   - Redirect to `/projects/:id` on success
3. Add `requireRole(['project_head', 'super_admin'])` guard to `/projects/new`
4. Create `src/stores/projects.ts` — `fetchMyProjects()`, `createProject(payload)`, `fetchProjectDetail(id)`
5. Add `/projects`, `/projects/new`, and `/projects/:id` routes

**Relevant Context:**
- `projects`, `clients` tables from Sub-Task 3
- Role guard utility from Sub-Task 2
- The `/projects/:id` page shell will be built out fully in Sub-Task 10 (dashboard)

---

## Sub-Task 8 — AI Sprint Planner

**Status:** `[x] complete`

**Intent:**
Create the AI-powered sprint planning feature. Given the project requirements, timeline, and team member profiles, GPT-4o returns a prioritized breakdown of sprints, each with suggested tasks and recommended developer assignments. The project head can review and edit these suggestions before committing them to the database.

**Expected Outcomes:**
- A "Generate Sprint Plan" button on the project page calls the Edge Function
- The Edge Function sends requirements + team profiles to GPT-4o and returns structured JSON: sprints with goals, tasks (title, description, priority, story points), and suggested assignees per task
- The frontend displays the AI suggestions in an editable review UI
- The project head can modify task details, reassign developers, add/remove tasks, and reorder
- Confirming the plan inserts all sprints and tasks into the database

**Todo List:**
1. Create Supabase Edge Function `supabase/functions/generate-sprint-plan/index.ts`:
   - Input: `{ project_id, requirements, start_date, end_date, team_members: [{ user_id, display_name, tech_stack, languages, experience_years }] }`
   - Build a prompt that instructs the model to return JSON: `{ sprints: [{ name, goal, start_date, end_date, tasks: [{ title, description, priority, story_points, suggested_assignee_user_id }] }] }`
   - Use `response_format: { type: 'json_object' }` (Groq supports this on `llama-3.3-70b-versatile`)
   - Return the parsed JSON to the caller
2. Create `src/views/projects/SprintPlannerView.vue`:
   - "Generate Plan" button with loading state
   - Renders AI response as an editable list of sprints, each expandable to show tasks
   - Each task row: title (editable), description (editable), priority dropdown, story points input, assignee selector (team members)
   - Add/remove task buttons per sprint
   - "Confirm Plan" button at the bottom
3. On "Confirm Plan": batch insert into `sprints` and `tasks`; insert `task_assignments` for each suggested assignee, marking `ai_suggested = true`
4. Create `src/composables/useSprintPlanner.ts` — wraps Edge Function invocation, manages loading/error state, exposes editable plan state
5. After confirmation, redirect to project dashboard (`/projects/:id`)

**Relevant Context:**
- `sprints`, `tasks`, `task_assignments` tables from Sub-Task 3
- `developer_profiles.tech_stack` and `developer_profiles.languages` from Sub-Task 5 are the key inputs for matching
- **Using Groq (free tier)** instead of OpenAI — set secret: `supabase secrets set GROQ_API_KEY=...`
- Model: `llama3-70b-8192` via `https://api.groq.com/openai/v1` (OpenAI-compatible)
- Use `response_format: { type: 'json_object' }` to guarantee parseable output

---

## Sub-Task 9 — Task Kanban Board

**Status:** `[x] complete`

**Intent:**
Build a per-sprint Kanban board where developers can move their assigned tasks through `todo → in_progress → done` columns. Project heads can also create new tasks, reassign, and edit details. This is the day-to-day task tracking interface.

**Expected Outcomes:**
- Each sprint has a Kanban board view at `/projects/:id/sprints/:sprintId`
- Three columns: To Do, In Progress, Done — each showing task cards
- Tasks can be dragged between columns (status update persists to DB)
- Developers can only move tasks they are assigned to; project heads can move any task
- Project heads can add new tasks, edit existing ones, and delete tasks
- Task cards show: title, priority badge, story points, assignee avatars

**Todo List:**
1. Install `vuedraggable` (Vue 3 compatible drag-and-drop): `npm install vuedraggable@next`
2. Create `src/views/projects/KanbanView.vue`:
   - Fetch all tasks for the sprint, grouped by `status`
   - Three `draggable` column components from `vuedraggable`
   - On drag-end: call `supabase.from('tasks').update({ status })` for the moved task
   - RLS on `tasks` ensures only authorized users can update status
3. Create `src/components/TaskCard.vue`:
   - Displays: title, priority badge (color-coded), story points chip, assignee avatars
   - Click opens `TaskDetailDialog.vue`
4. Create `src/components/TaskDetailDialog.vue` (PrimeVue `Dialog`):
   - Editable fields: title, description, priority, story points, assignees (multi-select)
   - Delete button (project head only)
   - Save calls Supabase update on `tasks` and upsert on `task_assignments`
5. "Add Task" button (project head only) opens the same dialog in create mode
6. Sprint selector dropdown at top of page to switch between sprints in the same project
7. Add `/projects/:id/sprints/:sprintId` route

**Relevant Context:**
- `tasks`, `task_assignments` tables from Sub-Task 3
- RLS policy: assignee can update `status`; project head can update all fields
- `vuedraggable` v4 for Vue 3: https://github.com/SortableJS/vue.draggable.next

---

## Sub-Task 10 — Project Dashboard Shell

**Status:** `[ ] pending`

**Intent:**
Build the project-level dashboard that serves as the hub for all project metrics, sprint navigation, and GitHub data. This sub-task creates the layout and wires up the sprint selector; the actual chart components and GitHub feed are added in Sub-Tasks 11 and 12.

**Expected Outcomes:**
- `/projects/:id` renders a dashboard with: project header (name, status, client, dates), sprint selector tab/dropdown, metrics grid (placeholder cards for charts), team members strip, and GitHub repo badge
- Navigating to a sprint from the selector highlights it and updates the metrics section
- Project head sees "Generate Sprint Plan" button if no sprints exist yet

**Todo List:**
1. Create `src/views/projects/ProjectDashboardView.vue`:
   - Top header: project name, status badge, client name, date range, team name
   - Sprint selector: PrimeVue `TabView` or `Dropdown` listing all sprints with status indicators
   - Metrics grid: 2×2 or responsive grid of `MetricCard` placeholder components
   - Team strip: row of member avatars with names, linking to profiles
   - GitHub repo badge: repo name + link (or "Link Repository" button if none linked)
   - If no sprints: prominent "Generate Sprint Plan" CTA button
2. Create `src/components/MetricCard.vue` — titled card with a slot for chart content and a summary number
3. Create `src/stores/dashboard.ts` — `fetchProjectOverview(projectId)`, `selectSprint(sprintId)`, exposes `currentSprint`, `sprints`, `project`
4. Wire sprint selector so selecting a sprint updates `dashboard.currentSprint` and reactively refreshes metric cards

**Relevant Context:**
- `projects`, `sprints` tables from Sub-Task 3
- GitHub repo badge will be wired in Sub-Task 11
- Chart slots in `MetricCard` will be filled in Sub-Task 12
- PrimeVue `TabView`, `Chip`, `Avatar`, `Badge` components

---

## Sub-Task 11 — GitHub Integration

**Status:** `[ ] pending`

**Intent:**
Allow a project head to link a GitHub repository to a project. Once linked, the platform fetches commits, pull requests, and issues for each sprint's date window and displays them in an activity feed on the dashboard. This data also feeds the AI sprint summary in Sub-Task 13.

**Expected Outcomes:**
- Project head can search and select a GitHub repo (from their orgs/personal account) and link it to the project
- For each sprint, the dashboard shows: commits in the sprint window, merged PRs, and closed issues
- GitHub data is fetched via an Edge Function (using the user's stored GitHub token) and cached in Supabase
- An activity feed component on the project dashboard lists recent GitHub events

**Todo List:**
1. Create Supabase Edge Function `supabase/functions/fetch-github-data/index.ts`:
   - Input: `{ project_id, sprint_id }` (sprint provides the date window)
   - Read `github_repos.repo_full_name` and the project head's `github_token`
   - GitHub API calls:
     - `GET /repos/{owner}/{repo}/commits?since=start_date&until=end_date`
     - `GET /repos/{owner}/{repo}/pulls?state=closed&merged=true` (filter by merged_at in window)
     - `GET /repos/{owner}/{repo}/issues?state=closed` (filter by closed_at in window)
   - Return structured JSON: `{ commits: [...], pull_requests: [...], issues: [...] }`
   - Cache result in a new `github_sprint_data` JSONB column on `sprints` table (add via migration)
2. Create `src/components/LinkRepoDialog.vue` (PrimeVue `Dialog`):
   - On open: call Edge Function or GitHub API to list the user's repos and org repos
   - Search input to filter repos
   - Select and confirm inserts into `github_repos`
3. Wire "Link Repository" button in dashboard (Sub-Task 10) to open `LinkRepoDialog`
4. Create `src/components/GitHubActivityFeed.vue`:
   - Tabs: Commits | Pull Requests | Issues
   - Each item shows: author avatar, message/title, timestamp, link to GitHub
   - "Refresh" button re-invokes the Edge Function
5. Place `GitHubActivityFeed` in the project dashboard metrics grid

**Relevant Context:**
- `github_repos` table and `sprints.github_sprint_data` column from Sub-Task 3 (add column via new migration)
- GitHub token from `users.github_token` (Sub-Task 2)
- Date window is `sprints.start_date` and `sprints.end_date`
- This data is consumed again in Sub-Task 13 for AI summaries

---

## Sub-Task 12 — Metrics and Charts

**Status:** `[ ] pending`

**Intent:**
Implement the four required dashboard charts: burndown chart, velocity chart, commit frequency chart, and a sprint completion summary. These visualize the incremental work data for sprint reviews and retrospectives.

**Expected Outcomes:**
- Burndown chart: remaining story points per day across the sprint
- Velocity chart: story points completed per sprint (bar chart, all sprints in project)
- Commit frequency chart: commits per day in the sprint window (from GitHub data)
- Sprint completion summary: count of done/in-progress/todo tasks with a percentage ring
- All charts render inside `MetricCard` slots on the project dashboard
- Charts update reactively when the sprint selector changes

**Todo List:**
1. Create `src/components/charts/BurndownChart.vue`:
   - X-axis: sprint days; Y-axis: remaining story points
   - Data: for each day, sum story points of tasks NOT yet `done` as of that day
   - Requires daily task status snapshots — use `tasks.updated_at` as a proxy for completion date
   - Use `vue-chartjs` Line chart
2. Create `src/components/charts/VelocityChart.vue`:
   - X-axis: sprint names; Y-axis: total story points of `done` tasks
   - Covers all completed sprints in the project
   - Use `vue-chartjs` Bar chart
3. Create `src/components/charts/CommitFrequencyChart.vue`:
   - X-axis: dates in sprint; Y-axis: commit count per day
   - Data sourced from `sprints.github_sprint_data.commits` (Sub-Task 11)
   - Use `vue-chartjs` Bar chart
4. Create `src/components/charts/SprintCompletionRing.vue`:
   - Doughnut chart showing done / in-progress / todo proportions
   - Center label: completion percentage
5. Create `src/composables/useSprintMetrics.ts`:
   - Accepts `sprintId`; fetches tasks and github_sprint_data
   - Computes burndown series, completion counts, story point totals
   - Exported as reactive refs consumed by chart components
6. Place all four charts into `MetricCard` slots in `ProjectDashboardView` (Sub-Task 10)
7. Ensure charts re-render when `dashboard.currentSprint` changes

**Relevant Context:**
- `tasks` (with `status`, `story_points`, `updated_at`) from Sub-Task 3
- `sprints.github_sprint_data` from Sub-Task 11
- `vue-chartjs` installed in Sub-Task 1; `chart.js` registered globally in `main.ts`
- PrimeVue theming: apply consistent color palette to all charts

---

## Sub-Task 13 — AI Sprint Summaries

**Status:** `[ ] pending`

**Intent:**
Generate AI-written natural language summaries for each sprint and for the project as a whole. These are used in sprint reviews and retrospectives. The summary is generated on demand by the project head and stored in the database.

**Expected Outcomes:**
- A "Generate Summary" button on each completed sprint triggers an Edge Function
- The Edge Function assembles sprint data (tasks completed, PRs merged, commits, blockers) and sends it to GPT-4o
- GPT-4o returns a 2–4 paragraph summary: what was accomplished, what was delivered, and any notable patterns
- The summary is saved to `sprints.ai_summary` and displayed on the sprint page
- A "Project Summary" button on the project dashboard generates a summary across all sprints

**Todo List:**
1. Create Supabase Edge Function `supabase/functions/generate-sprint-summary/index.ts`:
   - Input: `{ sprint_id }` or `{ project_id }` (project-level summary uses all sprint data)
   - Fetch: sprint goal, all tasks (with status + assignees), `github_sprint_data` (commits, PRs, issues)
   - Build a GPT-4o prompt: "You are a scrum master assistant. Given the following sprint data, write a concise 2–4 paragraph sprint summary covering: goals vs. actual delivery, notable contributions, and any patterns or blockers observed. Return plain text."
   - Save result to `sprints.ai_summary` (or a new `projects.ai_summary` column for project-level)
   - Return the summary text
2. Create `src/components/SprintSummaryPanel.vue`:
   - Displays `sprint.ai_summary` if present, else shows placeholder text
   - "Generate Summary" button (project head only) calls Edge Function with loading state
   - "Regenerate" button to re-run
   - Summary text rendered with markdown-aware display (`vue-markdown` or `<pre>` with whitespace)
3. Place `SprintSummaryPanel` on the sprint detail page and project dashboard
4. Add `projects.ai_summary` column via a new migration for project-level summaries
5. Create `src/components/ProjectSummaryPanel.vue` — same pattern but aggregates all sprints

**Relevant Context:**
- `sprints.ai_summary`, `sprints.github_sprint_data` from prior sub-tasks
- OpenAI API key in Edge Function secrets (set in Sub-Task 8)
- Project head role check before showing "Generate Summary" button

---

## Sub-Task 14 — Sprint Review and Retrospective Views

**Status:** `[ ] pending`

**Intent:**
Build dedicated pages for sprint reviews and retrospectives. The review page is a presentation-ready view of sprint metrics and delivery. The retrospective page allows the team to record structured notes (went well, could improve, action items).

**Expected Outcomes:**
- `/projects/:id/sprints/:sprintId/review` — a clean, presentation-friendly sprint review page showing: sprint goal vs. delivery, completion ring, velocity comparison, AI summary, and GitHub activity highlights
- `/projects/:id/sprints/:sprintId/retro` — a retrospective board with three columns: Went Well, Could Improve, Action Items; team members can add notes; notes persist to `sprints.retrospective_notes` as JSON
- Both pages are accessible to all team members

**Todo List:**
1. Create `src/views/projects/SprintReviewView.vue`:
   - Hero section: sprint name, goal, date range, status
   - Completion ring (reuse `SprintCompletionRing` from Sub-Task 12)
   - Velocity comparison: this sprint vs. team average
   - AI summary block (reuse `SprintSummaryPanel` from Sub-Task 13)
   - GitHub highlights: top 5 commits, merged PRs count, issues closed count
   - Print / export to PDF button (use browser `window.print()` with print CSS)
2. Create `src/views/projects/SprintRetroView.vue`:
   - Three-column board (PrimeVue `Card` layout): Went Well | Could Improve | Action Items
   - Each column has an "Add Note" input that appends to that column's list
   - Notes are stored as `{ went_well: string[], could_improve: string[], action_items: string[] }` JSON in `sprints.retrospective_notes`
   - Auto-save on note add/remove (debounced Supabase update)
   - Notes are visible to all team members; only project head can delete others' notes
3. Add links from the sprint Kanban board header to Review and Retro pages
4. Add `/projects/:id/sprints/:sprintId/review` and `/projects/:id/sprints/:sprintId/retro` routes

**Relevant Context:**
- `sprints.retrospective_notes` (text column storing JSON) from Sub-Task 3
- Reuses `SprintCompletionRing`, `SprintSummaryPanel`, `GitHubActivityFeed` from prior sub-tasks
- Print CSS: scope styles under `@media print` to hide nav/sidebar for clean PDF output

---

## Key Dependencies Between Sub-Tasks

```
1 (Scaffold) → 2 (Auth) → 3 (Schema) → 4 (Admin) → 6 (Teams)
                                      ↘ 5 (Profiles) ↗
3 (Schema) → 7 (Project Creation) → 8 (AI Planner) → 9 (Kanban)
7 → 10 (Dashboard Shell) → 11 (GitHub) → 12 (Charts)
                          → 12 (Charts)
11 + 12 → 13 (AI Summaries) → 14 (Review + Retro)
```

## Environment Variables Reference

| Variable | Location | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Frontend `.env` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Frontend `.env` | Supabase anon/public key |
| `GROQ_API_KEY` | Supabase Edge Function Secret | Groq Llama 3.3 70B API access (AI sprint planner) |
| `GITHUB_CLIENT_ID` | Supabase Auth dashboard | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | Supabase Auth dashboard | GitHub OAuth App secret |

## Tech Stack Summary

| Layer | Technology |
|---|---|
| Frontend Framework | Vue 3 + TypeScript + Vite |
| UI Component Library | PrimeVue v4 |
| State Management | Pinia |
| Routing | Vue Router 4 |
| Charts | vue-chartjs + Chart.js |
| Drag and Drop | vuedraggable (vue.draggable.next) |
| Backend / DB | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth + GitHub OAuth |
| Serverless Functions | Supabase Edge Functions (Deno/TypeScript) |
| AI | Groq `llama3-70b-8192` via OpenAI-compatible REST API |
| GitHub Integration | GitHub REST API v3 |
| Deployment | Vercel (frontend) + Supabase Cloud (backend) |
