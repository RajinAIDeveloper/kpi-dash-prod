// app/api/user/filter-presets/route.ts
//
// Lightweight stub for filter presets to avoid 404s in production.
// Currently:
// - GET returns `hasPreset: false` and no preset dates.
// - POST accepts a payload but does not persist it anywhere, just echoes back.
//
// This keeps the existing FilterStateProvider logic working without
// introducing a real database dependency.

import { NextResponse } from "next/server";

export async function GET() {
  // No persisted preset; client will fall back to Zustand defaults
  return NextResponse.json(
    {
      hasPreset: false,
      preset: null,
    },
    { status: 200 }
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null as any);

    // Accept startDate/endDate but do not store them anywhere yet.
    // This endpoint is purely to satisfy the client contract.
    const { startDate, endDate } = body || {};

    return NextResponse.json(
      {
        ok: true,
        saved: {
          startDate: typeof startDate === "string" ? startDate : null,
          endDate: typeof endDate === "string" ? endDate : null,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message ?? "Failed to accept filter preset payload",
      },
      { status: 400 }
    );
  }
}

