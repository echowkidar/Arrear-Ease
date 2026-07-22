import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = await params;

  if (!id || id.length !== 5) {
    return NextResponse.json(
      { error: "Invalid employee ID" },
      { status: 400 }
    );
  }

  try {
    const db = getDb();
    const query = `
      SELECT 
        e.name, 
        e.designation, 
        d.dept_name as department
      FROM employees e 
      LEFT JOIN department_names d ON e.department_id = d.id 
      WHERE e.epid = $1
    `;
    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Employee not found" },
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
