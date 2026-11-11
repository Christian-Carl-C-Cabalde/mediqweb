import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY')

// Minimal logging - only critical errors. Supabase dashboard logs every invocation
// regardless; reduce log volume via Dashboard → Settings → General → Logging level.

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    // Verify the caller using their JWT (passed via Authorization header)
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } },
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    // Check caller is ADMIN by reading their profile
    const { data: profile } = await userClient
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()
    if (profile?.role !== 'ADMIN') {
      return new Response(JSON.stringify({ error: 'Admin only' }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    // Parse request body
    const body = await req.json()
    const {
      email,
      username,
      fullName,
      password,
      role,
      specializationId,
      licenseNumber,
      assignedDoctorId,
      mobileNumber,
      dateOfBirth,
    } = body

    if (!email || !username || !fullName || !role || !password) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    // Create auth user via service-role client (bypasses RLS)
    if (!supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Server misconfigured: SERVICE_ROLE_KEY not set in Edge Function environment' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    let userId: string
    let authResult: any
    // Check if email already exists in Supabase Auth
    const { data: listData, error: listErr } = await adminClient.auth.admin.listUsers()
    if (listErr) throw listErr
    const existingUsers = (listData as any)?.users || (listData as any) || []
    const existing = existingUsers.find((u: any) => u.email === email)
    if (existing) {
      userId = existing.id
      authResult = { user: existing }
      // Update password for existing user
      await adminClient.auth.admin.updateUserById(userId, { password })
    } else {
      const result = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      authResult = result
      userId = result.user.id
    }

    const now = new Date().toISOString()
    const roleUpper = role.toUpperCase()

    // Insert into users table (Ktor domain model) — upsert
    await adminClient.from('users').upsert({
      id: userId,
      username,
      full_name: fullName,
      email,
      mobile_number: mobileNumber || '',
      date_of_birth: dateOfBirth || '',
      role: roleUpper,
      status: 'ACTIVE',
      doctor_id: null,
      assigned_doctor_id: assignedDoctorId || null,
      created_at: now,
      updated_at: now,
    }, { onConflict: 'id' })

    // Insert into profiles table (upsert in case of auto-trigger)
    await adminClient.from('profiles').upsert({
      user_id: userId,
      username,
      full_name: fullName,
      email,
      role: roleUpper,
      status: 'ACTIVE',
    }, { onConflict: 'user_id' })

    // Insert into doctors table if doctor — upsert
    if (roleUpper === 'DOCTOR') {
      await adminClient.from('doctors').upsert({
        id: userId,
        user_id: userId,
        full_name: fullName,
        specialty: '',
        specialization_id: specializationId || '',
        license_number: licenseNumber || '',
        years_of_experience: 0,
        fee_centavos: 0,
        bio: '',
        building: '',
        floor: '',
        room: '',
        languages: '',
        status: 'ACTIVE',
        created_at: now,
        updated_at: now,
      }, { onConflict: 'id' })
    }

    return new Response(
      JSON.stringify({ success: true, userId, role: roleUpper }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      },
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
})
