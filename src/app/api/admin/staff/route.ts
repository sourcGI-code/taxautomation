import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { canManageStaff, parseEnvStaffUsers } from "@/lib/staff";

/** List staff accounts visible to owners (env STAFF_USERS + owner) */
export async function GET() {
  const staff = await getAdminSession();
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const owner = {
    id: "owner",
    email: (process.env.ADMIN_EMAIL || "owner@local").toLowerCase(),
    name: process.env.ADMIN_NAME || "Owner",
    role: "owner" as const,
    source: "env",
  };

  const envUsers = parseEnvStaffUsers().map((u) => ({
    id: `env:${u.email}`,
    email: u.email,
    name: u.name,
    role: u.role,
    source: "env" as const,
  }));

  // Never return password material
  const members = [owner, ...envUsers];

  return NextResponse.json({
    current: {
      id: staff.id,
      email: staff.email,
      name: staff.name,
      role: staff.role,
    },
    members: canManageStaff(staff.role) ? members : [staff],
    canManage: canManageStaff(staff.role),
  });
}
