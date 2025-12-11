// app/api/authentication/route.ts
import { NextResponse } from "next/server";

const MHPL_BASE_URL =
  process.env.MHPL_BASE_URL ?? "http://appit.ignitetechno.com:8080";

const MHPL_USERNAME = process.env.MHPL_USERNAME ?? "MHPL.API";
const MHPL_PASSWORD = process.env.MHPL_PASSWORD ?? "1234567890#25";

export async function POST() {
  try {
    const basicAuthValue =
      "Basic " +
      Buffer.from(`${MHPL_USERNAME}:${MHPL_PASSWORD}`).toString("base64");

    const url = `${MHPL_BASE_URL}/ords/xapi/auth/token`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: basicAuthValue,
        Accept: "application/json, */*",
      },
    });

    const rawBody = await res.text();

    return NextResponse.json(
      {
        sentTo: url,
        username: MHPL_USERNAME,
        basicAuthValue,
        statusFromOracle: res.status,
        statusTextFromOracle: res.statusText,
        success: res.ok,
        rawBody,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: "Internal error while calling MHPL auth",
        error: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}
