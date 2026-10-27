"use client";

// A4 printout of an Arrear Summary. Only shown while printing (print:block); the
// screen UI is marked no-print. Page margins, "Page X of Y" footer, repeating table
// header and the light theme come from globals.css (@page and .summary-print-area).

import * as React from "react";
import {
  amountInWords,
  formatINR,
  groupRowsByUser,
  reasonText,
  totalsOf,
  ymdToDisplay,
  type ArrearSummary,
  type SummaryPrintSettings,
  type SummaryRow,
  type SummaryTotals,
} from "@/lib/summary-engine";

const todayDisplay = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
};

const isoDisplay = (iso: string) => {
  const d = new Date(iso);
  if (!iso || isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
};

const period = (r: SummaryRow) =>
  r.fromDate || r.toDate ? `${ymdToDisplay(r.fromDate) || "—"} to ${ymdToDisplay(r.toDate) || "—"}` : "—";

const Amt = ({ v }: { v: number }) => <>{v ? formatINR(v) : "—"}</>;

function TotalCells({ t }: { t: SummaryTotals }) {
  return (
    <>
      <td className="num">{formatINR(t.arrear)}</td>
      <td className="num">{formatINR(t.recovery)}</td>
    </>
  );
}

export function SummaryPrint({
  summary,
  rows,
  settings,
}: {
  summary: ArrearSummary;
  rows: SummaryRow[];
  settings: SummaryPrintSettings;
}) {
  const totals = totalsOf(rows);
  const groups = summary.groupByUser ? groupRowsByUser(rows) : [];
  const reason = reasonText(summary);
  const rangeText =
    summary.range && (summary.range.from || summary.range.to)
      ? summary.range.from && summary.range.to
        ? `Statements prepared from ${ymdToDisplay(summary.range.from)} to ${ymdToDisplay(summary.range.to)}`
        : summary.range.from
          ? `Statements prepared on or after ${ymdToDisplay(summary.range.from)}`
          : `Statements prepared up to ${ymdToDisplay(summary.range.to)}`
      : "";
  const rangeLine = rangeText && summary.addedIds.length ? `${rangeText}, and other statements as listed` : rangeText;
  const detailed = summary.layout !== "totals";

  const detailRow = (r: SummaryRow, i: number) => (
    <tr key={r.statementId}>
      <td className="c">{i + 1}</td>
      <td>{r.employeeId}</td>
      <td className="c">{r.salaryRegisterNo || "—"}</td>
      <td className="wrap">
        <b>{r.employeeName}</b>
        {r.designation ? <div>{r.designation}</div> : null}
      </td>
      <td className="wrap">{r.department}</td>
      <td className="c">{period(r)}</td>
      <td className="wrap">{r.reason || "—"}</td>
      <td className="num"><Amt v={r.difference > 0 ? r.difference : 0} /></td>
      <td className="num"><Amt v={r.difference < 0 ? -r.difference : 0} /></td>
    </tr>
  );

  let serial = 0;

  return (
    <div className="summary-print-area hidden print:block">
      <div className="sp-head">
        <div className="sp-h1">{settings.headingLine1}</div>
        {settings.headingLine2 ? <div className="sp-h2">{settings.headingLine2}</div> : null}
        <div className="sp-title">ARREAR SUMMARY</div>
        {summary.title ? <div className="sp-sub">{summary.title}</div> : null}
      </div>

      <table className="sp-meta">
        <tbody>
          <tr>
            <td>
              {reason ? (<><b>Reason:</b> {reason}</>) : null}
              {summary.orderNo ? (<><br /><b>Order / Ref.:</b> {summary.orderNo}</>) : null}
              {rangeLine ? (<><br />{rangeLine}</>) : null}
            </td>
            <td className="r">
              <b>Date:</b> {todayDisplay()}
              <br />
              {summary.locked ? (
                <>Final (locked on {isoDisplay(summary.lockedAt)})</>
              ) : (
                <>Provisional — figures as on date</>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {detailed ? (
        <table className="sp-table">
          <thead>
            <tr>
              <th>S.No.</th>
              <th>Emp. ID</th>
              <th>Sal. Reg. No.</th>
              <th>Name &amp; Designation</th>
              <th>Department</th>
              <th>Arrear Period</th>
              <th>Reason</th>
              <th>Arrear (Rs.)</th>
              <th>Recovery (Rs.)</th>
            </tr>
          </thead>
          <tbody>
            {summary.groupByUser
              ? groups.map((g) => (
                  <React.Fragment key={g.key}>
                    <tr className="sp-group">
                      <td colSpan={9}>
                        {g.userName || g.userEmail || "Unknown user"}
                        {g.userName && g.userEmail ? ` (${g.userEmail})` : ""} — {g.rows.length} statement(s)
                      </td>
                    </tr>
                    {g.rows.map((r) => detailRow(r, serial++))}
                    <tr className="sp-subtotal">
                      <td colSpan={7} className="r">Sub-total</td>
                      <TotalCells t={g.totals} />
                    </tr>
                  </React.Fragment>
                ))
              : rows.map((r, i) => detailRow(r, i))}
            <tr className="sp-total">
              <td colSpan={7} className="r">GRAND TOTAL ({totals.count} statement{totals.count === 1 ? "" : "s"})</td>
              <TotalCells t={totals} />
            </tr>
          </tbody>
        </table>
      ) : (
        <table className="sp-table">
          <thead>
            <tr>
              <th>S.No.</th>
              <th>{summary.groupByUser ? "User" : "Particulars"}</th>
              <th>Statements</th>
              <th>Arrear (Rs.)</th>
              <th>Recovery (Rs.)</th>
              <th>Net (Rs.)</th>
            </tr>
          </thead>
          <tbody>
            {summary.groupByUser ? (
              groups.map((g, i) => (
                <tr key={g.key}>
                  <td className="c">{i + 1}</td>
                  <td className="wrap">
                    {g.userName || g.userEmail || "Unknown user"}
                    {g.userName && g.userEmail ? <div>{g.userEmail}</div> : null}
                  </td>
                  <td className="c">{g.totals.count}</td>
                  <TotalCells t={g.totals} />
                  <td className="num">{formatINR(g.totals.net)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="c">1</td>
                <td className="wrap">{reason || summary.title || "Arrear"}</td>
                <td className="c">{totals.count}</td>
                <TotalCells t={totals} />
                <td className="num">{formatINR(totals.net)}</td>
              </tr>
            )}
            <tr className="sp-total">
              <td colSpan={2} className="r">GRAND TOTAL</td>
              <td className="c">{totals.count}</td>
              <TotalCells t={totals} />
              <td className="num">{formatINR(totals.net)}</td>
            </tr>
          </tbody>
        </table>
      )}

      <div className="sp-keep">
        <table className="sp-totals">
          <tbody>
            <tr><td>Total Arrear</td><td className="num">Rs. {formatINR(totals.arrear)}/-</td></tr>
            <tr><td>Less: Total Recovery</td><td className="num">Rs. {formatINR(totals.recovery)}/-</td></tr>
            <tr className="sp-net"><td>{totals.net >= 0 ? "Net Payable" : "Net Recoverable"}</td><td className="num">Rs. {formatINR(Math.abs(totals.net))}/-</td></tr>
          </tbody>
        </table>

        <p className="sp-pass">
          {totals.net >= 0 ? "Passed for payment of" : "Passed for recovery of"} Rs. {formatINR(Math.abs(totals.net))}/- (Rupees{" "}
          {amountInWords(totals.net)}) being the net arrear{reason ? ` on account of ${reason}` : ""} in respect of {totals.count}{" "}
          statement{totals.count === 1 ? "" : "s"} as detailed above.
        </p>
        {summary.remark ? <p className="sp-remark"><b>Remark:</b> {summary.remark}</p> : null}

        <div className="sp-sign">
          {settings.signatories.map((s) => (
            <div key={s}>{s}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
