import { NextRequest, NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/booking";
import { format, addDays } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || format(new Date(), "yyyy-MM-dd");
    const days = parseInt(searchParams.get("days") || "14", 10);

    const slots = await getAvailableSlots(date, days);

    return NextResponse.json({ slots });
  } catch (error) {
    console.error("Slots error:", error);
    return NextResponse.json(
      { error: "Failed to fetch available slots" },
      { status: 500 }
    );
  }
}
