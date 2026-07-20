import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { getAllClients, getDashboardStats } from "@/lib/booking";

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const status = request.nextUrl.searchParams.get("status") || "all";
    const [clients, stats] = await Promise.all([
      getAllClients(status === "all" ? undefined : status),
      getDashboardStats(),
    ]);

    return NextResponse.json({ clients, stats });
  } catch (error) {
    console.error("Admin clients error:", error);
    return NextResponse.json({ error: "Failed to fetch clients" }, { status: 500 });
  }
}
