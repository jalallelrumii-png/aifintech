// Seed data untuk demo / "Muat Data Contoh"
export const KAS = 1290;

const RAW = [
  { b: "Jul'24", p: 285, e: 198 }, { b: "Agu'24", p: 312, e: 215 },
  { b: "Sep'24", p: 298, e: 225 }, { b: "Okt'24", p: 340, e: 210 },
  { b: "Nov'24", p: 378, e: 235 }, { b: "Des'24", p: 425, e: 280 },
  { b: "Jan'25", p: 310, e: 295 }, { b: "Feb'25", p: 295, e: 305 },
  { b: "Mar'25", p: 335, e: 285 },
];

export const DATA = RAW.map(d => ({
  bulan: d.b, pendapatan: d.p, beban: d.e,
}));

/** Hitung persentase perubahan — aman terhadap divisi 0 */
export const pct = (a: number, b: number): string => {
  if (!b) return "0.0";
  return (((a - b) / b) * 100).toFixed(1);
};
