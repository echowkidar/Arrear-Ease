import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = await params;
  const searchParams = request.nextUrl.searchParams;
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  if (!id || id.length !== 5) {
    return NextResponse.json(
      { error: "Invalid employee ID" },
      { status: 400 }
    );
  }

  if (!month || !year) {
    return NextResponse.json(
      { error: "Month and Year are required" },
      { status: 400 }
    );
  }

  try {
    const db = getDb();
    const query = `
      SELECT "BASIC_SAL" as basic_sal, "GRADE_PAY" as grade_pay 
      FROM history 
      WHERE "ECODE" = $1 
        AND "YR_NO" = $2 
        AND "MTH_NO" = $3
      LIMIT 1
    `;
    const result = await db.query(query, [id, parseInt(year), parseInt(month)]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "History record not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error("Database query failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
