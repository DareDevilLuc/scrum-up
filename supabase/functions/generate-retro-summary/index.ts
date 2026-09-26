import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RetroNote {
  text: string
  author: string
  anonymous: boolean
}

interface RetroNotes {
  went_well: RetroNote[]
  could_improve: RetroNote[]
  action_items: RetroNote[]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { sprint_id }: { sprint_id: string } = await req.json()

    if (!sprint_id) {
      return new Response(
        JSON.stringify({ error: 'sprint_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

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

    const groqKey = Deno.env.get('GROQ_API_KEY')
    if (!groqKey) {
      return new Response(
        JSON.stringify({ error: 'GROQ_API_KEY secret is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Fetch sprint name + retro notes
    const { data: sprint, error: sprintErr } = await supabase
      .from('sprints')
      .select('name, goal, retrospective_notes')
      .eq('id', sprint_id)
      .single()

    if (sprintErr || !sprint) {
      return new Response(
        JSON.stringify({ error: 'Sprint not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Parse notes — support both old string[] and new RetroNote[] formats
    let notes: RetroNotes = { went_well: [], could_improve: [], action_items: [] }
    if (sprint.retrospective_notes) {
      try {
        const raw = typeof sprint.retrospective_notes === 'string'
          ? JSON.parse(sprint.retrospective_notes)
          : sprint.retrospective_notes

        const toNoteList = (arr: unknown[]): RetroNote[] =>
          (arr ?? []).map((n) =>
            typeof n === 'string' ? { text: n, author: 'Team', anonymous: false } : n as RetroNote,
          )

        notes = {
          went_well: toNoteList(raw.went_well ?? []),
          could_improve: toNoteList(raw.could_improve ?? []),
          action_items: toNoteList(raw.action_items ?? []),
        }
      } catch { /* keep empty */ }
    }

    const formatNotes = (list: RetroNote[]) =>
      list.length
        ? list.map((n) => `  • ${n.text}${n.anonymous ? '' : ` (${n.author})`}`).join('\n')
        : '  (none)'

    const userPrompt = `Sprint: ${sprint.name}
Goal: ${sprint.goal ?? 'No goal set'}

Retrospective notes from the team:

WENT WELL:
${formatNotes(notes.went_well)}

COULD IMPROVE:
${formatNotes(notes.could_improve)}

ACTION ITEMS:
${formatNotes(notes.action_items)}

Write the retrospective summary now.`

    const systemPrompt = `You are a senior scrum master writing a retrospective summary for a development team.
Given the team's retrospective notes, write a concise 2–3 paragraph summary that:
1. Highlights the key things that went well and why they matter
2. Identifies the most important improvement areas and their root causes
3. Summarises the committed action items and what outcomes they aim for
Be constructive, specific, and encouraging. Use plain prose only — no bullet points, no markdown headers.`

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        temperature: 0.55,
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

    return new Response(
      JSON.stringify({ summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
