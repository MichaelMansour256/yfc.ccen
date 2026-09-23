import { NextResponse } from "next/server";
import { getInvitations } from "@/lib/invitations";

export async function GET() {
  const invitations = await getInvitations();
  return NextResponse.json(invitations);
}
