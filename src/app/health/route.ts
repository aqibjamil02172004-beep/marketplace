// src/app/health/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true, status: "healthy" });
}

export async function POST() {
  return NextResponse.json({ ok: true, status: "healthy" });
}
