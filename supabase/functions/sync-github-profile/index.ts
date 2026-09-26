import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user_id } = await req.json()
    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Use the caller's auth token so RLS applies correctly
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    )

    // Read the stored GitHub token for this user
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('github_token, github_username')
      .eq('id', user_id)
      .single()

    if (userError || !userRow?.github_token) {
      return new Response(
        JSON.stringify({ error: 'GitHub token not found for user' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const ghHeaders = {
      'Authorization': `Bearer ${userRow.github_token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    }

    // Fetch GitHub profile
    const profileRes = await fetch('https://api.github.com/user', { headers: ghHeaders })
    const profile = await profileRes.json()

    // Fetch top repos (sorted by stars, max 100)
    const reposRes = await fetch(
      'https://api.github.com/user/repos?per_page=100&sort=stars&direction=desc',
      { headers: ghHeaders },
    )
    const allRepos = await reposRes.json()
    const topRepos = (Array.isArray(allRepos) ? allRepos : [])
      .slice(0, 10)
      .map((r: Record<string, unknown>) => ({
        name: r.name,
        full_name: r.full_name,
        url: r.html_url,
        description: r.description,
        stars: r.stargazers_count,
        language: r.language,
      }))

    // Aggregate language stats from top 5 repos
    const languageTotals: Record<string, number> = {}
    const top5 = topRepos.slice(0, 5)
    await Promise.all(
      top5.map(async (repo) => {
        const langRes = await fetch(
          `https://api.github.com/repos/${repo.full_name}/languages`,
          { headers: ghHeaders },
        )
        const langs: Record<string, number> = await langRes.json()
        for (const [lang, bytes] of Object.entries(langs)) {
          languageTotals[lang] = (languageTotals[lang] ?? 0) + bytes
        }
      }),
    )

    // Derive tech_stack from the top languages (by byte count)
    const techStack = Object.entries(languageTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([lang]) => lang)

    // Upsert into developer_profiles
    const { error: upsertError } = await supabase
      .from('developer_profiles')
      .upsert(
        {
          id: user_id,
          bio: profile.bio ?? null,
          github_repos: topRepos,
          languages: languageTotals,
          tech_stack: techStack,
        },
        { onConflict: 'id' },
      )

    if (upsertError) throw upsertError

    return new Response(
      JSON.stringify({ success: true, tech_stack: techStack }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
