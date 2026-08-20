import { NextRequest, NextResponse } from "next/server";

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
    "refixedBasicPayDate": "YYYY-MM-DD",
    "incrementMonth": "string"
  }
}

Use the image to extract:
- Name of employee
- I.D. No.
- Designation (Old)
- Department
- From Date: Find the "Internal Audit Office Endorsement" section at the bottom. Extract the date immediately following the first "on" (e.g. "Pay Fixed at 26000 on 17.01.2023"). Format as YYYY-MM-DD.
- Pay Fixation Reference: Extract the "D.No." and "Dated" value from the top right (e.g., "D.No: 1044 /PRC Dated: 10/8/26").
- Existing Level in the revised pay structure (extract the level number, e.g. "1" from "Level - 1")
- Pay in the revised pay structure as on the effective date (this is paid.basicPay)
- Date of Next Increment (DNI) in the existing level (extract month for incrementMonth, e.g. "7" if July, "1" if Jan)
- Level in which appointed/promoted (this is toBePaid.payLevel, e.g. "2" from "Level - 2")
- Pay in the upgraded Level (Section 12) (this is toBePaid.basicPay, e.g. 26000)
- Re-fixed amount (Section 12(a)) (this is toBePaid.refixedBasicPay, e.g. 27600)
- Date of re-fixation (Section 12(a)) (for refixedBasicPayDate format as YYYY-MM-DD)

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
