import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FetchGitHubInput {
  project_id: string
  sprint_id: string
}

interface GitHubCommit {
  sha: string
  message: string
  author: string
  author_avatar: string | null
  url: string
  date: string
}

interface GitHubPR {
  number: number
  title: string
  user: string
  user_avatar: string | null
  url: string
  merged_at: string
}

interface GitHubIssue {
  number: number
  title: string
  user: string
  user_avatar: string | null
  url: string
  closed_at: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: FetchGitHubInput = await req.json()
    const { project_id, sprint_id } = body

    if (!project_id || !sprint_id) {
      return new Response(
        JSON.stringify({ error: 'project_id and sprint_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Create Supabase client using caller's auth token so RLS applies
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    )

    // Verify caller is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 1. Resolve the sprint's date window
    const { data: sprint, error: sprintError } = await supabase
      .from('sprints')
      .select('start_date, end_date, project_id')
      .eq('id', sprint_id)
      .single()

    if (sprintError || !sprint) {
      return new Response(
        JSON.stringify({ error: 'Sprint not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (!sprint.start_date || !sprint.end_date) {
      return new Response(
        JSON.stringify({ error: 'Sprint has no date window set' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const sinceISO = new Date(sprint.start_date).toISOString()
    const untilISO = new Date(sprint.end_date + 'T23:59:59Z').toISOString()

    // 2. Resolve linked GitHub repo for this project
    const { data: repoRow, error: repoError } = await supabase
      .from('github_repos')
      .select('repo_full_name, linked_by')
      .eq('project_id', project_id)
      .single()

    if (repoError || !repoRow) {
      return new Response(
        JSON.stringify({ error: 'No GitHub repository linked to this project' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 3. Read the project head's GitHub token
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('github_token')
      .eq('id', repoRow.linked_by)
      .single()

    if (userError || !userRow?.github_token) {
      return new Response(
        JSON.stringify({ error: 'GitHub token not found for project head' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const ghHeaders = {
      'Authorization': `Bearer ${userRow.github_token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    }

    const repo = repoRow.repo_full_name

    // 4. Fetch commits in the sprint window
    const commitsRes = await fetch(
      `https://api.github.com/repos/${repo}/commits?since=${sinceISO}&until=${untilISO}&per_page=100`,
      { headers: ghHeaders },
    )
    const commitsRaw = await commitsRes.json()
    const commits: GitHubCommit[] = (Array.isArray(commitsRaw) ? commitsRaw : []).map((c: Record<string, unknown>) => {
      const commit = c.commit as Record<string, unknown>
      const author = (commit?.author ?? {}) as Record<string, unknown>
      const ghAuthor = (c.author ?? {}) as Record<string, unknown>
      return {
        sha: (c.sha as string)?.slice(0, 7),
        message: (commit?.message as string)?.split('\n')[0] ?? '',
        author: (author?.name as string) ?? 'Unknown',
        author_avatar: (ghAuthor?.avatar_url as string) ?? null,
        url: (c.html_url as string) ?? '',
        date: (author?.date as string) ?? '',
      }
    })

    // 5. Fetch merged PRs and filter by merged_at in sprint window
    const prsRes = await fetch(
      `https://api.github.com/repos/${repo}/pulls?state=closed&per_page=100&sort=updated&direction=desc`,
      { headers: ghHeaders },
    )
    const prsRaw = await prsRes.json()
    const since = new Date(sinceISO)
    const until = new Date(untilISO)
    const pullRequests: GitHubPR[] = (Array.isArray(prsRaw) ? prsRaw : [])
      .filter((pr: Record<string, unknown>) => {
        if (!pr.merged_at) return false
        const mergedAt = new Date(pr.merged_at as string)
        return mergedAt >= since && mergedAt <= until
      })
      .map((pr: Record<string, unknown>) => {
        const prUser = (pr.user ?? {}) as Record<string, unknown>
        return {
          number: pr.number as number,
          title: pr.title as string,
          user: (prUser?.login as string) ?? 'Unknown',
          user_avatar: (prUser?.avatar_url as string) ?? null,
          url: (pr.html_url as string) ?? '',
          merged_at: pr.merged_at as string,
        }
      })

    // 6. Fetch closed issues and filter by closed_at in sprint window
    const issuesRes = await fetch(
      `https://api.github.com/repos/${repo}/issues?state=closed&per_page=100&sort=updated&direction=desc`,
      { headers: ghHeaders },
    )
    const issuesRaw = await issuesRes.json()
    const issues: GitHubIssue[] = (Array.isArray(issuesRaw) ? issuesRaw : [])
      .filter((issue: Record<string, unknown>) => {
        // GitHub returns PRs in the issues endpoint too; skip those
        if (issue.pull_request) return false
        if (!issue.closed_at) return false
        const closedAt = new Date(issue.closed_at as string)
        return closedAt >= since && closedAt <= until
      })
      .map((issue: Record<string, unknown>) => {
        const issueUser = (issue.user ?? {}) as Record<string, unknown>
        return {
          number: issue.number as number,
          title: issue.title as string,
          user: (issueUser?.login as string) ?? 'Unknown',
          user_avatar: (issueUser?.avatar_url as string) ?? null,
          url: (issue.html_url as string) ?? '',
          closed_at: issue.closed_at as string,
        }
      })

    const result = { commits, pull_requests: pullRequests, issues }

    // 7. Cache result into sprints.github_sprint_data
    await supabase
      .from('sprints')
      .update({ github_sprint_data: result })
      .eq('id', sprint_id)

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
