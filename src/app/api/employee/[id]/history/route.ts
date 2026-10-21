import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireUser, getOwnUserDoc } from "@/lib/server-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Salary history: only for signed-in users whom the admin has allowed
  // "Basic Pay Auto-Fill" (same permission the app already uses).
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  if (!auth.user.isAdmin) {
    try {
      const info = await getOwnUserDoc(auth.user);
      if (info.allowBasicPayAutoFill !== true) {
        return NextResponse.json(
          { error: "Basic pay auto-fill is not enabled for your account." },
          { status: 403 }
        );
      }
    } catch (err) {
      console.error("Permission check failed:", err);
      return NextResponse.json({ error: "Could not verify permission." }, { status: 503 });
    }
  }

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

  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);
  if (!(monthNum >= 1 && monthNum <= 12) || !(yearNum >= 1950 && yearNum <= 2100)) {
    return NextResponse.json({ error: "Invalid month or year" }, { status: 400 });
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
    const result = await db.query(query, [id, yearNum, monthNum]);

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
