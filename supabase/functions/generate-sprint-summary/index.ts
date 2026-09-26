import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SprintSummaryInput {
  sprint_id?: string   // generate summary for one sprint
  project_id?: string  // generate summary across all sprints in the project
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: SprintSummaryInput = await req.json()
    const { sprint_id, project_id } = body

    if (!sprint_id && !project_id) {
      return new Response(
        JSON.stringify({ error: 'sprint_id or project_id is required' }),
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

    const groqKey = Deno.env.get('GROQ_API_KEY')
    if (!groqKey) {
      return new Response(
        JSON.stringify({ error: 'GROQ_API_KEY secret is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── Sprint-level summary ───────────────────────────────────────────────────
    if (sprint_id) {
      // 1. Fetch sprint metadata + cached GitHub data
      const { data: sprint, error: sprintErr } = await supabase
        .from('sprints')
        .select('id, name, goal, status, start_date, end_date, github_sprint_data, project_id')
        .eq('id', sprint_id)
        .single()

      if (sprintErr || !sprint) {
        return new Response(
          JSON.stringify({ error: 'Sprint not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      // 2. Fetch tasks
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title, status, priority, story_points')
        .eq('sprint_id', sprint_id)

      // 3. Fetch assignees for all tasks
      const taskIds = (tasks ?? []).map((t) => t.id)
      let assigneeMap: Record<string, string[]> = {}
      if (taskIds.length > 0) {
        const { data: assignments } = await supabase
          .from('task_assignments')
          .select('task_id, users(display_name)')
          .in('task_id', taskIds)

        for (const a of assignments ?? []) {
          const tid = (a as any).task_id
          const name = (a as any).users?.display_name ?? 'Unknown'
          if (!assigneeMap[tid]) assigneeMap[tid] = []
          assigneeMap[tid].push(name)
        }
      }

      // 4. Build task summary text
      const taskLines = (tasks ?? []).map((t) => {
        const assignees = (assigneeMap[t.id] ?? []).join(', ') || 'Unassigned'
        return `  - [${t.status.toUpperCase()}] ${t.title} (${t.priority}, ${t.story_points ?? '?'} pts) — ${assignees}`
      }).join('\n')

      const done = (tasks ?? []).filter((t) => t.status === 'done').length
      const total = (tasks ?? []).length
      const donePoints = (tasks ?? [])
        .filter((t) => t.status === 'done')
        .reduce((s, t) => s + (t.story_points ?? 0), 0)

      // 5. GitHub highlights from cached data
      const ghData = sprint.github_sprint_data as { commits?: unknown[]; pull_requests?: unknown[]; issues?: unknown[] } | null
      const commitCount = ghData?.commits?.length ?? 0
      const prCount = ghData?.pull_requests?.length ?? 0
      const issueCount = ghData?.issues?.length ?? 0

      const userPrompt = `Sprint: ${sprint.name}
Goal: ${sprint.goal ?? 'No goal set'}
Dates: ${sprint.start_date ?? '?'} to ${sprint.end_date ?? '?'}
Status: ${sprint.status}

Task completion: ${done} of ${total} tasks done (${donePoints} story points delivered)

Tasks:
${taskLines || '  (no tasks)'}

GitHub activity (sprint window):
  - Commits: ${commitCount}
  - Merged PRs: ${prCount}
  - Closed Issues: ${issueCount}

Write the summary now.`

      const systemPrompt = `You are a senior scrum master writing sprint summaries for technical project stakeholders.
Write a concise 2–4 paragraph sprint summary covering:
1. Goals vs. actual delivery
2. Notable contributions or technical highlights
3. Any observable patterns, risks, or blockers
Use plain prose only — no markdown headers, no bullet points.`

      const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai/gpt-oss-20b',
          temperature: 0.5,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      })

      if (!groqResponse.ok) {
        const groqError = await groqResponse.text()
        return new Response(
          JSON.stringify({ error: `Groq API error: ${groqError}` }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      const groqData = await groqResponse.json()
      const summary: string = groqData.choices?.[0]?.message?.content?.trim() ?? ''

      if (!summary) {
        return new Response(
          JSON.stringify({ error: 'Empty response from Groq' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      // 6. Persist to sprints.ai_summary
      await supabase
        .from('sprints')
        .update({ ai_summary: summary })
        .eq('id', sprint_id)

      return new Response(
        JSON.stringify({ summary }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── Project-level summary ──────────────────────────────────────────────────
    if (project_id) {
      // 1. Fetch project
      const { data: project, error: projErr } = await supabase
        .from('projects')
        .select('id, name, description, status, start_date, end_date')
        .eq('id', project_id)
        .single()

      if (projErr || !project) {
        return new Response(
          JSON.stringify({ error: 'Project not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      // 2. Fetch all sprints with task counts
      const { data: sprints } = await supabase
        .from('sprints')
        .select('id, name, goal, status, start_date, end_date, ai_summary')
        .eq('project_id', project_id)
        .order('order', { ascending: true })

      const sprintBlocks = await Promise.all(
        (sprints ?? []).map(async (s) => {
          const { data: tasks } = await supabase
            .from('tasks')
            .select('status, story_points')
            .eq('sprint_id', s.id)

          const done = (tasks ?? []).filter((t) => t.status === 'done').length
          const total = (tasks ?? []).length
          const pts = (tasks ?? [])
            .filter((t) => t.status === 'done')
            .reduce((sum, t) => sum + (t.story_points ?? 0), 0)

          const prevSummary = s.ai_summary
            ? `\n  Previous summary excerpt: "${s.ai_summary.slice(0, 200)}…"`
            : ''

          return `Sprint "${s.name}" (${s.status}): ${done}/${total} tasks done, ${pts} story points delivered. Goal: ${s.goal ?? 'N/A'}${prevSummary}`
        }),
      )

      const userPrompt = `Project: ${project.name}
Description: ${project.description ?? 'N/A'}
Timeline: ${project.start_date ?? '?'} to ${project.end_date ?? '?'}
Status: ${project.status}

Sprint breakdown:
${sprintBlocks.join('\n\n')}

Write the project summary now.`

      const systemPrompt = `You are a senior scrum master writing a project-level summary for technical stakeholders.
Write a concise 3–5 paragraph summary covering:
1. Overall project progress and delivery against goals
2. Team velocity trends across sprints
3. Key technical accomplishments
4. Strategic observations, recurring patterns, or risks
Use plain prose only — no markdown headers, no bullet points.`

      const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai/gpt-oss-20b',
          temperature: 0.5,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      })

      if (!groqResponse.ok) {
        const groqError = await groqResponse.text()
        return new Response(
          JSON.stringify({ error: `Groq API error: ${groqError}` }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      const groqData = await groqResponse.json()
      const summary: string = groqData.choices?.[0]?.message?.content?.trim() ?? ''

      if (!summary) {
        return new Response(
          JSON.stringify({ error: 'Empty response from Groq' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      // 3. Persist to projects.ai_summary
      await supabase
        .from('projects')
        .update({ ai_summary: summary })
        .eq('id', project_id)

      return new Response(
        JSON.stringify({ summary }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({ error: 'Unreachable' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
