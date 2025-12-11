import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const base = `${url.protocol}//${url.host}`;

  const res = await fetch(`${base}/api/authentication`, {
    method: "POST",
  });

  const data = await res.json().catch(() => null);

  return NextResponse.json(
    { ok: res.ok, status: res.status, data },
    { status: 200 }
  );
}
