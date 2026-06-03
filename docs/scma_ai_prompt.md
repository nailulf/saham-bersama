# SCMA AI Analysis — Full Prompt Export

*Context built_at: 2026-05-05T05:52:29.53691+00:00 | data_as_of: 2026-06-02*

---

## SYSTEM PROMPT

```
Kamu adalah analis ekuitas senior untuk saham Indonesia (IDX/BEI). Kamu menggabungkan
framework value investing Warren Buffett dan klasifikasi saham Peter Lynch.

BAHASA: Semua output teks (narrative, scenario, drivers, caveats, dll) HARUS dalam Bahasa Indonesia.
JSON keys tetap dalam bahasa Inggris. Enum values (lynch_category, analyst_verdict, dll) tetap dalam bahasa Inggris.

FRAMEWORK BUFFETT — nilai untuk setiap saham:
- Economic moat (none|narrow|wide): apa yang melindungi keuntungan? Apakah tahan lama?
- Owner earnings: lihat melampaui laba akuntansi — berapa kas riil yang bisa diambil pemilik?
- Margin of safety: seberapa besar kamu bisa salah dan tetap tidak rugi?

KATEGORI PETER LYNCH — klasifikasikan setiap saham ke tepat SATU kategori:
- slow_grower: Perusahaan besar matang, pertumbuhan 2-4%, beli untuk dividen
- stalwart: Perusahaan besar berkualitas, pertumbuhan 10-12%, kenaikan moderat, tahan resesi
- fast_grower: Perusahaan kecil/menengah agresif, pertumbuhan 20%+, potensi tertinggi tapi berisiko
- cyclical: Pendapatan/laba mengikuti siklus ekonomi atau komoditas. Timing > valuasi.
- turnaround: Dalam krisis atau pemulihan. Hasil binary — untung besar atau rugi total.
- asset_play: Aset berharga yang belum tercermin di harga saham

ATURAN PENTING:
- JANGAN merangkum data. User sudah melihat semua angka di dashboard mereka.
- Tugasmu memberikan INSIGHT yang tidak bisa ditunjukkan oleh angka saja.
- Jelaskan CERITA BISNIS: apa yang sebenarnya terjadi dan mengapa.
- Setiap skenario harus menjelaskan: apa yang terjadi, apa yang mendorong,
  apa yang terjadi pada harga saham, dan tanda-tanda awal bahwa skenario ini sedang terjadi.
- Kasus netral adalah JALUR PALING MUNGKIN, bukan rata-rata antara bull/bear.
- Jika domain_notes kosong, gunakan data + makro + template sektor.
  Tandai kesimpulan yang membutuhkan konteks perusahaan yang lebih dalam.
- data_gap_flags harus diakui. Katakan apa yang tidak kamu ketahui dan bagaimana
  hal itu akan mengubah pandanganmu.
- Kualitas data BUKAN penghalang analisis. Data yang volatile, anomali, atau terbatas
  adalah SINYAL BISNIS yang harus kamu interpretasikan (turnaround, transformasi,
  akuisisi, restrukturisasi). Jelaskan mengapa data terlihat seperti ini.
- Jika data terlalu terbatas, tetap analisis dengan confidence_level rendah dan caveats jelas.

ATURAN SKENARIO & HARGA TARGET (WAJIB):
- Setiap skenario (bull/bear/neutral) HARUS dikuantifikasi dengan asumsi keuangan spesifik.
- Gunakan data aktual dari bundle sebagai titik awal, lalu proyeksikan perubahan.

PENTING — VALUASI DARI BUNDLE ADALAH REFERENSI, BUKAN SATU-SATUNYA ANCHOR:
- Bundle berisi dcf_bear/dcf_base/dcf_bull dan graham_number sebagai titik referensi awal.
- DCF adalah estimasi berbasis pertumbuhan historis — bukan batas atas/bawah yang kaku.
  Gunakan DCF sebagai CROSS-CHECK, bukan satu-satunya penentu harga target.
- Pilih METODE VALUASI yang tepat sesuai tipe saham (lihat bagian di bawah).
  Jika metode yang tepat menghasilkan target berbeda dari DCF, METODE YANG TEPAT MENANG.
  Jelaskan secara eksplisit mengapa kamu menyimpang dari DCF.
- Jika kamu yakin DCF terlalu rendah (misalnya karena PE compressed untuk stalwart berkualitas),
  GUNAKAN metode valuasi yang lebih relevan (PE fair value, yield normalization, dll.)
  dan cantumkan DCF sebagai cross-check di valuation_basis.
- Jangan membuat angka sendiri tanpa referensi ke asumsi keuangan eksplisit.
- Jika dcf_bull = 4,807, maka DCF memberikan sinyal floor — bull target BOLEH jauh di atasnya
  jika metode valuasi yang tepat (PE expansion, yield normalization) mendukung target lebih tinggi.

METODE VALUASI — PILIH SESUAI TIPE SAHAM (INI YANG MENENTUKAN HARGA TARGET):
- stalwart / slow_grower: PE × EPS adalah metode UTAMA.
  Gunakan PE WAJAR (fair PE), BUKAN PE saat ini yang mungkin tertekan.
  PE wajar IDX: 15-20x (bisnis biasa), 20-28x (kualitas tinggi), 28-35x (exceptional).
  Jika PE saat ini sangat rendah vs kualitas bisnis → skenario bull = ekspansi PE.
  Bear = PE kontraksi ke 8-12x × trough EPS.
- cyclical: JANGAN pakai PE (PE rendah = jebakan di puncak siklus). Gunakan EV/EBITDA trough,
  PBV di titik rendah siklus, atau DCF yang sudah dihitung di bundle.
- turnaround: Jika masih rugi, PE tidak relevan. Gunakan PBV × BVPS, Price/Sales (PS ratio),
  atau replacement cost/NAV. Untuk saham properti: gunakan NAV (nilai aset bersih) — tanah dan
  inventori properti sering bernilai lebih tinggi dari book value akuntansi.
- fast_grower: PS ratio (Price/Sales) atau PEG ratio. PE bisa sangat tinggi dan tetap wajar
  jika pertumbuhan cukup cepat.
- asset_play: NAV (Net Asset Value) — hitung nilai aset (tanah, kas, anak usaha) dan bandingkan
  dengan market cap.
- Perbankan: PBV × BVPS adalah metode utama (BUKAN PE). Bank premium 3-5x PBV,
  bank menengah 1-2x PBV, bank BUMN 1-1.5x PBV.

Untuk setiap skenario, nyatakan:
- Asumsi pertumbuhan revenue (% dan nominal)
- Asumsi margin (perbaikan/penurunan/stabil dan angka spesifik)
- Basis valuasi: metode apa yang dipakai SESUAI tipe saham di atas (BUKAN selalu PE)
- Perhitungan singkat yang spesifik dan masuk akal

- Price target HARUS masuk akal relatif terhadap harga saat ini dan asumsi keuangan yang kamu nyatakan.
- URUTAN WAJIB: bull price_target > neutral price_range_high > neutral price_range_low > bear price_target.
  Bahkan jika semua target di bawah harga saat ini (saham overvalued), urutan HARUS tetap bull > bear.
- REALISME IDX: Saham di IDX jarang naik >3-5x dalam 12 bulan kecuali IPO baru atau turnaround ekstrem.
  Jika bull target >5x harga saat ini, WAJIB jelaskan timeframe yang realistis (2-3 tahun) dan
  tandai sebagai "skenario optimis dengan volatilitas tinggi" dalam caveats.
  Tidak ada batasan angka — tapi harus masuk akal dan dijelaskan.

ATURAN KHUSUS PER KATEGORI LYNCH:
- turnaround: business_narrative WAJIB menjelaskan (1) apa yang rusak/krisis — mengapa perusahaan
  merugi atau margin tipis, (2) apa yang sedang berubah — katalis pemulihan spesifik (restrukturisasi,
  manajemen baru, proyek baru, deleveraging), (3) apa yang harus terjadi agar turnaround berhasil —
  milestone konkret (break-even, margin target, peluncuran proyek). Jika data tidak cukup untuk
  menjawab ini, katakan secara eksplisit "data tidak menunjukkan katalis turnaround yang jelas."
- cyclical: Jelaskan posisi di siklus (puncak/turun/dasar/naik). Revenue/earnings volatil bukan
  masalah — itu nature bisnisnya. Fokus pada: kapan siklus berbalik, apa pemicunya.
- fast_grower: Jelaskan apakah pertumbuhan sustainable atau satu kali. Seberapa besar addressable
  market yang tersisa. Risiko scaling.
- asset_play: Jelaskan aset apa yang undervalued dan berapa estimasi nilainya vs market cap.
- stalwart: Jelaskan apa yang menjaga competitive position dan apakah ada tanda erosi.
- slow_grower: Jelaskan apakah dividen sustainable dan risiko pemotongan dividen.

Spesifik IDX:
- Perbankan: bobot NIM, CASA, NPL. Abaikan current_ratio/interest_coverage.
- BUMN: terapkan diskon PE struktural 15-20% (risiko tata kelola + pinjaman politik).
- COVID 2020: anomali struktural, bukan spesifik perusahaan. Jangan kutip sebagai pola.
- PE rendah pada saham cyclical sering kali jebakan (aturan Lynch). Yield tinggi dari BUMN
  mungkin berarti pemerintah mengekstrak kas, bukan kebijakan ramah pemegang saham.
- Properti: gunakan NAV dan nilai land bank. Margin rendah bisa berarti belum ada monetisasi
  aset, bukan bisnis yang buruk.

Output HANYA JSON valid sesuai skema yang diberikan. Tanpa markdown, tanpa pembukaan.
```

---

## USER PROMPT

```
MACRO CONTEXT (2026-05):
  BI rate: 5.5% (easing)
  IDR: 16400/USD (stable_weak)
  IDX YTD: -4.1%
  Foreign flow: net_outflow
  Note: Cumulative $2.8B net foreign outflow YTD 2026. Broad EM de-risking continues but pace slowing vs Q1. Domestic retail buying partially absorbing outflows.

DOMAIN CONTEXT: None available. Base analysis on data + macro + sector template only.
Flag conclusions that would benefit from deeper company-specific knowledge.

ANCHOR VALUASI (SUDAH DIHITUNG — gunakan sebagai referensi harga target):
  Harga saat ini: Rp230
  Graham Number: Rp161
  DCF Mode: berbasis Free Cash Flow
  DCF Growth Assumed: 2.0% p.a.
  DCF Bear:  Rp51
  DCF Base:  Rp58
  DCF Bull:  Rp67
  PE: 18.07  |  PB: 2.44
  EPS: Rp12.50
  BVPS: Rp92.52
  PS Ratio: 2.12x

ATURAN ANCHOR:
- Untuk stalwart/slow_grower: gunakan PE sebagai acuan utama
  PENTING: gunakan PE WAJAR (fair PE), BUKAN PE saat ini yang mungkin tertekan.
  PE wajar untuk stalwart di IDX: 15-20x (bisnis biasa), 20-28x (bisnis berkualitas tinggi),
  28-35x (bisnis exceptional dengan ROE >25%, margin defensif >15%, pertumbuhan konsisten).
  Skenario bull = PE ekspansi ke fair value × forward EPS.
  Skenario bear = PE kontraksi ke 8-12x × trough EPS.
- Untuk cyclical: gunakan EV/EBITDA atau PBV di titik siklus, BUKAN PE
- Untuk turnaround/properti: gunakan PBV × BVPS atau NAV (nilai aset)
- Untuk fast_grower/rugi: gunakan PS ratio atau revenue multiple
- Untuk bank: gunakan PBV × BVPS (bank premium 3-5x, menengah 1-2x)
- DCF di bundle bisa digunakan sebagai cross-check, bukan satu-satunya acuan
- Jika kamu menyimpang dari anchor, JELASKAN alasannya secara eksplisit.

MARGIN OF SAFETY — WAJIB DIBACA SEBELUM MENENTUKAN VERDICT:
  Harga vs DCF Bear:  -77.8%  (harga DI ATAS bear case → downside terbuka)
  Harga vs DCF Base:  -74.8%
  Harga vs DCF Bull:  -70.9%

  PENTING — KETERBATASAN DCF:
  DCF adalah estimasi berbasis asumsi pertumbuhan standar, bukan valuasi absolut.
  Bisnis berkualitas tinggi (ROE konsisten >18%, margin tinggi dan defensif, moat nyata)
  sering wajar diperdagangkan di atas DCF karena kualitas dan optionality jangka panjang
  tidak sepenuhnya tercermin dalam model standar. Premium vs DCF BUKAN otomatis 'overvalued'.

PANDUAN VERDICT (bukan mandat absolut — pertimbangkan konteks bisnis secara menyeluruh):
  * Arus asing negatif / smart money distribusi adalah sinyal TIMING, bukan dasar mengubah verdict fundamental *
  * Jika verdict berbeda dari panduan di atas, JELASKAN kualitas bisnis atau risiko fundamental spesifik yang menjadi alasannya *

KUALITAS DATA — ANALISIS INI SEBAGAI SINYAL, BUKAN HAMBATAN:
  Reliability: A (93.23/100)
  Confidence: MEDIUM (54.28/100)
  Data years: 10
  Tahun anomali: [2020, 2023, 2024]
  Data gaps: ['no_sector_comparison: peer data not available for any metric']

ATURAN KUALITAS DATA:
- Data yang volatile atau anomali BUKAN alasan untuk menolak analisis.
- Sebaliknya, INTERPRETASIKAN pola data sebagai sinyal bisnis:
  * Banyak anomali + tren membaik → kemungkinan turnaround/transformasi bisnis
  * Revenue/margin volatile → cyclical atau sedang restrukturisasi
  * Data terbatas (<5 tahun) → IPO baru atau transformasi besar (akuisisi, merger)
  * Perubahan skala mendadak → akuisisi, divestasi, atau perubahan model bisnis
- Jelaskan MENGAPA data terlihat seperti ini dan apa implikasinya untuk masa depan.
- Jika data terlalu sedikit untuk kesimpulan kuat, tetap berikan analisis terbaik
  dengan confidence_level rendah (1-4) dan caveats yang jelas.
- Contoh narasi: 'Tren 5 tahun sangat volatile, namun 2 tahun terakhir menunjukkan
  perbaikan konsisten — ini mengindikasikan transformasi bisnis sedang berjalan.'

SINYAL TEKNIKAL (Block 9 — GUNAKAN untuk timing dan konfirmasi tesis):
  Harga vs MA (per 2026-06-02):
    Close=230.0  |  SMA20=239.0  SMA50=259.0  SMA200=309.0
    vs SMA20: -3.8%  |  vs SMA50: -11.2%  |  vs SMA200: -25.6%
    Posisi: below_all_mas
  Momentum (per 2026-05-29):
    RSI-14=35.57 (neutral)
    MACD histogram=1.634 (bullish)  |  golden_cross 3 hari lalu
    Volume vs SMA20: +73.2%
  Fase Pasar (SMA-based): sideways_bearish | strength=weak | -13.7% in 22 hari (sejak 2026-04-29)
    Range: 214–268 | smart_money_alignment=75 | broker_flow=confirms
  Wyckoff (v1.0): fase saat ini = markdown
    Event terbaru: passive_markdown (2026-04-07) conf=71 — Passive markdown: -16% over 30 bars on avg vol z=-0.34
    Riwayat: passive_markdown → basis_building → passive_markup → ST_low → LPSY

ATURAN SINYAL TEKNIKAL:
- Wyckoff fase 'accumulation' + harga di bawah semua MA + RSI oversold = konfirmasi entry timing untuk buy
- Wyckoff fase 'distribution' + harga di atas semua MA + RSI overbought = konfirmasi entry timing untuk sell/avoid
- MACD golden cross setelah periode bearish = sinyal pembalikan awal, tidak cukup sendiri tapi memperkuat bull case
- Jika teknikal kontradiksi dengan fundamental: SEBUTKAN konflik dan jelaskan tesis mana yang lebih dominan
- Jika data teknikal tidak tersedia: jangan buat asumsi timing — cukup tulis 'sinyal teknikal tidak tersedia'

TREN KUARTALAN (Block 10 — GUNAKAN untuk menilai momentum jangka pendek):
  Period   Rev (B)    NI (B)     Margin%    EPS     
  ----------------------------------------------
  2026Q1   1864.0     308.1      16.5       4       
  2025Q4   1841.6     204.2      11.1       2       
  2025Q3   1723.2     267.9      15.5       4       
  2025Q2   1585.4     153.4      9.7        2       
  2025Q1   1737.9     103.9      6.0        2       
  2024Q4   1914.3     47.7       2.5        1       

  TTM (trailing 12M): Rev=7014.0B | NI=933.0B | Margin=13.3% | EPS=13.0

  Momentum QoQ: Rev=+1.2%  NI=+50.9%
  Momentum YoY: Rev=+7.3%  NI=+196.5%
  Tren margin 3Q: stable_3q  (margin terkini=16.5%)

ATURAN TREN KUARTALAN:
- QoQ revenue positif + margin improving_3q = momentum fundamental menguat → perkuat bull case
- QoQ revenue negatif + margin declining_3q = tekanan fundamental meningkat → perkuat bear case
- TTM margin vs annual margin: jika TTM > annual → pemulihan sedang berjalan
- Jika data kuartalan tidak tersedia: catatan sebagai data_gap dalam data_gaps_acknowledged

PROFIL DIVIDEN (Block 11 — KRITIS untuk saham yield tinggi):
  TTM DPS:       Rp27.00/saham
  TTM Yield:     11.74%
  Payout Ratio:  216.0%
  Sustainability:unsustainable  |  Tren: growing
  Riwayat DPS:
    2025: Rp27.00
    2024: Rp10.00
    2023: Rp6.50
    2022: Rp2.50
    2019: Rp11.20

ATURAN PROFIL DIVIDEN:
- TTM yield ≥8% pada harga saat ini = high-yield stock → DCF mode 'dividend' HARUS digunakan sebagai anchor utama
- Payout ratio >100% = dividen tidak sustainable dari laba — lihat FCF untuk konfirmasi kemampuan bayar
- Jika yield ≥9% dan sustainability 'moderate'/'healthy': ini adalah sinyal value utama, harus masuk business_narrative
- Dividen konsisten selama 3+ tahun meski revenue volatile = tanda komitmen manajemen terhadap pemegang saham
- Jangan abaikan yield hanya karena revenue berfluktuasi — properti/kawasan industri memang cyclical secara revenue

STOCK DATA BUNDLE:
{
  "name": "Surya Citra Media Tbk",
  "sector": "Barang Konsumen Non-Primer",
  "ticker": "SCMA",
  "is_lq45": false,
  "is_idx30": false,
  "valuation": {
    "peg_3yr": null,
    "peg_5yr": null,
    "dcf_base": 58,
    "dcf_bear": 51,
    "dcf_bull": 67,
    "dcf_mode": "fcf",
    "pb_ratio": 2.44,
    "pe_ratio": 18.07,
    "market_cap": 14606081754400,
    "price_date": "2026-06-02",
    "dcf_base_mos": -2.9655,
    "current_price": 230.0,
    "graham_number": 161,
    "dcf_growth_pct": 2.0,
    "eps_cagr_3yr_pct": -3.1,
    "eps_cagr_5yr_pct": -33.1,
    "graham_margin_of_safety": -0.4258
  },
  "data_as_of": "2026-06-02",
  "sub_sector": "Media & Hiburan",
  "smart_money": {
    "phase": "distribusi",
    "window_days": 30,
    "asing_net_30d": -8727242200,
    "lokal_net_30d": 5712855000,
    "bandar_accdist": "Dist",
    "insider_buy_count": 0,
    "bandar_latest_date": "2026-06-02",
    "insider_sell_count": 0,
    "pemerintah_net_30d": 2989543800,
    "bandar_top5_accdist": "Neutral",
    "insider_window_days": 90,
    "insider_net_direction": "neutral"
  },
  "data_quality": {
    "ready_for_ai": true,
    "data_gap_flags": [
      "no_sector_comparison: peer data not available for any metric"
    ],
    "flagged_issues": [
      "covid_year_2020",
      "possible_stock_split_2021: EPS -77% while NI +16%",
      "one_time_2023: NI/OI ratio = 0.46x",
      "anomaly_2023_free_cash_flow: z=2.8",
      "anomaly_2024_net_income: z=3.8",
      "ttm_estimate_2026: TTM estimate, not published annual report"
    ],
    "primary_source": "stockbit",
    "anomalous_years": [
      2020,
      2023,
      2024
    ],
    "composite_score": 73.75,
    "missing_metrics": [],
    "confidence_grade": "MEDIUM",
    "confidence_score": 54.28,
    "reliability_grade": "A",
    "reliability_score": 93.23,
    "data_years_available": 10,
    "banking_exemptions_applied": false
  },
  "fundamentals": {
    "metrics": {
      "dps": {
        "unit": "idr",
        "trend": "insufficient_data",
        "value": 26.984129465882923,
        "cagr_3yr": null,
        "trend_r2": null,
        "cagr_full": null,
        "peer_count": 0,
        "peer_group": null,
        "anomaly_years": [],
        "value_display": "0.0 Rp Billion",
        "vs_sector_pct": null
      },
      "eps": {
        "unit": "idr",
        "trend": "strong_down",
        "value": 12.5,
        "cagr_3yr": -0.03065,
        "trend_r2": 0.8594,
        "cagr_full": -0.224446,
        "peer_count": 0,
        "peer_group": null,
        "anomaly_years": [
          2020,
          2023,
          2024
        ],
        "value_display": "0.0 Rp Billion",
        "vs_sector_pct": null
      },
      "roa": {
        "unit": "percent",
        "trend": "strong_down",
        "value": 7.89,
        "cagr_3yr": 0.007287,
        "trend_r2": 0.9576,
        "cagr_full": -0.141479,
        "peer_count": 0,
        "peer_group": null,
        "anomaly_years": [
          2020,
          2023,
          2024
        ],
        "vs_sector_pct": null
      },
      "roe": {
        "unit": "percent",
        "trend": "strong_down",
        "value": 11.8,
        "cagr_3yr": 0.016942,
        "trend_r2": 0.9503,
        "cagr_full": -0.135606,
        "peer_count": 0,
        "peer_group": null,
        "anomaly_years": [
          2020,
          2023,
          2024
        ],
        "vs_sector_pct": null
      },
      "bvps": {
        "unit": "idr",
        "trend": "strong_down",
        "value": 92.52,
        "cagr_3yr": -0.046698,
        "trend_r2": 0.4989,
        "cagr_full": -0.102722,
        "peer_count": 0,
        "peer_group": null,
        "anomaly_years": [
          2020,
          2023,
          2024
        ],
        "value_display": "0.0 Rp Billion",
        "vs_sector_pct": null
      },
      "cash": {
        "unit": "idr",
        "trend": "strong_up",
        "value": 1225313430000.0,
        "cagr_3yr": -0.192894,
        "trend_r2": 0.3812,
        "cagr_full": 0.116432,
        "peer_count": 0,
        "peer_group": null,
        "anomaly_years": [
          2020,
          2023,
          2024
        ],
        "value_display": "1225.3 Rp Billion",
        "vs_sector_pct": null
      },
      "revenue": {
        "unit": "idr",
        "trend": "strong_up",
        "value": 6887998483000.0,
        "cagr_3yr": -0.011561,
        "trend_r2": 0.9206,
        "cagr_full": 0.047814,
        "peer_count": 0,
        "peer_group": null,
        "anomaly_years": [
          2020,
          2023,
          2024
        ],
        "value_display": "6888.0 Rp Billion",
        "vs_sector_pct": null
      },
      "pb_ratio": {
        "unit": "multiple",
        "trend": "strong_down",
        "value": 2.44,
        "cagr_3yr": 0.237701,
        "trend_r2": 0.8078,
        "cagr_full": -0.118764,
        "peer_count": 0,
        "peer_group": null,
        "anomaly_years": [
          2020,
          2023,
          2024
        ],
        "vs_sector_pct": null
      },
      "pe_ratio": {
        "unit": "multiple",
        "trend": "volatile",
        "value": 18.07,
        "cagr_3yr": 0.216716,
        "trend_r2": 0.0021,
        "cagr_full": 0.019435,
        "peer_count": 0,
        "peer_group": null,
        "anomaly_years": [
          2020,
          2023,
          2024
        ],
        "vs_sector_pct": null
      },
      "net_income": {
        "unit": "idr",
        "trend": "strong_down",
        "value": 729307531000.0,
        "cagr_3yr": 0.023671,
        "trend_r2": 0.7136,
        "cagr_full": -0.077758,
        "peer_count": 0,
        "peer_group": null,
        "anomaly_years": [
          2020,
          2023,
          2024
        ],
        "value_display": "729.3 Rp Billion",
        "vs_sector_pct": null
      },
      "net_margin": {
        "unit": "percent",
        "trend": "strong_down",
        "value": 10.5881,
        "cagr_3yr": 0.035646,
        "trend_r2": 0.8845,
        "cagr_full": -0.119841,
        "peer_count": 0,
        "peer_group": null,
        "anomaly_years": [
          2020,
          2023,
          2024
        ],
        "vs_sector_pct": null
      },
      "gross_margin": {
        "unit": "percent",
        "trend": "strong_down",
        "value": 38.0526,
        "cagr_3yr": 0.001466,
        "trend_r2": 0.8894,
        "cagr_full": -0.050391,
        "peer_count": 0,
        "peer_group": null,
        "anomaly_years": [
          2020,
          2023,
          2024
        ],
        "vs_sector_pct": null
      },
      "total_equity": {
        "unit": "idr",
        "trend": "strong_up",
        "value": 7598648079000.0,
        "cagr_3yr": -0.044455,
        "trend_r2": 0.8774,
        "cagr_full": 0.083068,
        "peer_count": 0,
        "peer_group": null,
        "anomaly_years": [
          2020,
          2023,
          2024
        ],
        "value_display": "7598.6 Rp Billion",
        "vs_sector_pct": null
      },
      "current_ratio": {
        "unit": "ratio",
        "trend": "volatile",
        "value": 3.14,
        "cagr_3yr": -0.049797,
        "trend_r2": 0.001,
        "cagr_full": 0.005828,
        "peer_count": 0,
        "peer_group": null,
        "anomaly_years": [
          2020,
          2023,
          2024
        ],
        "vs_sector_pct": null
      },
      "debt_to_equity": {
        "unit": "ratio",
        "trend": "volatile",
        "value": 0.0,
        "cagr_3yr": null,
        "trend_r2": 0.1417,
        "cagr_full": null,
        "peer_count": 0,
        "peer_group": null,
        "anomaly_years": [
          2020,
          2023,
          2024
        ],
        "vs_sector_pct": null
      },
      "dividend_yield": {
        "unit": "percent",
        "trend": "insufficient_data",
        "value": 9.29,
        "cagr_3yr": null,
        "trend_r2": null,
        "cagr_full": null,
        "peer_count": 0,
        "peer_group": null,
        "anomaly_years": [],
        "vs_sector_pct": null
      },
      "free_cash_flow": {
        "unit": "idr",
        "trend": "strong_down",
        "value": 380286059000.0,
        "cagr_3yr": null,
        "trend_r2": 0.4576,
        "cagr_full": -0.122669,
        "peer_count": 0,
        "peer_group": null,
        "anomaly_years": [
          2020,
          2023,
          2024
        ],
        "value_display": "380.3 Rp Billion",
        "vs_sector_pct": null
      },
      "operating_income": {
        "unit": "idr",
        "trend": "strong_down",
        "value": 893870873000.0,
        "cagr_3yr": -0.067348,
        "trend_r2": 0.7479,
        "cagr_full": -0.085765,
        "peer_count": 0,
        "peer_group": null,
        "anomaly_years": [
          2020,
          2023,
          2024
        ],
        "value_display": "893.9 Rp Billion",
        "vs_sector_pct": null
      },
      "fcf_to_net_income": {
        "unit": "ratio",
        "trend": "volatile",
        "value": 0.5214344331239328,
        "cagr_3yr": null,
        "trend_r2": 0.2696,
        "cagr_full": -0.048698,
        "peer_count": 0,
        "peer_group": null,
        "anomaly_years": [
          2020,
          2023,
          2024
        ],
        "vs_sector_pct": null
      },
      "interest_coverage": {
        "unit": "ratio",
        "trend": "volatile",
        "value": 73.05,
        "cagr_3yr": 0.381759,
        "trend_r2": 0.0489,
        "cagr_full": 0.004432,
        "peer_count": 0,
        "peer_group": null,
        "anomaly_years": [
          2020,
          2023,
          2024
        ],
        "vs_sector_pct": null
      },
      "operating_cash_flow": {
        "unit": "idr",
        "trend": "strong_down",
        "value": 571294743000.0,
        "cagr_3yr": null,
        "trend_r2": 0.4401,
        "cagr_full": -0.093689,
        "peer_count": 0,
        "peer_group": null,
        "anomaly_years": [
          2020,
          2023,
          2024
        ],
        "value_display": "571.3 Rp Billion",
        "vs_sector_pct": null
      }
    },
    "key_signals": {
      "deleveraging": false,
      "dividend_growth": false,
      "margin_compression": true,
      "fcf_quality_concern": true,
      "revenue_growth_acceleration": false
    },
    "latest_year": 2025
  },
  "generated_at": "2026-06-02T12:06:28.386131+00:00",
  "health_score": {
    "grade": "Sehat",
    "total": 86,
    "components": {
      "roa": {
        "max": 15,
        "flag": "yellow",
        "score": 10,
        "value": 7.89
      },
      "roe": {
        "max": 15,
        "flag": "yellow",
        "score": 10,
        "value": 11.8
      },
      "net_margin": {
        "max": 15,
        "flag": "green",
        "score": 15,
        "value": 10.59
      },
      "gross_margin": {
        "max": 15,
        "flag": "green",
        "score": 15,
        "value": 38.05
      },
      "current_ratio": {
        "max": 15,
        "flag": "green",
        "score": 15,
        "value": 3.14
      },
      "debt_to_equity": {
        "max": 15,
        "flag": "green",
        "score": 15,
        "value": 0.0
      },
      "free_cash_flow": {
        "max": 20,
        "flag": "green",
        "score": 15,
        "value": 380286059000
      }
    }
  },
  "shareholders": {
    "top_holders": [
      {
        "pct": 74.42,
        "name": "PT ELANG MAHKOTA TEKNOLOGI TBK",
        "type": "CP"
      },
      {
        "pct": 74.42,
        "name": "PT ELANG MAHKOTA TEKNOLOGI TBK",
        "type": null
      },
      {
        "pct": 14.15,
        "name": "SURYA CITRA MEDIA TBK PT",
        "type": "CP"
      },
      {
        "pct": 14.15,
        "name": "PT. SURYA CITRA MEDIA TBK",
        "type": null
      }
    ],
    "public_float_pct": null
  },
  "macro_context": {
    "as_of": "2026-05",
    "bi_rate": 5.5,
    "usd_idr": 16400,
    "dxy_note": "DXY around 104-106. Strong dollar is the primary headwind for IDR and EM capital flows. Any DXY reversal would be a significant catalyst for IDX re-rating.",
    "fed_note": "Fed held at 4.50% through May 2026. Market pricing 1-2 cuts in H2 2026. Any Fed cut is a strong tailwind for EM equities and IDR stability.",
    "fed_rate": 4.5,
    "idr_note": "IDR stabilized around 16,300-16,500 range in May 2026 after Q1 weakness. BI intervention and improving trade balance limiting further depreciation.",
    "vix_note": "VIX around 20-24 range, elevated vs 2024 lows. Not crisis-level but reflects persistent uncertainty. Elevated VIX typically pressures EM valuations and foreign flows.",
    "dxy_level": 105,
    "dxy_trend": "strong_dollar",
    "idr_trend": "stable_weak",
    "vix_level": 22,
    "fed_stance": "hold_with_cut_bias",
    "key_events": [
      "Fed meeting June 18 \u2014 hold expected, but statement tone critical for EM sentiment",
      "BI rate decision June 2026 \u2014 possible 25bps cut if IDR holds 16,300-16,400",
      "Indonesia Q1 2026 GDP release \u2014 consensus 5.1% YoY growth",
      "US-China trade relations \u2014 key risk for FDI flows into Indonesian manufacturing hubs",
      "Global industrial relocation (China+1) continues \u2014 direct catalyst for kawasan industri"
    ],
    "vix_regime": "elevated",
    "bi_rate_note": "BI cut 25bps to 5.50% in May 2026. Further cuts expected in H2 2026 if IDR stabilizes. Lower rates support property and dividend stocks.",
    "em_sentiment": "cautious",
    "fed_next_move": "cut_Q3_2026",
    "global_sentiment": "risk_off_moderate",
    "bi_rate_direction": "easing",
    "commodity_context": {
      "cpo_note": "Palm oil prices stable around MYR 3,800-4,200/tonne. Supports Indonesian agribusiness and biodiesel mandates.",
      "coal_note": "Thermal coal prices declining from 2023 highs as energy transition accelerates. IDX coal stocks under structural pressure.",
      "cpo_trend": "stable",
      "gold_note": "Gold near all-time highs, supporting gold/mineral stocks. Safe-haven demand elevated.",
      "coal_trend": "softening",
      "gold_trend": "bullish",
      "nickel_note": "Nickel prices under pressure from Indonesian HPAL supply surge. Downstream EV battery thesis still intact long-term.",
      "nickel_trend": "oversupply"
    },
    "foreign_flow_note": "Cumulative $2.8B net foreign outflow YTD 2026. Broad EM de-risking continues but pace slowing vs Q1. Domestic retail buying partially absorbing outflows.",
    "idx_composite_ytd": -4.1,
    "em_fund_flows_note": "EM equity funds seeing modest outflows YTD. Indonesia among the more resilient EM markets due to commodity exports and domestic demand, but not immune to global risk-off.",
    "indonesia_specific": {
      "fdi_note": "FDI realization Q1 2026 up 12% YoY. China+1 strategy benefiting Indonesian industrial estates (kawasan industri). DMAS, KIJA, BEST direct beneficiaries.",
      "fdi_trend": "improving",
      "inflation": 2.8,
      "election_note": "Prabowo administration (2024-2029) in governing phase. Infrastructure and FDI promotion policies supportive of industrial estate developers.",
      "election_cycle": "post_election_stability",
      "inflation_note": "CPI 2.8% YoY in April 2026, within BI target band of 1.5-3.5%. Low inflation supports real purchasing power and BI rate cuts."
    },
    "foreign_flow_regime": "net_outflow",
    "idx_composite_level": 6720,
    "foreign_flow_ytd_usd": -2800000000,
    "global_sentiment_note": "Global risk sentiment cautious but not panicking. EM asset class facing headwinds from strong DXY and elevated US yields. Indonesia specific: domestic consumption holding up."
  },
  "sector_context": {
    "sector": "Barang Konsumen Non-Primer",
    "top_peers": [],
    "sub_sector": "Media & Hiburan",
    "peers_count": 0
  },
  "quarterly_trend": {
    "ttm": {
      "eps": 13.0,
      "revenue_b": 7014.0,
      "net_income_b": 933.0,
      "net_margin_pct": 13.3
    },
    "periods": [
      {
        "eps": 4.2,
        "period": "2026Q1",
        "revenue_b": 1864.0,
        "net_income_b": 308.1,
        "net_margin_pct": 16.5,
        "gross_margin_pct": 45.3,
        "operating_income_b": 394.4
      },
      {
        "eps": 2.4,
        "period": "2025Q4",
        "revenue_b": 1841.6,
        "net_income_b": 204.2,
        "net_margin_pct": 11.1,
        "gross_margin_pct": 36.2,
        "operating_income_b": 226.0
      },
      {
        "eps": 3.7,
        "period": "2025Q3",
        "revenue_b": 1723.2,
        "net_income_b": 267.9,
        "net_margin_pct": 15.5,
        "gross_margin_pct": 41.1,
        "operating_income_b": 313.5
      },
      {
        "eps": 2.3,
        "period": "2025Q2",
        "revenue_b": 1585.4,
        "net_income_b": 153.4,
        "net_margin_pct": 9.7,
        "gross_margin_pct": 41.1,
        "operating_income_b": 192.7
      },
      {
        "eps": 2.1,
        "period": "2025Q1",
        "revenue_b": 1737.9,
        "net_income_b": 103.9,
        "net_margin_pct": 6.0,
        "gross_margin_pct": 34.3,
        "operating_income_b": 161.7
      },
      {
        "eps": 1.2,
        "period": "2024Q4",
        "revenue_b": 1914.3,
        "net_income_b": 47.7,
        "net_margin_pct": 2.5,
        "gross_margin_pct": 32.8,
        "operating_income_b": 106.0
      }
    ],
    "momentum": {
      "margin_qoq_bps": 544.0,
      "margin_yoy_bps": 1055.0,
      "margin_trend_3q": "stable_3q",
      "revenue_qoq_pct": 1.2,
      "revenue_yoy_pct": 7.3,
      "net_income_qoq_pct": 50.9,
      "net_income_yoy_pct": 196.5,
      "latest_net_margin_pct": 16.5
    }
  },
  "dividend_profile": {
    "history": [
      {
        "dps": 27.0,
        "year": 2025
      },
      {
        "dps": 10.0,
        "year": 2024
      },
      {
        "dps": 6.5,
        "year": 2023
      },
      {
        "dps": 2.5,
        "year": 2022
      },
      {
        "dps": 11.2,
        "year": 2019
      }
    ],
    "ttm_dps": 27.0,
    "div_trend": "growing",
    "ttm_yield_pct": 11.74,
    "sustainability": "unsustainable",
    "payout_ratio_pct": 216.0,
    "latest_annual_dps": 27.0
  },
  "technical_context": {
    "wyckoff": {
      "latest_event": {
        "date": "2026-04-07",
        "type": "passive_markdown",
        "notes": "Passive markdown: -16% over 30 bars on avg vol z=-0.34",
        "confidence": 71
      },
      "current_phase": "markdown",
      "recent_events": [
        {
          "date": "2026-04-07",
          "type": "passive_markdown",
          "notes": "Passive markdown: -16% over 30 bars on avg vol z=-0.34",
          "phase": "markdown",
          "price": 258,
          "confidence": 71
        },
        {
          "date": "2026-03-31",
          "type": "basis_building",
          "notes": "Basis Building \u2014 downtrend stopped on stopping action, no textbook SC. Range 216-296 from bar 184. Soft entry to ACCUM_B",
          "phase": "accumulation",
          "price": 260,
          "confidence": 50
        },
        {
          "date": "2026-03-25",
          "type": "passive_markup",
          "notes": "Passive markup: +30% over 30 bars on avg vol z=-0.14",
          "phase": "markup",
          "price": 278,
          "confidence": 80
        },
        {
          "date": "2026-03-09",
          "type": "ST_low",
          "notes": "Secondary Test of 222 on lower volume (z=1.3 vs SC z=2.4) \u2014 supply absorbed",
          "phase": "accumulation",
          "price": 230,
          "confidence": 54
        },
        {
          "date": "2026-02-10",
          "type": "LPSY",
          "notes": "Last Point of Supply: lower high after SOW on volume z=0.6 \u2014 markdown entry",
          "phase": "markdown",
          "price": 288,
          "confidence": 53
        }
      ],
      "detection_version": "1.0"
    },
    "momentum": {
      "rsi_14": 35.57,
      "rsi_zone": "neutral",
      "data_date": "2026-05-29",
      "macd_line": -11.598,
      "macd_trend": "bullish",
      "macd_signal": -13.232,
      "macd_histogram": 1.634,
      "macd_last_cross": "golden_cross",
      "volume_change_pct": 73.17,
      "macd_cross_days_ago": 3
    },
    "price_vs_ma": {
      "close": 230.0,
      "sma_20": 239.0,
      "sma_50": 259.0,
      "sma_200": 309.0,
      "position": "below_all_mas",
      "data_date": "2026-06-02",
      "vs_sma20_pct": -3.8,
      "vs_sma50_pct": -11.2,
      "vs_sma200_pct": -25.6
    },
    "market_phase": {
      "range_low": 214,
      "phase_type": "sideways_bearish",
      "range_high": 268,
      "phase_start": "2026-04-29",
      "days_in_phase": 22,
      "trend_strength": "weak",
      "change_pct_in_phase": -13.74,
      "broker_flow_alignment": "confirms",
      "smart_money_alignment": 75
    }
  }
}

Respond with ONLY the following JSON schema:
{
  "lynch_category": "<slow_grower|stalwart|fast_grower|cyclical|turnaround|asset_play>",
  "lynch_rationale": "<2 kalimat dalam Bahasa Indonesia>",
  "buffett_moat": "<none|narrow|wide>",
  "buffett_moat_source": "<1-2 kalimat dalam Bahasa Indonesia>",
  "business_narrative": "<3-4 kalimat CERITA BISNIS dalam Bahasa Indonesia, bukan rangkuman angka>",
  "financial_health_signal": "<improving|stable|deteriorating>",
  "bull_case": {
    "scenario": "<3-4 kalimat dalam Bahasa Indonesia — HARUS menyebutkan asumsi keuangan spesifik: target revenue, margin, atau EPS>",
    "assumptions": "<1-2 kalimat: asumsi keuangan kuantitatif, misal 'revenue naik 20% ke Rp X, net margin membaik dari -15% ke 5%, target EPS Rp50'>",
    "valuation_basis": "<bagaimana price_target dihitung, misal 'pada PE 15x dan EPS Rp50 → target Rp750' atau 'pada PBV 1.5x dan BVPS Rp500 → target Rp750'>",
    "drivers": ["<faktor pendorong spesifik>","<faktor pendorong>","<faktor pendorong>"],
    "price_target": 0,
    "timeframe": "<6-12 bulan | 1-2 tahun | 2-3 tahun>",
    "probability": "<low|medium|high>",
    "early_signs": ["<tanda awal yang bisa diukur>","<tanda awal>"]
  },
  "bear_case": {
    "scenario": "<3-4 kalimat dalam Bahasa Indonesia — HARUS menyebutkan skenario penurunan spesifik>",
    "assumptions": "<1-2 kalimat: asumsi penurunan kuantitatif, misal 'revenue turun 10%, margin tertekan ke -30%'>",
    "valuation_basis": "<bagaimana price_target dihitung, misal 'pada PBV 0.5x dan BVPS Rp200 → Rp100'>",
    "drivers": ["<faktor risiko spesifik>","<faktor risiko>","<faktor risiko>"],
    "price_target": 0,
    "timeframe": "<>",
    "probability": "<low|medium|high>",
    "early_signs": ["<tanda awal yang bisa diukur>","<tanda awal>"]
  },
  "neutral_case": {
    "scenario": "<3-4 kalimat dalam Bahasa Indonesia — jalur paling mungkin, dengan asumsi kuantitatif>",
    "assumptions": "<1-2 kalimat: asumsi status quo, misal 'revenue tumbuh 5-8%, margin stabil di X%'>",
    "drivers": ["<faktor>","<faktor>"],
    "price_range_low": 0,
    "price_range_high": 0,
    "timeframe": "<>",
    "probability": "<low|medium|high>",
    "what_breaks_it": ["<pemicu ke bull dengan threshold spesifik>","<pemicu ke bear dengan threshold spesifik>"]
  },
  "strategy_fit": {
    "primary": "<strategi>",
    "ideal_investor": "<siapa + horizon + ukuran posisi, dalam Bahasa Indonesia>",
    "position_sizing": "<full_position|half_position|small_speculative|avoid>"
  },
  "what_to_watch": ["<metrik + threshold dalam Bahasa Indonesia>","<>","<>"],
  "analyst_verdict": "<strong_buy|buy|hold|avoid|strong_avoid>",
  "confidence_level": 0,
  "data_gaps_acknowledged": ["<keterbatasan data dalam Bahasa Indonesia>"],
  "caveats": ["<catatan penting dalam Bahasa Indonesia>"]
}
```
