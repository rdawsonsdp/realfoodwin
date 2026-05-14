import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "realfoodwin-web",
    timestamp: new Date().toISOString(),
  });
}
