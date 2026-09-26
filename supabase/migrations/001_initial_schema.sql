-- =============================================================================
-- Migration: 001_initial_schema.sql
-- Description: Create all Scrum-Up tables, indexes, RLS policies, and the
--              auth.users trigger that auto-inserts into public.users.
-- Apply via: Supabase Dashboard → SQL Editor (paste and run)
-- =============================================================================

-- =============================================
-- TABLE: users
-- Extends auth.users; populated automatically
-- by the trigger defined at the bottom.
-- =============================================
CREATE TABLE IF NOT EXISTS public.users (
  id              uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name    text,
  avatar_url      text,
  github_username text,
  github_token    text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read the users table (profile discovery)
CREATE POLICY "users select for authenticated"
  ON public.users FOR SELECT
  TO authenticated
  USING ( true );

-- Users can only update their own row
CREATE POLICY "users update own row"
  ON public.users FOR UPDATE
  TO authenticated
  USING ( auth.uid() = id )
  WITH CHECK ( auth.uid() = id );


-- =============================================
-- TABLE: user_roles
-- =============================================
CREATE TABLE IF NOT EXISTS public.user_roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('super_admin', 'project_head', 'developer')),
  scope_type text NOT NULL CHECK (scope_type IN ('global', 'team', 'project')),
  scope_id   uuid
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_scope   ON public.user_roles (scope_type, scope_id);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own roles
CREATE POLICY "user_roles select own"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING ( user_id = auth.uid() );

-- Super-admins can do everything (read all, insert, update, delete)
CREATE POLICY "user_roles all for super_admin"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'super_admin'
        AND ur.scope_type = 'global'
    )
  );

-- Super-admins can update any row
CREATE POLICY "users all for super_admin"
  ON public.users FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'super_admin'
        AND scope_type = 'global'
    )
  );

-- =============================================
-- TABLE: developer_profiles
-- =============================================
CREATE TABLE IF NOT EXISTS public.developer_profiles (
  id               uuid PRIMARY KEY REFERENCES public.users (id) ON DELETE CASCADE,
  bio              text,
  tech_stack       text[],
  experience_years int,
  portfolio_url    text,
  github_repos     jsonb,
  languages        jsonb
);

ALTER TABLE public.developer_profiles ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read developer profiles
CREATE POLICY "developer_profiles select for authenticated"
  ON public.developer_profiles FOR SELECT
  TO authenticated
  USING ( true );

-- Owner can insert/update their own profile
CREATE POLICY "developer_profiles insert own"
  ON public.developer_profiles FOR INSERT
  TO authenticated
  WITH CHECK ( auth.uid() = id );

CREATE POLICY "developer_profiles update own"
  ON public.developer_profiles FOR UPDATE
  TO authenticated
  USING ( auth.uid() = id )
  WITH CHECK ( auth.uid() = id );

-- Super-admins can do everything
CREATE POLICY "developer_profiles all for super_admin"
  ON public.developer_profiles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'super_admin'
        AND scope_type = 'global'
    )
  );

-- =============================================
-- TABLE: clients
-- =============================================
CREATE TABLE IF NOT EXISTS public.clients (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  contact_email text,
  created_by    uuid NOT NULL REFERENCES public.users (id)
);

CREATE INDEX IF NOT EXISTS idx_clients_created_by ON public.clients (created_by);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Project heads who created the client can manage it
CREATE POLICY "clients select for authenticated"
  ON public.clients FOR SELECT
  TO authenticated
  USING ( true );

CREATE POLICY "clients insert for project_head"
  ON public.clients FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'project_head'
    )
  );

CREATE POLICY "clients update own"
  ON public.clients FOR UPDATE
  TO authenticated
  USING ( created_by = auth.uid() )
  WITH CHECK ( created_by = auth.uid() );

CREATE POLICY "clients delete own"
  ON public.clients FOR DELETE
  TO authenticated
  USING ( created_by = auth.uid() );

-- Super-admins can do everything
CREATE POLICY "clients all for super_admin"
  ON public.clients FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'super_admin'
        AND scope_type = 'global'
    )
  );

-- =============================================
-- TABLE: teams
-- =============================================
CREATE TABLE IF NOT EXISTS public.teams (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.users (id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teams_created_by ON public.teams (created_by);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read teams
CREATE POLICY "teams select for authenticated"
  ON public.teams FOR SELECT
  TO authenticated
  USING ( true );

-- Only super-admins can create/update/delete teams
CREATE POLICY "teams all for super_admin"
  ON public.teams FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'super_admin'
        AND scope_type = 'global'
    )
  );

-- =============================================
-- TABLE: team_members
-- =============================================
CREATE TABLE IF NOT EXISTS public.team_members (
  team_id   uuid NOT NULL REFERENCES public.teams (id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members (user_id);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Team members can read their own team memberships; all authenticated users
-- need to see memberships to resolve team context in other policies
CREATE POLICY "team_members select for authenticated"
  ON public.team_members FOR SELECT
  TO authenticated
  USING ( true );

-- Super-admins can manage all memberships
CREATE POLICY "team_members all for super_admin"
  ON public.team_members FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'super_admin'
        AND scope_type = 'global'
    )
  );

-- Project heads scoped to the team can manage memberships
CREATE POLICY "team_members manage for project_head"
  ON public.team_members FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'project_head'
        AND scope_type = 'team'
        AND scope_id = team_id
    )
  );

-- =============================================
-- TABLE: projects
-- =============================================
CREATE TABLE IF NOT EXISTS public.projects (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  description  text,
  requirements text,
  client_id    uuid REFERENCES public.clients (id),
  created_by   uuid NOT NULL REFERENCES public.users (id),
  team_id      uuid REFERENCES public.teams (id),
  start_date   date,
  end_date     date,
  status       text NOT NULL DEFAULT 'planning'
                 CHECK (status IN ('planning', 'active', 'completed', 'on_hold')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_team_id    ON public.projects (team_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON public.projects (created_by);
CREATE INDEX IF NOT EXISTS idx_projects_status     ON public.projects (status);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Team members can read projects belonging to their team
CREATE POLICY "projects select for team_member"
  ON public.projects FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE user_id = auth.uid()
        AND team_id = projects.team_id
    )
  );

-- Project heads scoped to the team can insert projects
CREATE POLICY "projects insert for project_head"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'project_head'
        AND scope_type = 'team'
        AND scope_id = team_id
    )
  );

-- Project heads scoped to the team can update their projects
CREATE POLICY "projects update for project_head"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'project_head'
        AND scope_type = 'team'
        AND scope_id = projects.team_id
    )
  );

-- Super-admins can do everything
CREATE POLICY "projects all for super_admin"
  ON public.projects FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'super_admin'
        AND scope_type = 'global'
    )
  );

-- =============================================
-- TABLE: github_repos
-- =============================================
CREATE TABLE IF NOT EXISTS public.github_repos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid NOT NULL UNIQUE REFERENCES public.projects (id) ON DELETE CASCADE,
  repo_full_name text NOT NULL,
  repo_url       text NOT NULL,
  linked_by      uuid NOT NULL REFERENCES public.users (id),
  linked_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.github_repos ENABLE ROW LEVEL SECURITY;

-- Team members can read linked repos
CREATE POLICY "github_repos select for team_member"
  ON public.github_repos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.team_members tm ON tm.team_id = p.team_id
      WHERE p.id = github_repos.project_id
        AND tm.user_id = auth.uid()
    )
  );

-- Project head can link/update repos
CREATE POLICY "github_repos insert for project_head"
  ON public.github_repos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.user_roles ur ON ur.user_id = auth.uid()
      WHERE p.id = project_id
        AND ur.role = 'project_head'
        AND ur.scope_type = 'team'
        AND ur.scope_id = p.team_id
    )
  );

CREATE POLICY "github_repos update for project_head"
  ON public.github_repos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.user_roles ur ON ur.user_id = auth.uid()
      WHERE p.id = github_repos.project_id
        AND ur.role = 'project_head'
        AND ur.scope_type = 'team'
        AND ur.scope_id = p.team_id
    )
  );

-- Super-admins can do everything
CREATE POLICY "github_repos all for super_admin"
  ON public.github_repos FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'super_admin'
        AND scope_type = 'global'
    )
  );

-- =============================================
-- TABLE: sprints
-- =============================================
CREATE TABLE IF NOT EXISTS public.sprints (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  name                text NOT NULL,
  goal                text,
  start_date          date,
  end_date            date,
  status              text NOT NULL DEFAULT 'planned'
                        CHECK (status IN ('planned', 'active', 'completed')),
  "order"             int NOT NULL DEFAULT 0,
  ai_summary          text,
  retrospective_notes text
);

CREATE INDEX IF NOT EXISTS idx_sprints_project_id ON public.sprints (project_id);

ALTER TABLE public.sprints ENABLE ROW LEVEL SECURITY;

-- Team members can read sprints for their projects
CREATE POLICY "sprints select for team_member"
  ON public.sprints FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.team_members tm ON tm.team_id = p.team_id
      WHERE p.id = sprints.project_id
        AND tm.user_id = auth.uid()
    )
  );

-- Project head can create sprints
CREATE POLICY "sprints insert for project_head"
  ON public.sprints FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.user_roles ur ON ur.user_id = auth.uid()
      WHERE p.id = project_id
        AND ur.role = 'project_head'
        AND ur.scope_type = 'team'
        AND ur.scope_id = p.team_id
    )
  );

-- Project head can update sprints
CREATE POLICY "sprints update for project_head"
  ON public.sprints FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.user_roles ur ON ur.user_id = auth.uid()
      WHERE p.id = sprints.project_id
        AND ur.role = 'project_head'
        AND ur.scope_type = 'team'
        AND ur.scope_id = p.team_id
    )
  );

-- Super-admins can do everything
CREATE POLICY "sprints all for super_admin"
  ON public.sprints FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'super_admin'
        AND scope_type = 'global'
    )
  );

-- =============================================
-- TABLE: tasks
-- =============================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sprint_id    uuid NOT NULL REFERENCES public.sprints (id) ON DELETE CASCADE,
  title        text NOT NULL,
  description  text,
  priority     text NOT NULL DEFAULT 'medium'
                 CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status       text NOT NULL DEFAULT 'todo'
                 CHECK (status IN ('todo', 'in_progress', 'done')),
  story_points int,
  "order"      int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_sprint_id ON public.tasks (sprint_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status    ON public.tasks (status);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Team members can read tasks in their projects' sprints
CREATE POLICY "tasks select for team_member"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sprints s
      JOIN public.projects p ON p.id = s.project_id
      JOIN public.team_members tm ON tm.team_id = p.team_id
      WHERE s.id = tasks.sprint_id
        AND tm.user_id = auth.uid()
    )
  );

-- Project head can create tasks
CREATE POLICY "tasks insert for project_head"
  ON public.tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sprints s
      JOIN public.projects p ON p.id = s.project_id
      JOIN public.user_roles ur ON ur.user_id = auth.uid()
      WHERE s.id = sprint_id
        AND ur.role = 'project_head'
        AND ur.scope_type = 'team'
        AND ur.scope_id = p.team_id
    )
  );

-- Project head can update any task field; assignee can update status
CREATE POLICY "tasks update for project_head"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sprints s
      JOIN public.projects p ON p.id = s.project_id
      JOIN public.user_roles ur ON ur.user_id = auth.uid()
      WHERE s.id = tasks.sprint_id
        AND ur.role = 'project_head'
        AND ur.scope_type = 'team'
        AND ur.scope_id = p.team_id
    )
  );



-- Super-admins can do everything
CREATE POLICY "tasks all for super_admin"
  ON public.tasks FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'super_admin'
        AND scope_type = 'global'
    )
  );

-- =============================================
-- TABLE: task_assignments
-- =============================================
CREATE TABLE IF NOT EXISTS public.task_assignments (
  task_id      uuid NOT NULL REFERENCES public.tasks (id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  assigned_at  timestamptz NOT NULL DEFAULT now(),
  ai_suggested boolean NOT NULL DEFAULT false,
  PRIMARY KEY (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_assignments_user_id ON public.task_assignments (user_id);

ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;

-- All team members can read assignments
CREATE POLICY "task_assignments select for team_member"
  ON public.task_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.sprints s ON s.id = t.sprint_id
      JOIN public.projects p ON p.id = s.project_id
      JOIN public.team_members tm ON tm.team_id = p.team_id
      WHERE t.id = task_assignments.task_id
        AND tm.user_id = auth.uid()
    )
  );

-- Project head can manage assignments
CREATE POLICY "task_assignments manage for project_head"
  ON public.task_assignments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.sprints s ON s.id = t.sprint_id
      JOIN public.projects p ON p.id = s.project_id
      JOIN public.user_roles ur ON ur.user_id = auth.uid()
      WHERE t.id = task_assignments.task_id
        AND ur.role = 'project_head'
        AND ur.scope_type = 'team'
        AND ur.scope_id = p.team_id
    )
  );

-- Super-admins can do everything
CREATE POLICY "task_assignments all for super_admin"
  ON public.task_assignments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'super_admin'
        AND scope_type = 'global'
    )
  );

CREATE POLICY "tasks update status for assignee"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.task_assignments
      WHERE task_id = tasks.id
        AND user_id = auth.uid()
    )
  );
-- =============================================================================
-- TRIGGER: auto-insert into public.users on new auth.users signup
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, display_name, avatar_url, github_username, created_at)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url',
    NEW.raw_user_meta_data ->> 'user_name',
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();
  