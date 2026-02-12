import { NextResponse } from 'next/server';
import { setSetting } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function PUT(req: Request) {
  // 1. Check Kill-switch
  if (process.env.DISABLE_ADMIN === 'true') {
    return NextResponse.json({ error: "Admin functionality is disabled" }, { status: 403, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { password, token } = body;

    // 2. Verify Admin Password
    const correctPassword = process.env.ADMIN_PASSWORD;
    if (!correctPassword || password !== correctPassword) {
      return NextResponse.json({ error: "Unauthorized: Invalid Admin Password" }, { status: 401, headers: corsHeaders });
    }

    if (!token || !token.startsWith('r8_')) {
      return NextResponse.json({ error: "Invalid Replicate Token format" }, { status: 400, headers: corsHeaders });
    }

    // 3. Save to DB
    setSetting('replicate_api_token', token.trim());

    return NextResponse.json({ success: true, message: "Token saved to persistent storage" }, { headers: corsHeaders });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}
