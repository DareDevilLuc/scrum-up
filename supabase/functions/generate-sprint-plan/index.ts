import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TeamMemberInput {
  user_id: string
  display_name: string
  tech_stack: string[]
  languages: Record<string, number>
  experience_years: number | null
}

interface GenerateInput {
  project_id: string
  requirements: string
  start_date: string
  end_date: string
  team_members: TeamMemberInput[]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: GenerateInput = await req.json()
    const { project_id, requirements, start_date, end_date, team_members } = body

    if (!project_id || !requirements || !team_members?.length) {
      return new Response(
        JSON.stringify({ error: 'project_id, requirements, and team_members are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Verify caller is authenticated and is the project head
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Build the team members summary for the prompt
    const teamSummary = team_members
      .map((m) => {
        const topLangs = Object.entries(m.languages ?? {})
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([l]) => l)
          .join(', ')
        const stack = (m.tech_stack ?? []).slice(0, 8).join(', ')
        const exp = m.experience_years ? `${m.experience_years} yrs exp` : 'exp unknown'
        return `- ${m.display_name} (id: ${m.user_id}): ${exp}. Languages: ${topLangs || 'unknown'}. Tech: ${stack || 'unknown'}.`
      })
      .join('\n')

    const systemPrompt = `You are an expert agile sprint planner. Given a software project's requirements, timeline, and team members, you generate a detailed sprint plan.

Output ONLY valid JSON matching this exact schema:
{
  "sprints": [
    {
      "name": "Sprint 1",
      "goal": "Brief goal description",
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD",
      "tasks": [
        {
          "title": "Task title",
          "description": "Short task description",
          "priority": "low" | "medium" | "high" | "critical",
          "story_points": 1-13,
          "suggested_assignee_user_id": "<user_id from team or null>"
        }
      ]
    }
  ]
}

Rules:
- Create 2-6 sprints depending on project size and timeline.
- Each sprint should be 1-3 weeks long.
- Assign tasks to the most suitable team member based on their tech stack and experience. Use exact user_id strings from the team list, or null if no suitable match.
- story_points must be a Fibonacci number: 1, 2, 3, 5, 8, or 13.
- priority must be one of: low, medium, high, critical.
- Do not include any commentary outside the JSON object.`

    const userPrompt = `Project ID: ${project_id}
Project timeline: ${start_date} to ${end_date}

Requirements:
${requirements}

Team members:
${teamSummary}

Generate the sprint plan JSON now.`

    const groqKey = Deno.env.get('GROQ_API_KEY')
    if (!groqKey) {
      return new Response(
        JSON.stringify({ error: 'GROQ_API_KEY secret is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        response_format: { type: 'json_object' },
        temperature: 0.4,
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
    const rawContent = groqData.choices?.[0]?.message?.content
    if (!rawContent) {
      return new Response(
        JSON.stringify({ error: 'Empty response from Groq' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const plan = JSON.parse(rawContent)

    return new Response(
      JSON.stringify(plan),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
