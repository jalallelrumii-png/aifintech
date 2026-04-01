"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { DATA as SEED_DATA, KAS as SEED_KAS, pct } from "./lib/data";
import type { AppUser } from "./lib/appwrite";

const P = {
  bg: "#06090F", surface: "#0C1220", surfaceHigh: "#111B2E",
  border: "#1A2840", cyan: "#22D3EE", green: "#34D399",
  red: "#F87171", amber: "#FBBF24", text: "#E2E8F0",
  sub: "#94A3B8", muted: "#475569",
};

const LS_DATA    = "fin_data_v1";
const LS_KAS     = "fin_kas_v1";
const LS_KEY     = "fin_groq_key_v1";
const LS_COMPANY = "fin_company_v1";
const LS_DOC_ID  = "fin_doc_id_v1";

interface RawRow { bulan: string; pendapatan: number; beban: number; }
interface Row extends RawRow { laba: number; gpm: number; anomali: boolean; }

function computeRows(raw: RawRow[]): Row[] {
  return raw.map(d => {
    const laba = d.pendapatan - d.beban;
    const gpm  = d.pendapatan > 0 ? parseFloat((laba / d.pendapatan * 100).toFixed(1)) : 0;
    return { ...d, laba, gpm, anomali: d.beban > d.pendapatan * 0.9 };
  });
}

async function generatePDF(data: Row[], kas: number, company: string) {
  const { jsPDF }  = await import("jspdf");
  const autoTable  = (await import("jspdf-autotable")).default;
  const doc   = new jsPDF("p", "mm", "a4");
  const pageW = 210;

  doc.setFillColor(12, 18, 32);
  doc.rect(0, 0, pageW, 46, "F");
  doc.setFillColor(34, 211, 238);
  doc.rect(0, 0, 3, 46, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(226, 232, 240);
  doc.text("LAPORAN KEUANGAN", 12, 18);
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text(company, 12, 27);
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const period = data.length > 0 ? `Periode: ${data[0].bulan} — ${data[data.length - 1].bulan}` : "";
  doc.text(period, 12, 34);
  doc.text(`Dibuat: ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`, 12, 40);
  doc.setTextColor(34, 211, 238);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("LOGIKA FINANCIAL AI", pageW - 12, 40, { align: "right" });

  const LATEST = data[data.length - 1];
  const RUNWAY  = LATEST.beban > 0 ? Math.floor(kas / LATEST.beban) : 999;
  const totPend = data.reduce((s, d) => s + d.pendapatan, 0);
  const totLaba = data.reduce((s, d) => s + d.laba, 0);
  const avgGPM  = data.length ? (data.reduce((s, d) => s + d.gpm, 0) / data.length).toFixed(1) : "0";

  type RGB = [number, number, number];
  const kpis: { label: string; value: string; color: RGB }[] = [
    { label: "Total Pendapatan",  value: `Rp ${totPend.toLocaleString("id")} Jt`,  color: [34,211,238] },
    { label: "Total Laba Bersih", value: `Rp ${totLaba.toLocaleString("id")} Jt`,  color: totLaba >= 0 ? [52,211,153] : [248,113,113] },
    { label: "Avg Gross Margin",  value: `${avgGPM}%`,                              color: [52,211,153] },
    { label: "Kas Tersedia",      value: `Rp ${kas.toLocaleString("id")} Jt`,       color: [34,211,238] },
    { label: "Burn Rate",         value: `Rp ${LATEST.beban} Jt/bln`,              color: [251,191,36] },
    { label: "Runway",            value: RUNWAY >= 999 ? "Aman" : `${RUNWAY} bln`, color: RUNWAY <= 6 ? [248,113,113] : [52,211,153] },
  ];
  const bw = (pageW - 14 - 5 * 4) / 3;
  kpis.forEach((kpi, i) => {
    const col = i % 3; const row = Math.floor(i / 3);
    const x = 14 + col * (bw + 4); const y = 52 + row * 22;
    doc.setFillColor(17, 27, 46);
    doc.roundedRect(x, y, bw, 18, 2, 2, "F");
    doc.setDrawColor(26, 40, 64);
    doc.roundedRect(x, y, bw, 18, 2, 2, "S");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text(kpi.label.toUpperCase(), x + 3, y + 6);
    doc.setFontSize(9);
    doc.setTextColor(...kpi.color);
    doc.text(kpi.value, x + 3, y + 13.5);
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text("DATA BULANAN", 14, 102);

  autoTable(doc, {
    startY: 106,
    head: [["Bulan", "Pendapatan (Jt)", "Beban (Jt)", "Laba Bersih (Jt)", "GPM %", "Status"]],
    body: data.map(d => [d.bulan, d.pendapatan.toLocaleString("id"), d.beban.toLocaleString("id"), d.laba.toLocaleString("id"), `${d.gpm}%`, d.anomali ? "! Anomali" : "OK Normal"]),
    styles:          { fontSize: 8.5, cellPadding: 3.5, textColor: [226,232,240], fillColor: [6,9,15], lineColor: [26,40,64], lineWidth: 0.25 },
    headStyles:      { fillColor: [17,27,46], textColor: [148,163,184], fontStyle: "bold", fontSize: 7.5 },
    alternateRowStyles: { fillColor: [12,18,32] },
    didParseCell: (hook: any) => {
      if (hook.section !== "body") return;
      if (hook.column.index === 5) hook.cell.styles.textColor = hook.cell.text[0]?.includes("Anomali") ? [251,191,36] : [52,211,153];
      if (hook.column.index === 3) {
        const v = parseFloat(String(hook.cell.text[0]).replace(/\./g, "").replace(",", ".") || "0");
        hook.cell.styles.textColor = v < 0 ? [248,113,113] : [52,211,153];
      }
    },
  });

  const anomalies = data.filter(d => d.anomali);
  if (anomalies.length) {
    const y = (doc as any).lastAutoTable.finalY + 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text("DETEKSI ANOMALI", 14, y);
    autoTable(doc, {
      startY: y + 4,
      head: [["Bulan", "Beban / Pendapatan", "Laba"]],
      body: anomalies.map(d => [d.bulan, `${d.pendapatan > 0 ? ((d.beban / d.pendapatan) * 100).toFixed(0) : "~"}%`, `${d.laba >= 0 ? "+" : ""}${d.laba} Jt`]),
      styles:     { fontSize: 8.5, cellPadding: 3.5, textColor: [251,191,36], fillColor: [12,18,32], lineColor: [26,40,64], lineWidth: 0.25 },
      headStyles: { fillColor: [17,27,46], textColor: [148,163,184], fontStyle: "bold", fontSize: 7.5 },
    });
  }

  const pages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Logika Financial AI  •  Halaman ${i} dari ${pages}`, 14, 290);
    doc.text(new Date().toISOString().slice(0, 10), pageW - 14, 290, { align: "right" });
  }
  doc.save(`laporan-keuangan-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function mapToRows(rows: Record<string, unknown>[]): RawRow[] {
  if (!rows.length) throw new Error("File kosong.");
  const rawKeys = Object.keys(rows[0]);
  const lcKeys  = rawKeys.map(k => k.toLowerCase().trim());
  const findCol = (vs: string[]) => { const lc = lcKeys.find(k => vs.some(v => k.includes(v))); return lc ? rawKeys[lcKeys.indexOf(lc)] : null; };
  const bulanCol = findCol(["bulan", "month", "periode", "bln"]);
  const pendCol  = findCol(["pendapatan", "revenue", "income", "pemasukan", "pend"]);
  const bebanCol = findCol(["beban", "expense", "biaya", "pengeluaran", "cost"]);
  if (!bulanCol || !pendCol || !bebanCol)
    throw new Error(`Kolom tidak ditemukan.\nDibutuhkan: bulan, pendapatan, beban\nTerdeteksi: ${rawKeys.join(", ")}`);
  return rows.map((r, i) => {
    const pendapatan = Number(String(r[pendCol] ?? "").replace(/[^\d.-]/g, ""));
    const beban      = Number(String(r[bebanCol] ?? "").replace(/[^\d.-]/g, ""));
    if (isNaN(pendapatan) || isNaN(beban)) throw new Error(`Baris ${i + 2}: nilai tidak valid.`);
    return { bulan: String(r[bulanCol] ?? "").trim(), pendapatan, beban };
  }).filter(r => r.bulan && r.pendapatan > 0);
}

async function parseUploadedFile(file: File): Promise<RawRow[]> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "csv" || ext === "txt") {
    const Papa = (await import("papaparse")).default;
    return new Promise((res, rej) => {
      Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: r => { try { res(mapToRows(r.data as Record<string, unknown>[])); } catch (e) { rej(e); } },
        error: e => rej(new Error(e.message)),
      });
    });
  }
  if (ext === "xlsx" || ext === "xls") {
    const XLSX = await import("xlsx");
    const buf  = await file.arrayBuffer();
    const wb   = XLSX.read(buf);
    const ws   = wb.Sheets[wb.SheetNames[0]];
    return mapToRows(XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[]);
  }
  throw new Error("Format tidak didukung. Gunakan .csv atau .xlsx");
}

function downloadTemplate() {
  const csv  = "bulan,pendapatan,beban\nJan'25,335,285\nFeb'25,295,305\nMar'25,340,260";
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), { href: url, download: "template-keuangan.csv" }).click();
  URL.revokeObjectURL(url);
}

const CTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: P.surfaceHigh, border: `1px solid ${P.border}`, borderRadius: 8, padding: "10px 14px" }}>
      <div style={{ fontSize: 11, color: P.muted, fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ fontSize: 12, color: p.color, marginBottom: 2 }}>
          {p.name}: <span style={{ fontFamily: "monospace", fontWeight: 700 }}>Rp {p.value} Jt</span>
        </div>
      ))}
    </div>
  );
};

const KCard = ({ label, value, unit, d, accent = P.cyan, alert, sub }: any) => {
  const dNum = parseFloat(d); const dValid = !isNaN(dNum) && isFinite(dNum);
  return (
    <div style={{ background: P.surface, border: `1px solid ${alert ? P.amber + "88" : P.border}`, borderRadius: 12, padding: "14px 16px", position: "relative", overflow: "hidden" }}>
      {alert && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: P.amber }} />}
      <div style={{ fontSize: 10, color: P.muted, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 700, color: accent, lineHeight: 1 }}>
        {value}{unit && <span style={{ fontSize: 12, color: P.sub, marginLeft: 3 }}>{unit}</span>}
      </div>
      {dValid && <div style={{ fontSize: 11, color: dNum >= 0 ? P.green : P.red, marginTop: 5 }}>{dNum >= 0 ? "▲" : "▼"} {Math.abs(dNum)}% vs bln lalu</div>}
      {sub && <div style={{ fontSize: 11, color: P.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
};

const SecTitle = ({ icon, children }: any) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
    <span style={{ fontSize: 14 }}>{icon}</span>
    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: P.muted, textTransform: "uppercase" }}>{children}</span>
    <div style={{ flex: 1, height: "0.5px", background: P.border }} />
  </div>
);

function AuthModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (user: AppUser) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState(""); const [pass, setPass] = useState(""); const [name, setName] = useState("");
  const [loading, setLoading] = useState(false); const [err, setErr] = useState("");

  const submit = async () => {
    if (!email || !pass) { setErr("Email dan password wajib diisi."); return; }
    if (mode === "register" && !name) { setErr("Nama wajib diisi."); return; }
    setLoading(true); setErr("");
    try {
      const { loginUser, registerUser } = await import("./lib/appwrite");
      const user = mode === "login" ? await loginUser(email, pass) : await registerUser(email, pass, name);
      onSuccess(user);
    } catch (e: any) { setErr(e.message || "Gagal login."); }
    setLoading(false);
  };

  const inp: React.CSSProperties = { width: "100%", background: P.bg, border: `1px solid ${P.border}`, borderRadius: 8, padding: "10px 12px", color: P.text, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 16, padding: 24, width: "100%", maxWidth: 360 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: P.text, marginBottom: 4 }}>☁️ Cloud Sync</div>
        <div style={{ fontSize: 12, color: P.muted, marginBottom: 20 }}>Data tersinkron di semua device kamu.</div>
        <div style={{ display: "flex", background: P.bg, borderRadius: 10, padding: 3, marginBottom: 20 }}>
          {(["login", "register"] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setErr(""); }} style={{ flex: 1, padding: 9, borderRadius: 8, border: "none", background: mode === m ? P.surfaceHigh : "transparent", color: mode === m ? P.text : P.muted, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              {m === "login" ? "🔑 Login" : "✨ Daftar"}
            </button>
          ))}
        </div>
        {mode === "register" && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: P.muted, marginBottom: 6, fontWeight: 700, textTransform: "uppercase" }}>Nama</div>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nama lengkap" style={inp} />
          </div>
        )}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: P.muted, marginBottom: 6, fontWeight: 700, textTransform: "uppercase" }}>Email</div>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@perusahaan.com" style={inp} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: P.muted, marginBottom: 6, fontWeight: 700, textTransform: "uppercase" }}>Password</div>
          <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" style={inp} onKeyDown={e => e.key === "Enter" && submit()} />
        </div>
        {err && <div style={{ fontSize: 12, color: P.red, marginBottom: 12 }}>⚠ {err}</div>}
        <button onClick={submit} disabled={loading} style={{ width: "100%", background: loading ? P.border : P.cyan, color: P.bg, border: "none", borderRadius: 8, padding: 12, fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", marginBottom: 10 }}>
          {loading ? "⏳ Loading..." : mode === "login" ? "🔑 Login" : "✨ Buat Akun"}
        </button>
        <button onClick={onClose} style={{ width: "100%", background: "none", border: "none", padding: "8px 0", fontSize: 12, color: P.muted, cursor: "pointer", fontFamily: "inherit" }}>Batal</button>
      </div>
    </div>
  );
}

function Dashboard({ data, kas, company, onExport, exporting }: { data: Row[]; kas: number; company: string; onExport: () => void; exporting: boolean }) {
  if (!data.length) return (
    <div style={{ padding: 32, textAlign: "center", color: P.muted, fontSize: 13 }}>
      Belum ada data. Tambah data di tab <strong style={{ color: P.cyan }}>📝 Input</strong>.
    </div>
  );
  const LATEST = data[data.length - 1]; const PREV = data[data.length - 2] ?? LATEST;
  const RUNWAY = LATEST.beban > 0 ? Math.floor(kas / LATEST.beban) : 999;
  const ANOMALIES = data.filter(d => d.anomali);
  const BULAN = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: P.muted, textTransform: "uppercase" }}>📊 Ringkasan — {LATEST.bulan}</div>
        <button onClick={onExport} disabled={exporting} style={{ display: "flex", alignItems: "center", gap: 5, background: exporting ? P.border : `${P.cyan}18`, border: `1px solid ${exporting ? P.border : P.cyan + "60"}`, borderRadius: 8, padding: "7px 12px", fontSize: 11, fontWeight: 700, color: exporting ? P.muted : P.cyan, cursor: exporting ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
          {exporting ? "⏳" : "📄"} {exporting ? "Generating..." : "Export PDF"}
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
        <KCard label="Pendapatan"   value={LATEST.pendapatan} unit="Jt"      d={pct(LATEST.pendapatan, PREV.pendapatan)} accent={P.cyan} />
        <KCard label="Laba Bersih"  value={LATEST.laba}       unit="Jt"      d={pct(LATEST.laba, PREV.laba)} accent={LATEST.laba > 0 ? P.green : P.red} />
        <KCard label="Gross Margin" value={`${LATEST.gpm}%`}                 accent={LATEST.gpm > 20 ? P.green : P.amber} />
        <KCard label="Burn Rate"    value={LATEST.beban}       unit="Jt/bln" accent={P.amber} />
        <KCard label="Kas Tersedia" value={kas.toLocaleString("id")} unit="Jt" accent={P.cyan} />
        <KCard label="Runway" value={RUNWAY >= 999 ? "∞" : RUNWAY} unit={RUNWAY < 999 ? "bulan" : ""} accent={RUNWAY > 6 ? P.green : P.red} alert={RUNWAY <= 6 && RUNWAY < 999} sub={RUNWAY < 999 ? `Aman s/d ${BULAN[(new Date().getMonth() + RUNWAY) % 12]}` : "Kas aman"} />
      </div>
      <SecTitle icon="📈">Tren Pendapatan vs Beban</SecTitle>
      <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, padding: "16px 4px 8px", marginBottom: 20 }}>
        <ResponsiveContainer width="100%" height={190}>
          <AreaChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={P.cyan} stopOpacity={0.35} /><stop offset="95%" stopColor={P.cyan} stopOpacity={0} /></linearGradient>
              <linearGradient id="gE" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={P.red}  stopOpacity={0.3}  /><stop offset="95%" stopColor={P.red}  stopOpacity={0} /></linearGradient>
            </defs>
            <CartesianGrid stroke={P.border} strokeDasharray="3 3" />
            <XAxis dataKey="bulan" tick={{ fill: P.muted, fontSize: 9 }} />
            <YAxis tick={{ fill: P.muted, fontSize: 9 }} />
            <Tooltip content={<CTip />} />
            <Area type="monotone" dataKey="pendapatan" name="Pendapatan" stroke={P.cyan} fill="url(#gP)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="beban"      name="Beban"      stroke={P.red}  fill="url(#gE)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 4 }}>
          {[{ c: P.cyan, l: "Pendapatan" }, { c: P.red, l: "Beban" }].map(x => (
            <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: P.sub }}>
              <div style={{ width: 20, height: 2, background: x.c, borderRadius: 1 }} />{x.l}
            </div>
          ))}
        </div>
      </div>
      <SecTitle icon="💰">Laba Bersih per Bulan</SecTitle>
      <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, padding: "16px 4px 8px", marginBottom: 20 }}>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
            <CartesianGrid stroke={P.border} strokeDasharray="3 3" />
            <XAxis dataKey="bulan" tick={{ fill: P.muted, fontSize: 9 }} />
            <YAxis tick={{ fill: P.muted, fontSize: 9 }} />
            <Tooltip content={<CTip />} />
            <Bar dataKey="laba" name="Laba Bersih" radius={[4, 4, 0, 0]}>
              {data.map((_: Row, i: number) => <Cell key={i} fill={data[i].laba >= 0 ? P.green : P.red} fillOpacity={0.85} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {ANOMALIES.length > 0 && (
        <>
          <SecTitle icon="⚠️">Deteksi Anomali</SecTitle>
          {ANOMALIES.map((d: Row, i: number) => (
            <div key={i} style={{ background: `${P.amber}12`, border: `1px solid ${P.amber}40`, borderRadius: 10, padding: "12px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: P.amber }}>{d.bulan}</div>
                <div style={{ fontSize: 11, color: P.sub, marginTop: 2 }}>Beban = {d.pendapatan > 0 ? ((d.beban / d.pendapatan) * 100).toFixed(0) : "∞"}% dari pendapatan</div>
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 12, color: d.laba >= 0 ? P.green : P.red, fontWeight: 700 }}>Laba Rp {d.laba}Jt</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function InputData({ rawData, setRawData, kas, setKas }: { rawData: RawRow[]; setRawData: (d: RawRow[]) => void; kas: number; setKas: (v: number) => void }) {
  const empty = { bulan: "", pendapatan: "", beban: "" };
  const [form, setForm] = useState(empty);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [kasDraft, setKasDraft] = useState(String(kas));
  const [kasSaved, setKasSaved] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<RawRow[] | null>(null);
  const [importErr, setImportErr] = useState("");

  useEffect(() => { setKasDraft(String(kas)); }, [kas]);

  const validate = () => {
    if (!form.bulan.trim()) return "Nama bulan wajib diisi.";
    if (!form.pendapatan || isNaN(Number(form.pendapatan)) || Number(form.pendapatan) <= 0) return "Pendapatan harus angka > 0.";
    if (!form.beban      || isNaN(Number(form.beban))      || Number(form.beban)      <= 0) return "Beban harus angka > 0.";
    if (editIdx === null && rawData.find(d => d.bulan === form.bulan.trim())) return `Bulan "${form.bulan}" sudah ada.`;
    return "";
  };

  const submit = () => {
    const e = validate(); if (e) { setErr(e); return; }
    setErr("");
    const row: RawRow = { bulan: form.bulan.trim(), pendapatan: Number(form.pendapatan), beban: Number(form.beban) };
    if (editIdx !== null) { const next = [...rawData]; next[editIdx] = row; setRawData(next); setEditIdx(null); }
    else setRawData([...rawData, row]);
    setForm(empty);
  };

  const del  = (i: number) => setRawData(rawData.filter((_, idx) => idx !== i));
  const edit = (i: number) => { const d = rawData[i]; setForm({ bulan: d.bulan, pendapatan: String(d.pendapatan), beban: String(d.beban) }); setEditIdx(i); setErr(""); };
  const saveKas = () => { const v = Number(kasDraft); if (!isNaN(v) && v >= 0) { setKas(v); setKasSaved(true); setTimeout(() => setKasSaved(false), 2000); } };
  const loadSeed = () => { setRawData(SEED_DATA.map(d => ({ bulan: d.bulan, pendapatan: d.pendapatan, beban: d.beban }))); setKas(SEED_KAS); };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImporting(true); setImportErr(""); setImportPreview(null);
    try { setImportPreview(await parseUploadedFile(file)); }
    catch (err: any) { setImportErr(err.message); }
    setImporting(false); e.target.value = "";
  };

  const confirmImport = (mode: "replace" | "append") => {
    if (!importPreview) return;
    if (mode === "replace") { setRawData(importPreview); }
    else { const ex = new Set(rawData.map(r => r.bulan)); setRawData([...rawData, ...importPreview.filter(r => !ex.has(r.bulan))]); }
    setImportPreview(null);
  };

  const inp = (f: string, v: string) => setForm(p => ({ ...p, [f]: v }));
  const inputStyle: React.CSSProperties = { width: "100%", background: P.bg, border: `1px solid ${P.border}`, borderRadius: 8, padding: "10px 12px", color: P.text, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ padding: 16 }}>
      <SecTitle icon="📂">Import CSV / Excel</SecTitle>
      <input type="file" accept=".csv,.xlsx,.xls" ref={fileRef} onChange={handleFile} style={{ display: "none" }} />
      {!importPreview ? (
        <div style={{ background: P.surface, border: `1.5px dashed ${P.border}`, borderRadius: 12, padding: "20px 16px", marginBottom: 16, textAlign: "center" }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📂</div>
          <div style={{ fontSize: 12, color: P.sub, marginBottom: 4 }}>Upload file keuangan kamu</div>
          <div style={{ fontSize: 11, color: P.muted, marginBottom: 14 }}>Format .csv atau .xlsx · Kolom: bulan, pendapatan, beban</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button onClick={() => fileRef.current?.click()} disabled={importing} style={{ background: P.cyan, color: P.bg, border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {importing ? "⏳ Parsing..." : "Pilih File"}
            </button>
            <button onClick={downloadTemplate} style={{ background: "none", border: `1px solid ${P.border}`, borderRadius: 8, padding: "9px 14px", fontSize: 12, color: P.muted, cursor: "pointer", fontFamily: "inherit" }}>⬇ Template CSV</button>
          </div>
          {importErr && <div style={{ fontSize: 12, color: P.red, marginTop: 12, whiteSpace: "pre-wrap", textAlign: "left" }}>⚠ {importErr}</div>}
        </div>
      ) : (
        <div style={{ background: P.surface, border: `1px solid ${P.green}44`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: P.green, fontWeight: 700, marginBottom: 10 }}>✓ {importPreview.length} baris siap diimport</div>
          <div style={{ background: P.bg, borderRadius: 8, overflow: "hidden", marginBottom: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "7px 10px", background: P.surfaceHigh, fontSize: 10, color: P.muted, fontWeight: 700, textTransform: "uppercase" }}>
              <div>Bulan</div><div>Pendapatan</div><div>Beban</div>
            </div>
            {importPreview.slice(0, 5).map((r, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "7px 10px", borderTop: `1px solid ${P.border}`, fontSize: 11 }}>
                <div style={{ color: P.text }}>{r.bulan}</div>
                <div style={{ fontFamily: "monospace", color: P.cyan }}>{r.pendapatan}</div>
                <div style={{ fontFamily: "monospace", color: P.red }}>{r.beban}</div>
              </div>
            ))}
            {importPreview.length > 5 && <div style={{ padding: "7px 10px", borderTop: `1px solid ${P.border}`, fontSize: 11, color: P.muted, textAlign: "center" }}>+{importPreview.length - 5} baris lagi...</div>}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => confirmImport("replace")} style={{ flex: 1, background: P.cyan, color: P.bg, border: "none", borderRadius: 8, padding: "10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>🔄 Ganti Semua</button>
            <button onClick={() => confirmImport("append")}  style={{ flex: 1, background: P.surfaceHigh, color: P.text, border: `1px solid ${P.border}`, borderRadius: 8, padding: "10px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>➕ Tambahkan</button>
            <button onClick={() => setImportPreview(null)}   style={{ background: "none", border: `1px solid ${P.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: P.muted, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
          </div>
        </div>
      )}

      <SecTitle icon="➕">Tambah / Edit Data Bulanan</SecTitle>
      <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, padding: "16px", marginBottom: 16 }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: P.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Nama Bulan</div>
          <input value={form.bulan} onChange={e => inp("bulan", e.target.value)} placeholder="contoh: Apr'25" style={inputStyle} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: P.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Pendapatan (Jt)</div>
            <input type="number" value={form.pendapatan} onChange={e => inp("pendapatan", e.target.value)} placeholder="335" style={inputStyle} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: P.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Beban (Jt)</div>
            <input type="number" value={form.beban} onChange={e => inp("beban", e.target.value)} placeholder="285" style={inputStyle} />
          </div>
        </div>
        {err && <div style={{ fontSize: 12, color: P.red, marginBottom: 10 }}>⚠ {err}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={submit} style={{ flex: 1, background: editIdx !== null ? P.amber : P.cyan, color: P.bg, border: "none", borderRadius: 8, padding: "11px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {editIdx !== null ? "✏️ Update Data" : "➕ Tambah Bulan"}
          </button>
          {editIdx !== null && (
            <button onClick={() => { setEditIdx(null); setForm(empty); setErr(""); }} style={{ background: "none", border: `1px solid ${P.border}`, borderRadius: 8, padding: "11px 14px", fontSize: 12, color: P.muted, cursor: "pointer", fontFamily: "inherit" }}>Batal</button>
          )}
        </div>
      </div>

      <SecTitle icon="💰">Kas Perusahaan (Jt)</SecTitle>
      <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, padding: "16px", marginBottom: 16, display: "flex", gap: 8 }}>
        <input type="number" value={kasDraft} onChange={e => setKasDraft(e.target.value)} placeholder="1290" style={{ ...inputStyle, flex: 1 }} />
        <button onClick={saveKas} style={{ background: kasSaved ? P.green : P.surfaceHigh, color: kasSaved ? P.bg : P.text, border: `1px solid ${P.border}`, borderRadius: 8, padding: "10px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
          {kasSaved ? "✓ Saved" : "Simpan"}
        </button>
      </div>

      <SecTitle icon="📋">Data Tersimpan ({rawData.length} bulan)</SecTitle>
      {rawData.length === 0 ? (
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <div style={{ fontSize: 12, color: P.muted, marginBottom: 14 }}>Belum ada data. Import file atau tambah manual.</div>
          <button onClick={loadSeed} style={{ background: P.surfaceHigh, border: `1px solid ${P.border}`, borderRadius: 8, padding: "10px 20px", fontSize: 12, color: P.sub, cursor: "pointer", fontFamily: "inherit" }}>📥 Muat Data Contoh (9 Bulan)</button>
        </div>
      ) : (
        <>
          <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 60px", padding: "9px 12px", background: P.surfaceHigh, fontSize: 10, color: P.muted, fontWeight: 700, textTransform: "uppercase" }}>
              <div>Bulan</div><div>Pendapatan</div><div>Beban</div><div>Laba</div><div></div>
            </div>
            {rawData.map((d: RawRow, i: number) => {
              const laba = d.pendapatan - d.beban;
              return (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 60px", padding: "10px 12px", borderTop: `1px solid ${P.border}`, fontSize: 12, alignItems: "center" }}>
                  <div style={{ color: d.beban > d.pendapatan * 0.9 ? P.amber : P.text, fontWeight: 700 }}>{d.bulan}</div>
                  <div style={{ fontFamily: "monospace", color: P.cyan }}>{d.pendapatan}</div>
                  <div style={{ fontFamily: "monospace", color: P.red }}>{d.beban}</div>
                  <div style={{ fontFamily: "monospace", color: laba >= 0 ? P.green : P.red, fontWeight: 700 }}>{laba >= 0 ? "+" : ""}{laba}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => edit(i)} style={{ background: "none", border: "none", color: P.amber, cursor: "pointer", fontSize: 14, padding: 0 }}>✏️</button>
                    <button onClick={() => del(i)}  style={{ background: "none", border: "none", color: P.red,   cursor: "pointer", fontSize: 14, padding: 0 }}>🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
          <button onClick={loadSeed} style={{ width: "100%", background: "none", border: `1px solid ${P.border}`, borderRadius: 8, padding: "10px", fontSize: 11, color: P.muted, cursor: "pointer", fontFamily: "inherit" }}>↺ Reset ke Data Contoh</button>
        </>
      )}
    </div>
  );
}

function AnalisisAI({ data, aiText, aiLoading, callAI, hasKey }: { data: Row[]; kas: number; aiText: string; aiLoading: boolean; callAI: () => void; hasKey: boolean }) {
  return (
    <div style={{ padding: 16 }}>
      <SecTitle icon="🤖">Executive Summary AI</SecTitle>
      {!hasKey && <div style={{ background: `${P.amber}12`, border: `1px solid ${P.amber}44`, borderRadius: 10, padding: "12px 14px", marginBottom: 14, fontSize: 12, color: P.amber }}>⚠️ Groq API Key belum diset. Masuk tab <strong>⚙️ Setting</strong>.</div>}
      {data.length < 2 && <div style={{ background: `${P.cyan}10`, border: `1px solid ${P.cyan}30`, borderRadius: 10, padding: "12px 14px", marginBottom: 14, fontSize: 12, color: P.sub }}>ℹ️ Tambah minimal 2 bulan data untuk analisis optimal.</div>}
      <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: P.sub, lineHeight: 1.7, marginBottom: 18, textAlign: "center" }}>AI menganalisis {data.length} bulan data keuangan → ringkasan eksekutif, risiko, rekomendasi aksi.</div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button onClick={callAI} disabled={aiLoading || !hasKey || data.length < 1} style={{ background: (!hasKey || aiLoading || data.length < 1) ? P.border : P.cyan, color: (!hasKey || aiLoading || data.length < 1) ? P.muted : P.bg, border: "none", borderRadius: 8, padding: "11px 28px", fontSize: 13, fontWeight: 700, cursor: (!hasKey || aiLoading || data.length < 1) ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
            {aiLoading ? "⏳ Menganalisis..." : !hasKey ? "🔒 API Key Diperlukan" : "⚡ Generate Analisis AI"}
          </button>
        </div>
      </div>
      {aiLoading && (
        <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, padding: 28, textAlign: "center" }}>
          <div style={{ fontSize: 13, color: P.muted }}>AI sedang membaca data keuangan...</div>
          <div style={{ marginTop: 12, display: "flex", gap: 6, justifyContent: "center" }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: P.cyan, animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite` }} />)}
          </div>
        </div>
      )}
      {aiText && !aiLoading && (
        <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, padding: "20px 18px" }}>
          <div style={{ fontSize: 11, color: P.muted, letterSpacing: "0.08em", marginBottom: 14, textTransform: "uppercase", fontWeight: 700 }}>● Hasil Analisis CFO AI</div>
          <div style={{ fontSize: 13, lineHeight: 1.85, color: P.text, whiteSpace: "pre-wrap" }}>{aiText}</div>
        </div>
      )}
    </div>
  );
}

function Proyeksi({ data }: { data: Row[] }) {
  const [mode, setMode] = useState("base");
  if (data.length < 3) return <div style={{ padding: 32, textAlign: "center", color: P.muted, fontSize: 13 }}>Butuh minimal 3 bulan data untuk proyeksi.<br /><span style={{ color: P.cyan }}>Tambah data di tab 📝 Input.</span></div>;
  const LATEST = data[data.length - 1];
  const last3p = data.slice(-3).map(d => d.pendapatan); const last3e = data.slice(-3).map(d => d.beban);
  const trendP = (last3p[2] - last3p[0]) / 2; const trendE = (last3e[2] - last3e[0]) / 2;
  const FCAST = ["Bln+1","Bln+2","Bln+3"].map((bulan, i) => {
    const p = Math.max(0, Math.round(LATEST.pendapatan + trendP * (i + 1)));
    const e = Math.max(0, Math.round(LATEST.beban      + trendE * (i + 1)));
    return { bulan, pendapatan: p, beban: e, laba: p - e, type: "proyeksi" };
  });
  const mult = mode === "optimis" ? 1.18 : mode === "pesimis" ? 0.82 : 1.0;
  const adj  = FCAST.map(f => ({ ...f, pendapatan: Math.round(f.pendapatan * mult), laba: Math.round(f.laba * mult) }));
  const chartData = [...data.slice(-4).map(d => ({ ...d, type: "aktual" })), ...adj];
  return (
    <div style={{ padding: 16 }}>
      <SecTitle icon="🔮">Proyeksi 3 Bulan</SecTitle>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[["base","📊 Base"],["optimis","🚀 +18%"],["pesimis","📉 −18%"]].map(([k, l]) => (
          <button key={k} onClick={() => setMode(k)} style={{ flex: 1, padding: "8px 4px", borderRadius: 8, fontSize: 10, fontWeight: 700, border: `1px solid ${mode === k ? P.cyan : P.border}`, background: mode === k ? `${P.cyan}18` : P.surface, color: mode === k ? P.cyan : P.muted, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>
        ))}
      </div>
      <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, padding: "16px 4px 8px", marginBottom: 20 }}>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
            <defs><linearGradient id="gFP" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={P.cyan} stopOpacity={0.3} /><stop offset="95%" stopColor={P.cyan} stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid stroke={P.border} strokeDasharray="3 3" />
            <XAxis dataKey="bulan" tick={{ fill: P.muted, fontSize: 9 }} />
            <YAxis tick={{ fill: P.muted, fontSize: 9 }} />
            <Tooltip content={<CTip />} />
            <Area type="monotone" dataKey="pendapatan" name="Pendapatan" stroke={P.cyan} fill="url(#gFP)" strokeWidth={2} dot={false} />
            <Bar dataKey="laba" name="Laba" radius={[3,3,0,0]}>{chartData.map((d: any, i: number) => <Cell key={i} fill={d.laba >= 0 ? P.green : P.red} fillOpacity={d.type === "proyeksi" ? 0.5 : 0.85} />)}</Bar>
            <Line type="monotone" dataKey="beban" name="Beban" stroke={P.red} strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", padding: "10px 14px", background: P.surfaceHigh, fontSize: 10, color: P.muted, fontWeight: 700, textTransform: "uppercase" }}>
          <div>Bulan</div><div>Pendapatan</div><div>Beban</div><div>Laba Est.</div>
        </div>
        {adj.map((f, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", padding: "11px 14px", borderTop: `1px solid ${P.border}`, fontSize: 12 }}>
            <div style={{ color: P.amber, fontWeight: 700 }}>{f.bulan}</div>
            <div style={{ fontFamily: "monospace", color: P.cyan }}>{f.pendapatan}Jt</div>
            <div style={{ fontFamily: "monospace", color: P.red }}>{f.beban}Jt</div>
            <div style={{ fontFamily: "monospace", color: f.laba >= 0 ? P.green : P.red, fontWeight: 700 }}>{f.laba}Jt</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Setting({ groqKey, setGroqKey, company, setCompany, user, onLogin, onLogout }: {
  groqKey: string; setGroqKey: (k: string) => void;
  company: string; setCompany: (c: string) => void;
  user: AppUser | null; onLogin: () => void; onLogout: () => void;
}) {
  const [keyDraft,  setKeyDraft]  = useState(groqKey);
  const [compDraft, setCompDraft] = useState(company);
  const [keySaved,  setKeySaved]  = useState(false);
  const [compSaved, setCompSaved] = useState(false);
  useEffect(() => { setKeyDraft(groqKey); }, [groqKey]);
  useEffect(() => { setCompDraft(company); }, [company]);
  const saveKey  = () => { setGroqKey(keyDraft.trim()); setKeySaved(true); setTimeout(() => setKeySaved(false), 2000); };
  const saveComp = () => { setCompany(compDraft.trim() || "Perusahaan Saya"); setCompSaved(true); setTimeout(() => setCompSaved(false), 2000); };
  const inputStyle: React.CSSProperties = { width: "100%", background: P.bg, border: `1px solid ${P.border}`, borderRadius: 8, padding: "10px 12px", color: P.text, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
  return (
    <div style={{ padding: 16 }}>
      <SecTitle icon="☁️">Cloud Sync (Appwrite)</SecTitle>
      <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
        {user ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${P.cyan}22`, border: `1px solid ${P.cyan}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>👤</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: P.text }}>{user.name}</div>
                <div style={{ fontSize: 11, color: P.muted }}>{user.email}</div>
              </div>
              <div style={{ marginLeft: "auto", background: `${P.green}20`, border: `1px solid ${P.green}44`, borderRadius: 20, padding: "3px 9px", fontSize: 10, color: P.green, fontWeight: 700 }}>● SYNCED</div>
            </div>
            <button onClick={onLogout} style={{ width: "100%", background: "none", border: `1px solid ${P.border}`, borderRadius: 8, padding: 10, fontSize: 12, color: P.muted, cursor: "pointer", fontFamily: "inherit" }}>Logout</button>
          </div>
        ) : (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 13, color: P.sub, marginBottom: 4 }}>Sync data ke cloud. Akses dari semua device.</div>
            <div style={{ fontSize: 11, color: P.muted, marginBottom: 14 }}>Membutuhkan konfigurasi Appwrite (lihat README).</div>
            <button onClick={onLogin} style={{ background: P.cyan, color: P.bg, border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>☁️ Login / Daftar</button>
          </div>
        )}
      </div>
      <SecTitle icon="🏢">Nama Perusahaan</SecTitle>
      <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <input value={compDraft} onChange={e => setCompDraft(e.target.value)} placeholder="PT. Nama Perusahaan" style={{ ...inputStyle, marginBottom: 10 }} />
        <button onClick={saveComp} style={{ width: "100%", background: compSaved ? P.green : P.cyan, color: P.bg, border: "none", borderRadius: 8, padding: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          {compSaved ? "✓ Tersimpan!" : "Simpan Nama"}
        </button>
      </div>
      <SecTitle icon="⚙️">Groq API Key</SecTitle>
      <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, padding: "18px 16px", marginBottom: 16 }}>
        <input type="password" value={keyDraft} onChange={e => setKeyDraft(e.target.value)} placeholder="gsk_xxxxxxxxxxxxxxxxxxxx" style={{ ...inputStyle, fontFamily: "monospace", marginBottom: 10 }} />
        <div style={{ fontSize: 11, color: P.muted, marginBottom: 14, lineHeight: 1.6 }}>Daftar gratis di <span style={{ color: P.cyan }}>console.groq.com</span> → Create API Key. Disimpan lokal di browser.</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={saveKey} style={{ flex: 1, background: keySaved ? P.green : P.cyan, color: P.bg, border: "none", borderRadius: 8, padding: 11, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {keySaved ? "✓ Tersimpan!" : "Simpan API Key"}
          </button>
          {groqKey && <button onClick={() => { setGroqKey(""); setKeyDraft(""); }} style={{ background: "none", border: `1px solid ${P.border}`, borderRadius: 8, padding: "11px 14px", fontSize: 12, color: P.muted, cursor: "pointer", fontFamily: "inherit" }}>Hapus</button>}
        </div>
      </div>
      <div style={{ background: P.surface, border: `1px solid ${P.border}`, borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 11, color: P.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Model AI Aktif</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: groqKey ? P.green : P.muted }} />
          <div>
            <div style={{ fontSize: 13, color: P.text, fontWeight: 700 }}>llama-3.3-70b-versatile</div>
            <div style={{ fontSize: 11, color: P.muted }}>Groq Cloud · Free tier · ~200 token/s</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  const [tab, setTab]             = useState("dashboard");
  const [aiText, setAiText]       = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [groqKey,   setGroqKeyState]  = useState("");
  const [rawData,   setRawDataState]  = useState<RawRow[]>([]);
  const [kas,       setKasState]      = useState(SEED_KAS);
  const [company,   setCompanyState]  = useState("Perusahaan Saya");
  const [hydrated,  setHydrated]      = useState(false);
  const [user,      setUser]          = useState<AppUser | null>(null);
  const [docId,     setDocId]         = useState<string | null>(null);
  const [syncing,   setSyncing]       = useState(false);
  const [showAuth,  setShowAuth]      = useState(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const run = async () => {
      try {
        const sd = localStorage.getItem(LS_DATA);
        const sk = localStorage.getItem(LS_KAS);
        const sg = localStorage.getItem(LS_KEY);
        const sc = localStorage.getItem(LS_COMPANY);
        const si = localStorage.getItem(LS_DOC_ID);
        if (sd) setRawDataState(JSON.parse(sd));
        if (sk) setKasState(Number(sk));
        if (sg) setGroqKeyState(sg);
        if (sc) setCompanyState(sc);
        if (si) setDocId(si);
        const { getCurrentUser, loadCloudData } = await import("./lib/appwrite");
        const u = await getCurrentUser();
        if (u) {
          setUser(u);
          const doc = await loadCloudData(u.$id);
          if (doc) {
            const cd = JSON.parse(doc.rawData) as RawRow[];
            setRawDataState(cd); setKasState(doc.kas); setDocId(doc.$id);
            try { localStorage.setItem(LS_DATA, JSON.stringify(cd)); localStorage.setItem(LS_KAS, String(doc.kas)); localStorage.setItem(LS_DOC_ID, doc.$id); } catch {}
          }
        }
      } catch {}
      setHydrated(true);
    };
    run();
  }, []);

  const setRawData = (next: RawRow[]) => { setRawDataState(next); try { localStorage.setItem(LS_DATA, JSON.stringify(next)); } catch {} };
  const setKas     = (v: number)      => { setKasState(v);        try { localStorage.setItem(LS_KAS,  String(v));             } catch {} };
  const setGroqKey = (k: string)      => { setGroqKeyState(k);    try { k ? localStorage.setItem(LS_KEY, k) : localStorage.removeItem(LS_KEY); } catch {} };
  const setCompany = (c: string)      => { setCompanyState(c);    try { localStorage.setItem(LS_COMPANY, c); } catch {} };

  useEffect(() => {
    if (!user || !hydrated) return;
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(async () => {
      setSyncing(true);
      try {
        const { saveCloudData } = await import("./lib/appwrite");
        const id = await saveCloudData(user.$id, rawData, kas, docId ?? undefined);
        if (!docId) { setDocId(id); try { localStorage.setItem(LS_DOC_ID, id); } catch {} }
      } catch {}
      setSyncing(false);
    }, 2000);
    return () => clearTimeout(syncTimer.current);
  }, [rawData, kas, user, hydrated]);

  const handleLogin = async (u: AppUser) => {
    setUser(u); setShowAuth(false); setSyncing(true);
    try {
      const { loadCloudData } = await import("./lib/appwrite");
      const doc = await loadCloudData(u.$id);
      if (doc) { const cd = JSON.parse(doc.rawData) as RawRow[]; setRawData(cd); setKas(doc.kas); setDocId(doc.$id); try { localStorage.setItem(LS_DOC_ID, doc.$id); } catch {} }
    } catch {}
    setSyncing(false);
  };

  const handleLogout = async () => {
    const { logoutUser } = await import("./lib/appwrite");
    await logoutUser(); setUser(null); setDocId(null);
    try { localStorage.removeItem(LS_DOC_ID); } catch {}
  };

  const data = computeRows(rawData);

  const callAI = useCallback(async () => {
    if (!data.length) return;
    setAiLoading(true); setAiText("");
    const LATEST = data[data.length - 1];
    const RUNWAY = LATEST.beban > 0 ? Math.floor(kas / LATEST.beban) : 999;
    const ANOM   = data.filter(d => d.anomali);
    try {
      const prompt = `Kamu adalah CFO AI untuk perusahaan menengah Indonesia. Berikan executive summary keuangan dalam Bahasa Indonesia yang tajam dan actionable.

DATA KEUANGAN ${data.length} BULAN:
${data.map(d => `${d.bulan}: Pendapatan Rp${d.pendapatan}Jt | Beban Rp${d.beban}Jt | Laba Rp${d.laba}Jt | GPM ${d.gpm}%`).join("\n")}

METRIK KRITIS:
- Burn Rate: Rp${LATEST.beban}Jt/bln | Runway: ${RUNWAY >= 999 ? ">36" : RUNWAY} bln | Kas: Rp${kas}Jt
- Anomali: ${ANOM.map(a => a.bulan).join(", ") || "Tidak ada"}
- GPM max: ${Math.max(...data.map(d => d.gpm))}% | GPM min: ${Math.min(...data.map(d => d.gpm))}%

Format (emoji, bahasa eksekutif):

🏦 KONDISI BISNIS
[2-3 kalimat kondisi finansial]

⚠️ RISIKO UTAMA
• [Risiko 1 — angka spesifik]
• [Risiko 2 — angka spesifik]
• [Risiko 3 — angka spesifik]

✅ REKOMENDASI AKSI
• [Aksi 1 — target angka]
• [Aksi 2 — target angka]
• [Aksi 3 — timeline]

📈 OUTLOOK 3 BULAN
[2 kalimat proyeksi]`;
      const res = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, clientKey: groqKey }) });
      const r   = await res.json();
      if (r.error) throw new Error(r.error);
      setAiText(r.text);
    } catch (e: unknown) { setAiText(`❌ Error: ${e instanceof Error ? e.message : "Koneksi ke Groq gagal."}`); }
    setAiLoading(false);
  }, [data, kas, groqKey]);

  const handleExport = async () => {
    setExporting(true);
    try { await generatePDF(data, kas, company); }
    catch (e: any) { alert("Export PDF gagal: " + e.message); }
    setExporting(false);
  };

  const tabs = [
    { id: "dashboard", icon: "📊", label: "Dashboard" },
    { id: "input",     icon: "📝", label: "Input" },
    { id: "analisis",  icon: "🤖", label: "AI" },
    { id: "proyeksi",  icon: "🔮", label: "Proyeksi" },
    { id: "setting",   icon: "⚙️", label: "Setting" },
  ];

  if (!hydrated) return <div style={{ background: P.bg, minHeight: "100dvh" }} />;

  return (
    <div style={{ background: P.bg, minHeight: "100dvh", color: P.text, paddingBottom: 72 }}>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onSuccess={handleLogin} />}
      <div style={{ background: P.surface, borderBottom: `1px solid ${P.border}`, padding: "14px 16px 12px", position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" as any }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 10, color: P.muted, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>Logika Financial AI</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: P.text, marginTop: 1 }}>{company}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {syncing && <div style={{ fontSize: 10, color: P.muted }}>⟳</div>}
            <div style={{ background: user ? `${P.green}20` : groqKey ? `${P.green}20` : `${P.amber}20`, border: `1px solid ${user ? P.green : groqKey ? P.green : P.amber}44`, borderRadius: 20, padding: "3px 9px", fontSize: 10, color: user ? P.green : groqKey ? P.green : P.amber, fontWeight: 700 }}>
              {user ? `● ${user.name.split(" ")[0].toUpperCase()}` : groqKey ? "● AI AKTIF" : "● SET API KEY"}
            </div>
          </div>
        </div>
      </div>

      {tab === "dashboard" && <Dashboard data={data} kas={kas} company={company} onExport={handleExport} exporting={exporting} />}
      {tab === "input"     && <InputData rawData={rawData} setRawData={setRawData} kas={kas} setKas={setKas} />}
      {tab === "analisis"  && <AnalisisAI data={data} kas={kas} aiText={aiText} aiLoading={aiLoading} callAI={callAI} hasKey={!!groqKey} />}
      {tab === "proyeksi"  && <Proyeksi data={data} />}
      {tab === "setting"   && <Setting groqKey={groqKey} setGroqKey={setGroqKey} company={company} setCompany={setCompany} user={user} onLogin={() => setShowAuth(true)} onLogout={handleLogout} />}

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: P.surface, borderTop: `1px solid ${P.border}`, display: "flex", zIndex: 9999, paddingBottom: "env(safe-area-inset-bottom)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" as any }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: "10px 0 8px", background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: tab === t.id ? P.cyan : P.muted, cursor: "pointer", fontFamily: "inherit", borderTop: tab === t.id ? `2px solid ${P.cyan}` : "2px solid transparent" }}>
            <span style={{ fontSize: 15 }}>{t.icon}</span>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
