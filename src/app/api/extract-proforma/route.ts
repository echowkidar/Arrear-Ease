import { NextRequest, NextResponse } from "next/server";
import { cpcData } from "@/lib/cpc-data";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString("base64");

    const ollamaApiKey = process.env.OLLAMA_API_KEY;
    const ollamaUrl = process.env.OLLAMA_URL || (ollamaApiKey ? "https://ollama.com" : "http://127.0.0.1:11434");
    const ollamaModel = process.env.OLLAMA_MODEL || "llama3.2-vision";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (ollamaApiKey) {
      headers["Authorization"] = `Bearer ${ollamaApiKey}`;
    }

    const validPayLevels = cpcData['7th'].payLevels.map((l: any) => l.level).join(", ");

    const prompt = `
You are a data extraction assistant. I will provide an image of a "PROFORMA FOR FIXATION OF PAY".
Extract the following information and return it strictly as a JSON object matching this structure:

{
  "employeeName": "string",
  "employeeId": "string",
  "designation": "string",
  "department": "string",
  "fromDate": "YYYY-MM-DD",
  "payFixationRef": "string",
  "paid": {
    "cpc": "7th",
    "basicPay": 0,
    "payLevel": "string",
    "incrementMonth": "string"
  },
  "toBePaid": {
    "cpc": "7th",
    "basicPay": 0,
    "payLevel": "string",
    "refixedBasicPay": 0,
    "refixedBasicPayDate": "",
    "incrementMonth": "string"
  },
  "fullTextSummary": "string - Complete narrative summary of all sections, clauses, fixation rules, and notes present in the document",
  "orderClauses": "string - Any specific legal clauses, option under FR rules, internal audit endorsement text, or special conditions mentioned in the order"
}

IMPORTANT DATE INSTRUCTION:
All dates in the image are in Indian format (DD.MM.YYYY or DD/MM/YYYY). For example, "09.04.2022" means 9th April 2022, NOT September 4th. You must correctly parse these dates and strictly format them as YYYY-MM-DD.

Use the image to extract:
- Name of employee
- I.D. No.
- Designation (Old)
- Department
- From Date: Find the "Internal Audit Office Endorsement" section at the bottom. Extract the date immediately following the first "on" (e.g. "Pay Fixed at 26000 on 17.01.2023"). Format as YYYY-MM-DD.
- Pay Fixation Reference: Combine the "D.No./PRC Dated" from the top right corner AND the details from Section 14 "O.M./Ref. No. & Date".
- Existing Level in the revised pay structure (extract the level number, e.g. "12" from "Level - 12" or "AL-12" if applicable). IMPORTANT: Must EXACTLY match one of these valid levels: [${validPayLevels}]. If it doesn't match, choose the closest valid level.
- Pay in the revised pay structure as on the effective date (this is paid.basicPay)
- Date of Next Increment in the existing level (Section 8) (extract month number for paid.incrementMonth, e.g. "7" if July, "1" if Jan)
- Level in which appointed/promoted (this is toBePaid.payLevel, e.g. "13" from "Level - 13"). IMPORTANT: Must EXACTLY match one of these valid levels: [${validPayLevels}]. If it doesn't match, choose the closest valid level.
- Pay in the upgraded Level (Section 12) (this is toBePaid.basicPay, e.g. 26000)
- Date of Next Increment in upgraded level (Section 13) (extract month number for toBePaid.incrementMonth, e.g. "7" if July, "1" if Jan)
- Re-fixed amount (Section 12(a)) (this is toBePaid.refixedBasicPay, e.g. 27600. If Section 12(a) does NOT exist, return 0)
- Date of re-fixation (Section 12(a)) (this is toBePaid.refixedBasicPayDate format YYYY-MM-DD. If Section 12(a) does NOT exist, return "")
- Full Text Summary of the entire proforma: Include all sections (1 to 15), table headers, and remarks.
- Order Clauses: Include exact text from Internal Audit Endorsement, option availed under FR 22(1)(a)(1), notional increment notes, and administrative conditions.

Return ONLY the raw JSON object, without any markdown formatting, backticks, or extra text.
`;

    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: "POST",
      headers: headers,
      body: JSON.stringify({
        model: ollamaModel,
        prompt: prompt,
        images: [base64Image],
        format: "json",
        stream: false,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Ollama API Error:", errText);
      return NextResponse.json(
        { error: `Ollama API Error: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    let jsonResponse;
    try {
      jsonResponse = JSON.parse(data.response);
    } catch (e) {
      console.error("Failed to parse JSON from Ollama:", data.response);
      return NextResponse.json({ error: "Failed to parse Ollama response as JSON" }, { status: 500 });
    }

    return NextResponse.json(jsonResponse);
  } catch (error: any) {
    console.error("Error processing proforma:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
