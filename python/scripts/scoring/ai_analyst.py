"""
Stage 5: AI Analyst — Generate 3-scenario investment thesis via LLM.

Uses a provider-agnostic interface so the model is interchangeable:
- OpenAI (default): gpt-5.2, gpt-5.2, gpt-4o
- Anthropic: claude-sonnet-4-20250514, etc.

Single enriched call per ticker with 3-layer context injection
(macro + sector template + domain notes).

FRD reference: Section 6 (AI Analyst Module)
"""

from __future__ import annotations

import json
import logging
import os
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from scripts.scoring.schema import AIAnalysisResult

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# System prompt (FRD §6.3)
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """Kamu adalah analis ekuitas senior untuk saham Indonesia (IDX/BEI). Kamu menggabungkan
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

PENTING — GUNAKAN VALUASI DARI BUNDLE SEBAGAI ANCHOR:
- Bundle sudah berisi valuasi yang sudah dihitung: graham_number, dcf_bear, dcf_base, dcf_bull.
- HARGA TARGET HARUS KONSISTEN dengan valuasi di bundle:
  * Bull price_target ≈ sekitar dcf_bull atau di atasnya (jika ada katalis tambahan)
  * Neutral price_range ≈ sekitar dcf_base ± 10-20%
  * Bear price_target ≈ sekitar dcf_bear atau graham_number (mana yang lebih rendah)
- Jika dcf_bull = 4,807 dan graham = null, maka bull target TIDAK BOLEH jauh di bawah 4,000.
- Jika kamu yakin valuasi DCF terlalu tinggi/rendah, JELASKAN mengapa kamu menyimpang
  (misal: "DCF mengasumsikan FCF stabil, tapi untuk perusahaan cyclical post-peak ini tidak realistis").
- JANGAN membuat angka sendiri tanpa referensi ke valuasi bundle atau asumsi keuangan eksplisit.

METODE VALUASI — PILIH SESUAI TIPE SAHAM (JANGAN selalu pakai PE):
- stalwart / slow_grower: PE × EPS cocok. Gunakan PE historis rata-rata atau PE sektor sebagai acuan.
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

- Price target HARUS masuk akal relatif terhadap harga saat ini DAN valuasi di bundle.
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

Output HANYA JSON valid sesuai skema yang diberikan. Tanpa markdown, tanpa pembukaan."""

OUTPUT_SCHEMA = """{
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
}"""


# ---------------------------------------------------------------------------
# Provider abstraction
# ---------------------------------------------------------------------------

@dataclass
class LLMResponse:
    content: str
    prompt_tokens: int = 0
    output_tokens: int = 0
    model: str = ""


class LLMProvider(ABC):
    """Abstract base for LLM providers."""

    @abstractmethod
    def chat(self, system: str, user: str) -> LLMResponse:
        ...


class OpenAIProvider(LLMProvider):
    """OpenAI-compatible provider (works with OpenAI, Azure, local proxies)."""

    def __init__(self, model: str = "gpt-5.2", api_key: Optional[str] = None,
                 base_url: Optional[str] = None):
        self.model = model
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY")
        self.base_url = base_url
        self._client = None

    def _get_client(self):
        if self._client is None:
            from openai import OpenAI
            kwargs = {"api_key": self.api_key}
            if self.base_url:
                kwargs["base_url"] = self.base_url
            self._client = OpenAI(**kwargs)
        return self._client

    def chat(self, system: str, user: str) -> LLMResponse:
        client = self._get_client()
        response = client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=0.3,
            response_format={"type": "json_object"},
        )
        choice = response.choices[0]
        usage = response.usage
        return LLMResponse(
            content=choice.message.content or "",
            prompt_tokens=usage.prompt_tokens if usage else 0,
            output_tokens=usage.completion_tokens if usage else 0,
            model=response.model or self.model,
        )


class AnthropicProvider(LLMProvider):
    """Anthropic Claude provider."""

    def __init__(self, model: str = "claude-sonnet-4-20250514", api_key: Optional[str] = None):
        self.model = model
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        self._client = None

    def _get_client(self):
        if self._client is None:
            from anthropic import Anthropic
            self._client = Anthropic(api_key=self.api_key)
        return self._client

    def chat(self, system: str, user: str) -> LLMResponse:
        client = self._get_client()
        response = client.messages.create(
            model=self.model,
            max_tokens=4096,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        content = response.content[0].text if response.content else ""
        return LLMResponse(
            content=content,
            prompt_tokens=response.usage.input_tokens if response.usage else 0,
            output_tokens=response.usage.output_tokens if response.usage else 0,
            model=self.model,
        )


def get_provider(
    provider: str = "openai",
    model: Optional[str] = None,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
) -> LLMProvider:
    """Factory: create the appropriate LLM provider."""
    if provider == "openai":
        return OpenAIProvider(model=model or "gpt-5.2", api_key=api_key, base_url=base_url)
    elif provider == "anthropic":
        return AnthropicProvider(model=model or "claude-sonnet-4-20250514", api_key=api_key)
    else:
        raise ValueError(f"Unknown provider: {provider}. Use 'openai' or 'anthropic'.")


# ---------------------------------------------------------------------------
# Output validation (FRD §6.5)
# ---------------------------------------------------------------------------

VALID_LYNCH = {"slow_grower", "stalwart", "fast_grower", "cyclical", "turnaround", "asset_play"}
VALID_VERDICT = {"strong_buy", "buy", "hold", "avoid", "strong_avoid"}
VALID_HEALTH = {"improving", "stable", "deteriorating"}


def validate_output(
    output: dict,
    current_price: Optional[float] = None,
    data_gap_flags: Optional[List[str]] = None,
    reliability_grade: Optional[str] = None,
) -> List[str]:
    """
    Validate AI output against structural, consistency, and quality rules.
    Returns list of validation errors (empty = valid).
    """
    errors = []

    # ── Structural checks ────────────────────────────────────
    required_fields = [
        "lynch_category", "buffett_moat", "analyst_verdict",
        "confidence_level", "bull_case", "bear_case", "neutral_case",
        "business_narrative", "strategy_fit", "what_to_watch",
    ]
    for field in required_fields:
        if field not in output:
            errors.append(f"missing_field: {field}")

    if output.get("lynch_category") and output["lynch_category"] not in VALID_LYNCH:
        errors.append(f"invalid_lynch_category: {output['lynch_category']}")

    if output.get("analyst_verdict") and output["analyst_verdict"] not in VALID_VERDICT:
        errors.append(f"invalid_analyst_verdict: {output['analyst_verdict']}")

    if output.get("financial_health_signal") and output["financial_health_signal"] not in VALID_HEALTH:
        errors.append(f"invalid_health_signal: {output['financial_health_signal']}")

    cl = output.get("confidence_level")
    if cl is not None:
        if isinstance(cl, (int, float)):
            # Normalize: models return various scales
            if 0 < cl < 1:         # 0-1 scale → multiply by 10
                cl = round(cl * 10)
            elif cl > 10:           # 0-100 or percentage scale → divide by 10
                cl = round(cl / 10)
            cl = max(1, min(10, int(cl)))  # clamp to 1-10
            output["confidence_level"] = cl
        if not isinstance(cl, (int, float)) or cl < 1 or cl > 10:
            errors.append(f"confidence_level_out_of_range: {cl}")

    # ── Scenario consistency ─────────────────────────────────
    bull = output.get("bull_case", {})
    bear = output.get("bear_case", {})
    neutral = output.get("neutral_case", {})

    bull_price = bull.get("price_target")
    bear_price = bear.get("price_target")
    neutral_high = neutral.get("price_range_high")
    neutral_low = neutral.get("price_range_low")

    # Scenario ordering: bull > neutral > bear (warn but don't block — some overvalued stocks
    # legitimately have all targets below current price, and GPT may invert the ordering)
    if bull_price and bear_price and bull_price <= bear_price:
        # Auto-fix: swap them
        output["bull_case"]["price_target"], output["bear_case"]["price_target"] = bear_price, bull_price
        # Also swap scenarios if they look inverted
        if "penurunan" in (bull.get("scenario") or "").lower() or "naik" in (bear.get("scenario") or "").lower():
            output["bull_case"], output["bear_case"] = output["bear_case"], output["bull_case"]

    if neutral_low and neutral_high and neutral_low >= neutral_high:
        errors.append(f"neutral_range_inverted: low ({neutral_low}) >= high ({neutral_high})")

    # Price sanity — no hard cap, just check for obvious errors (negative or zero)
    for label, price in [("bull", bull_price), ("bear", bear_price)]:
        if price is not None and price <= 0:
            errors.append(f"{label}_price_invalid: {price} must be positive")

    # ── Data quality alignment ───────────────────────────────
    if data_gap_flags and len(data_gap_flags) > 0:
        ack = output.get("data_gaps_acknowledged", [])
        if not ack or len(ack) == 0:
            errors.append("data_gaps_not_acknowledged: context has gaps but output has no acknowledgement")

    if reliability_grade in ("C", "D", "F"):
        if cl and cl > 7:
            errors.append(f"confidence_too_high_for_reliability: confidence_level={cl} but reliability={reliability_grade}")

    # At least one caveat
    caveats = output.get("caveats", [])
    if not caveats or len(caveats) == 0:
        errors.append("no_caveats: at least 1 caveat required")

    return errors


# ---------------------------------------------------------------------------
# Prompt construction
# ---------------------------------------------------------------------------

def build_user_prompt(
    context_json: dict,
    sector_template: Optional[dict] = None,
    macro_context: Optional[dict] = None,
    domain_notes: Optional[str] = None,
) -> str:
    """Assemble the user prompt from context bundle + layers."""
    parts = []

    # Macro context
    if macro_context:
        parts.append(f"MACRO CONTEXT ({macro_context.get('as_of', 'current')}):")
        parts.append(f"  BI rate: {macro_context.get('bi_rate')}% ({macro_context.get('bi_rate_direction', 'unknown')})")
        parts.append(f"  IDR: {macro_context.get('usd_idr')}/USD ({macro_context.get('idr_trend', '')})")
        parts.append(f"  IDX YTD: {macro_context.get('idx_composite_ytd')}%")
        parts.append(f"  Foreign flow: {macro_context.get('foreign_flow_regime', 'unknown')}")
        if macro_context.get("foreign_flow_note"):
            parts.append(f"  Note: {macro_context['foreign_flow_note']}")
        parts.append("")

    # Sector template
    if sector_template:
        parts.append(f"SECTOR TEMPLATE ({sector_template.get('subsector', 'unknown')}):")
        if sector_template.get("key_metrics"):
            parts.append(f"  Key metrics: {sector_template['key_metrics']}")
        if sector_template.get("valuation_method"):
            parts.append(f"  Valuation: {sector_template['valuation_method']}")
        if sector_template.get("current_dynamics"):
            parts.append(f"  Dynamics: {sector_template['current_dynamics']}")
        if sector_template.get("common_risks"):
            parts.append(f"  Risks: {sector_template['common_risks']}")
        if sector_template.get("exemptions"):
            parts.append(f"  Exemptions: {sector_template['exemptions']}")
        parts.append("")

    # Domain notes
    if domain_notes:
        parts.append(f"DOMAIN CONTEXT (user-provided):")
        parts.append(f"  {domain_notes}")
        parts.append("")
    else:
        parts.append("DOMAIN CONTEXT: None available. Base analysis on data + macro + sector template only.")
        parts.append("Flag conclusions that would benefit from deeper company-specific knowledge.")
        parts.append("")

    # Valuation anchors — extracted and highlighted so AI can't miss them
    val = context_json.get("valuation", {})
    current_price = val.get("current_price")
    fundamentals = context_json.get("fundamentals", {}).get("metrics", {})

    # Extract additional valuation data points ("value" is the key used by context_builder)
    bvps = fundamentals.get("bvps", {}).get("value")
    eps = fundamentals.get("eps", {}).get("value")
    revenue = fundamentals.get("revenue", {}).get("value")
    market_cap = val.get("market_cap")
    ps_ratio = None
    if revenue and market_cap and revenue > 0:
        ps_ratio = round(market_cap / revenue, 2)

    dcf_mode = val.get("dcf_mode")
    dcf_mode_label = {
        "fcf": "berbasis Free Cash Flow",
        "dividend": "berbasis Dividen (DDM — cocok untuk bank/dividend payer)",
        "eps": "berbasis Earnings (EPS — dipakai karena FCF negatif)",
    }.get(dcf_mode, "tidak tersedia")

    parts.append("ANCHOR VALUASI (SUDAH DIHITUNG — gunakan sebagai referensi harga target):")
    parts.append(f"  Harga saat ini: Rp{current_price:,.0f}" if current_price else "  Harga saat ini: tidak tersedia")
    parts.append(f"  Graham Number: Rp{val['graham_number']:,.0f}" if val.get("graham_number") else "  Graham Number: tidak tersedia (EPS/BVPS negatif)")
    parts.append(f"  DCF Mode: {dcf_mode_label}")
    dcf_growth = val.get("dcf_growth_pct")
    parts.append(f"  DCF Growth Assumed: {dcf_growth:.1f}% p.a." if dcf_growth is not None else "")
    parts.append(f"  DCF Bear:  Rp{val['dcf_bear']:,.0f}" if val.get("dcf_bear") else "  DCF Bear: tidak tersedia")
    parts.append(f"  DCF Base:  Rp{val['dcf_base']:,.0f}" if val.get("dcf_base") else "  DCF Base: tidak tersedia")
    parts.append(f"  DCF Bull:  Rp{val['dcf_bull']:,.0f}" if val.get("dcf_bull") else "  DCF Bull: tidak tersedia")
    parts.append(f"  PE: {val.get('pe_ratio', '—')}  |  PB: {val.get('pb_ratio', '—')}")
    parts.append(f"  EPS: Rp{eps:,.2f}" if eps else "  EPS: tidak tersedia")
    parts.append(f"  BVPS: Rp{bvps:,.2f}" if bvps else "  BVPS: tidak tersedia")
    parts.append(f"  PS Ratio: {ps_ratio}x" if ps_ratio else "  PS Ratio: tidak tersedia")
    parts.append("")
    parts.append("ATURAN ANCHOR:")
    parts.append("- Untuk stalwart/slow_grower: gunakan PE sebagai acuan utama")
    parts.append("- Untuk cyclical: gunakan EV/EBITDA atau PBV di titik siklus, BUKAN PE")
    parts.append("- Untuk turnaround/properti: gunakan PBV × BVPS atau NAV (nilai aset)")
    parts.append("- Untuk fast_grower/rugi: gunakan PS ratio atau revenue multiple")
    parts.append("- Untuk bank: gunakan PBV × BVPS (bank premium 3-5x, menengah 1-2x)")
    parts.append("- DCF di bundle bisa digunakan sebagai cross-check, bukan satu-satunya acuan")
    parts.append("- Jika kamu menyimpang dari anchor, JELASKAN alasannya secara eksplisit.")
    parts.append("")

    # DCF gap context + verdict guidance
    if current_price and (val.get("dcf_bear") or val.get("dcf_base") or val.get("dcf_bull")):
        dcf_bear = val.get("dcf_bear")
        dcf_base = val.get("dcf_base")
        dcf_bull = val.get("dcf_bull")
        parts.append("MARGIN OF SAFETY — WAJIB DIBACA SEBELUM MENENTUKAN VERDICT:")
        if dcf_bear:
            gap_bear = (dcf_bear - current_price) / current_price * 100
            parts.append(f"  Harga vs DCF Bear:  {gap_bear:+.1f}%  ({'harga DI BAWAH bear case → margin of safety sangat besar' if gap_bear > 0 else 'harga DI ATAS bear case → downside terbuka'})")
        if dcf_base:
            gap_base = (dcf_base - current_price) / current_price * 100
            parts.append(f"  Harga vs DCF Base:  {gap_base:+.1f}%")
        if dcf_bull:
            gap_bull = (dcf_bull - current_price) / current_price * 100
            parts.append(f"  Harga vs DCF Bull:  {gap_bull:+.1f}%")
        parts.append("")
        parts.append("  PENTING — KETERBATASAN DCF:")
        parts.append("  DCF adalah estimasi berbasis asumsi pertumbuhan standar, bukan valuasi absolut.")
        parts.append("  Bisnis berkualitas tinggi (ROE konsisten >18%, margin tinggi dan defensif, moat nyata)")
        parts.append("  sering wajar diperdagangkan di atas DCF karena kualitas dan optionality jangka panjang")
        parts.append("  tidak sepenuhnya tercermin dalam model standar. Premium vs DCF BUKAN otomatis 'overvalued'.")
        parts.append("")

        # Pull quality metrics to enable premium override
        net_margin_v = fundamentals.get("net_margin", {}).get("value") if fundamentals else None
        roe_v = fundamentals.get("roe", {}).get("value") if fundamentals else None
        is_high_quality = bool(
            (roe_v is not None and roe_v >= 18) and
            (net_margin_v is not None and net_margin_v >= 12)
        )

        graham = val.get("graham_number")
        div_profile = context_json.get("dividend_profile") or {}
        ttm_yield = div_profile.get("ttm_yield_pct") or 0

        parts.append("PANDUAN VERDICT (bukan mandat absolut — pertimbangkan konteks bisnis secara menyeluruh):")
        # High-yield + Graham discount: strong positive signal, keep as firm guidance
        if ttm_yield >= 9 and current_price and graham and current_price < graham * 0.85:
            parts.append(f"  *** TTM yield {ttm_yield:.1f}% + harga >15% di bawah Graham Number (Rp{graham:,}) → default verdict 'strong_buy' ***")
            parts.append("  *** Yield tinggi + diskon Graham = margin of safety ganda: pendapatan tunai + potensi capital gain ***")
            parts.append("  *** Override ke 'buy' hanya jika ada risiko bisnis fundamental yang nyata dan terukur ***")
        elif ttm_yield >= 7 and current_price and graham and current_price < graham:
            parts.append(f"  ** TTM yield {ttm_yield:.1f}% + harga di bawah Graham Number (Rp{graham:,}) → default verdict 'buy' **")
        # Price well below even bear case: strong value signal
        elif dcf_bear and current_price < dcf_bear * 0.85:
            parts.append("  *** Harga >15% di bawah DCF BEAR → default verdict 'strong_buy' ***")
            parts.append("  *** Override ke 'buy' hanya jika ada risiko bisnis fundamental yang nyata (bukan arus asing) ***")
        elif dcf_bear and current_price < dcf_bear:
            parts.append("  ** Harga di bawah DCF BEAR → default verdict 'buy' atau 'strong_buy' **")
        # Price well above bull case — nuanced by quality
        elif dcf_bull and current_price > dcf_bull * 1.15 and ttm_yield < 5:
            roe_str = f"{roe_v:.0f}%" if roe_v else "tidak diketahui"
            margin_str = f"{net_margin_v:.0f}%" if net_margin_v else "tidak diketahui"
            parts.append(f"  !! Harga {abs(gap_bull):.1f}% di atas DCF Bull — premium nyata (ROE={roe_str}, margin={margin_str}).")
            if is_high_quality:
                parts.append("  !! ROE dan margin tinggi menunjukkan potensi quality premium yang wajar.")
                parts.append("  !! Pilihan verdict yang tepat: 'hold' (premium terjustifikasi oleh kualitas) atau 'avoid' (premium terlalu jauh).")
                parts.append("  !! Gunakan 'strong_avoid' HANYA jika kamu menemukan risiko bisnis fundamental yang konkret dan spesifik.")
                parts.append("  !! WAJIB jelaskan di caveats: berapa premium yang kamu anggap wajar untuk bisnis ini dan mengapa.")
            else:
                parts.append("  !! ROE/margin tidak cukup tinggi untuk justify premium besar vs DCF.")
                parts.append("  !! Default verdict 'avoid' atau 'strong_avoid'. Override ke 'hold' hanya dengan katalis pertumbuhan konkret.")
        elif dcf_base and current_price > dcf_base * 1.1 and ttm_yield < 5:
            parts.append("  * Harga >10% di atas DCF BASE dan yield rendah → pertimbangkan 'avoid', atau 'hold' jika ada growth catalyst.")
        parts.append("  * Arus asing negatif / smart money distribusi adalah sinyal TIMING, bukan dasar mengubah verdict fundamental *")
        parts.append("  * Jika verdict berbeda dari panduan di atas, JELASKAN kualitas bisnis atau risiko fundamental spesifik yang menjadi alasannya *")
        parts.append("")

    # Category-specific analysis questions — force the AI to address key issues
    # Auto-detect likely Lynch category from data patterns
    health = context_json.get("health_score", {})
    smart_money = context_json.get("smart_money", {})
    net_margin = fundamentals.get("net_margin", {}).get("value")
    roe_val = fundamentals.get("roe", {}).get("value")
    rev_trend = fundamentals.get("revenue", {}).get("trend")
    ni_trend = fundamentals.get("net_income", {}).get("trend")
    pe = val.get("pe_ratio")
    sector = context_json.get("sector", "")
    sub_sector = context_json.get("sub_sector", "")

    # Detect if stock looks like a turnaround
    is_likely_turnaround = (
        (net_margin is not None and net_margin < 3) or
        (roe_val is not None and roe_val < 3) or
        (pe is not None and pe > 100) or
        (eps is not None and eps < 0)
    )
    is_likely_cyclical = rev_trend in ("volatile",) and ni_trend in ("volatile",)
    is_property = "properti" in sub_sector.lower() or "property" in sector.lower()
    is_bank = "bank" in sub_sector.lower()

    if is_likely_turnaround:
        parts.append("PERTANYAAN WAJIB DIJAWAB (turnaround):")
        parts.append("Dalam business_narrative, JAWAB pertanyaan ini:")
        parts.append("1. APA YANG RUSAK: Mengapa margin tipis/negatif? Apa masalah fundamentalnya?")
        parts.append("2. APA YANG BERUBAH: Apa katalis pemulihan spesifik? (proyek baru, manajemen baru, restrukturisasi)")
        parts.append("3. APA MILESTONE: Kapan break-even? Target margin berapa? Apa yang harus terjadi?")
        if is_property:
            parts.append("4. KHUSUS PROPERTI: Berapa nilai land bank? Proyek apa yang sedang dikembangkan?")
            parts.append("   Apakah margin rendah karena belum ada penjualan besar atau memang bisnis yang buruk?")
        parts.append("")
    elif is_property and ttm_yield >= 7:
        parts.append("PERTANYAAN WAJIB DIJAWAB (properti/kawasan industri high-yield):")
        parts.append("1. SUMBER YIELD: Apakah yield tinggi ini sustainable? Dari laba land deal satu kali atau recurring?")
        parts.append("2. LAND BANK: Berapa sisa land bank yang bisa dijual? Berapa tahun runway penjualan?")
        parts.append("3. KOMITMEN DIVIDEN: Apakah manajemen konsisten membagi dividen meski revenue fluktuatif?")
        parts.append("4. KATALIS FDI: Apa relokasi industri atau FDI yang bisa mendorong permintaan lahan?")
        parts.append(f"5. YIELD vs RISK-FREE: Yield {ttm_yield:.1f}% vs BI rate — berapa spread keamanan untuk investor?")
        parts.append("")
    elif is_likely_cyclical:
        parts.append("PERTANYAAN WAJIB DIJAWAB (cyclical):")
        parts.append("1. POSISI SIKLUS: Di mana posisi saat ini — puncak, turun, dasar, atau naik?")
        parts.append("2. PEMICU BALIK: Apa yang akan membalikkan siklus? Harga komoditas? Demand?")
        parts.append("3. TIMING: Kapan siklus diperkirakan berbalik? Tanda-tanda awal apa yang harus dipantau?")
        parts.append("")
    elif is_bank:
        parts.append("PERTANYAAN WAJIB DIJAWAB (bank):")
        parts.append("1. KUALITAS FRANCHISE: Bagaimana posisi CASA dan NIM vs peers?")
        parts.append("2. ASSET QUALITY: Apa risiko NPL terbesar? Di segmen mana?")
        parts.append("3. PERTUMBUHAN: Dari mana pertumbuhan kredit akan datang?")
        parts.append("")

    # Data quality narrative — instruct AI to reason about data patterns
    dq = context_json.get("data_quality", {})
    reliability = dq.get("reliability_score", 0)
    confidence = dq.get("confidence_score", 0)
    clean_years_count = dq.get("data_years_available", 0)
    anomalous_years = dq.get("anomalous_years", [])
    missing = dq.get("missing_metrics", [])
    gap_flags = dq.get("data_gap_flags", [])

    parts.append("KUALITAS DATA — ANALISIS INI SEBAGAI SINYAL, BUKAN HAMBATAN:")
    parts.append(f"  Reliability: {dq.get('reliability_grade', '?')} ({reliability}/100)")
    parts.append(f"  Confidence: {dq.get('confidence_grade', '?')} ({confidence}/100)")
    parts.append(f"  Data years: {clean_years_count}")
    if anomalous_years:
        parts.append(f"  Tahun anomali: {anomalous_years}")
    if missing:
        parts.append(f"  Metrik tidak tersedia: {missing}")
    if gap_flags:
        parts.append(f"  Data gaps: {gap_flags}")
    parts.append("")
    parts.append("ATURAN KUALITAS DATA:")
    parts.append("- Data yang volatile atau anomali BUKAN alasan untuk menolak analisis.")
    parts.append("- Sebaliknya, INTERPRETASIKAN pola data sebagai sinyal bisnis:")
    parts.append("  * Banyak anomali + tren membaik → kemungkinan turnaround/transformasi bisnis")
    parts.append("  * Revenue/margin volatile → cyclical atau sedang restrukturisasi")
    parts.append("  * Data terbatas (<5 tahun) → IPO baru atau transformasi besar (akuisisi, merger)")
    parts.append("  * Perubahan skala mendadak → akuisisi, divestasi, atau perubahan model bisnis")
    parts.append("- Jelaskan MENGAPA data terlihat seperti ini dan apa implikasinya untuk masa depan.")
    parts.append("- Jika data terlalu sedikit untuk kesimpulan kuat, tetap berikan analisis terbaik")
    parts.append("  dengan confidence_level rendah (1-4) dan caveats yang jelas.")
    parts.append("- Contoh narasi: 'Tren 5 tahun sangat volatile, namun 2 tahun terakhir menunjukkan")
    parts.append("  perbaikan konsisten — ini mengindikasikan transformasi bisnis sedang berjalan.'")
    parts.append("")

    # Block 9: technical context — highlighted before full bundle dump
    tech = context_json.get("technical_context") or {}
    if tech:
        parts.append("SINYAL TEKNIKAL (Block 9 — GUNAKAN untuk timing dan konfirmasi tesis):")

        pvm = tech.get("price_vs_ma", {})
        if pvm:
            parts.append(f"  Harga vs MA (per {pvm.get('data_date','?')}):")
            parts.append(f"    Close={pvm.get('close')}  |  SMA20={pvm.get('sma_20')}  SMA50={pvm.get('sma_50')}  SMA200={pvm.get('sma_200')}")
            parts.append(f"    vs SMA20: {pvm.get('vs_sma20_pct'):+.1f}%  |  vs SMA50: {pvm.get('vs_sma50_pct'):+.1f}%  |  vs SMA200: {pvm.get('vs_sma200_pct'):+.1f}%")
            parts.append(f"    Posisi: {pvm.get('position')}")

        mom = tech.get("momentum", {})
        if mom:
            cross_str = ""
            if mom.get("macd_last_cross"):
                cross_str = f"  |  {mom['macd_last_cross']} {mom.get('macd_cross_days_ago','?')} hari lalu"
            parts.append(f"  Momentum (per {mom.get('data_date','?')}):")
            parts.append(f"    RSI-14={mom.get('rsi_14')} ({mom.get('rsi_zone','?')})")
            parts.append(f"    MACD histogram={mom.get('macd_histogram')} ({mom.get('macd_trend','?')}){cross_str}")
            if mom.get("volume_change_pct") is not None:
                parts.append(f"    Volume vs SMA20: {mom['volume_change_pct']:+.1f}%")

        mkt = tech.get("market_phase", {})
        if mkt:
            parts.append(f"  Fase Pasar (SMA-based): {mkt.get('phase_type')} | strength={mkt.get('trend_strength')} | {mkt.get('change_pct_in_phase'):+.1f}% in {mkt.get('days_in_phase')} hari (sejak {mkt.get('phase_start')})")
            parts.append(f"    Range: {mkt.get('range_low')}–{mkt.get('range_high')} | smart_money_alignment={mkt.get('smart_money_alignment')} | broker_flow={mkt.get('broker_flow_alignment')}")

        wyc = tech.get("wyckoff", {})
        if wyc:
            parts.append(f"  Wyckoff (v{wyc.get('detection_version','?')}): fase saat ini = {wyc.get('current_phase')}")
            le = wyc.get("latest_event", {})
            if le:
                parts.append(f"    Event terbaru: {le.get('type')} ({le.get('date')}) conf={le.get('confidence')} — {le.get('notes','')}")
            recent = wyc.get("recent_events", [])
            if len(recent) > 1:
                parts.append(f"    Riwayat: {' → '.join(e.get('type','?') for e in recent)}")

        parts.append("")
        parts.append("ATURAN SINYAL TEKNIKAL:")
        parts.append("- Wyckoff fase 'accumulation' + harga di bawah semua MA + RSI oversold = konfirmasi entry timing untuk buy")
        parts.append("- Wyckoff fase 'distribution' + harga di atas semua MA + RSI overbought = konfirmasi entry timing untuk sell/avoid")
        parts.append("- MACD golden cross setelah periode bearish = sinyal pembalikan awal, tidak cukup sendiri tapi memperkuat bull case")
        parts.append("- Jika teknikal kontradiksi dengan fundamental: SEBUTKAN konflik dan jelaskan tesis mana yang lebih dominan")
        parts.append("- Jika data teknikal tidak tersedia: jangan buat asumsi timing — cukup tulis 'sinyal teknikal tidak tersedia'")
        parts.append("")
    else:
        parts.append("SINYAL TEKNIKAL: Tidak tersedia — jangan membuat asumsi timing dari teknikal.")
        parts.append("")

    # ── Block 10: Quarterly Trend ────────────────────────────────
    qt = context_json.get("quarterly_trend") or {}
    periods = qt.get("periods") or []
    ttm = qt.get("ttm") or {}
    mom = qt.get("momentum") or {}
    if periods:
        parts.append("TREN KUARTALAN (Block 10 — GUNAKAN untuk menilai momentum jangka pendek):")
        header = f"  {'Period':<8} {'Rev (B)':<10} {'NI (B)':<10} {'Margin%':<10} {'EPS':<8}"
        parts.append(header)
        parts.append("  " + "-" * 46)
        for p in periods:
            rev  = f"{p.get('revenue_b'):.1f}"     if p.get('revenue_b')     is not None else "—"
            ni   = f"{p.get('net_income_b'):.1f}"  if p.get('net_income_b')  is not None else "—"
            marg = f"{p.get('net_margin_pct'):.1f}" if p.get('net_margin_pct') is not None else "—"
            eps  = f"{p.get('eps'):.0f}"            if p.get('eps')           is not None else "—"
            parts.append(f"  {p.get('period','?'):<8} {rev:<10} {ni:<10} {marg:<10} {eps:<8}")
        parts.append("")

        if ttm:
            parts.append(f"  TTM (trailing 12M): Rev={ttm.get('revenue_b')}B | NI={ttm.get('net_income_b')}B | Margin={ttm.get('net_margin_pct')}% | EPS={ttm.get('eps')}")
            parts.append("")

        if mom:
            qoq_rev = f"{mom['revenue_qoq_pct']:+.1f}%" if mom.get('revenue_qoq_pct') is not None else "—"
            qoq_ni  = f"{mom['net_income_qoq_pct']:+.1f}%" if mom.get('net_income_qoq_pct') is not None else "—"
            yoy_rev = f"{mom['revenue_yoy_pct']:+.1f}%" if mom.get('revenue_yoy_pct') is not None else "—"
            yoy_ni  = f"{mom['net_income_yoy_pct']:+.1f}%" if mom.get('net_income_yoy_pct') is not None else "—"
            margin_trend = mom.get('margin_trend_3q', '—')
            parts.append(f"  Momentum QoQ: Rev={qoq_rev}  NI={qoq_ni}")
            parts.append(f"  Momentum YoY: Rev={yoy_rev}  NI={yoy_ni}")
            parts.append(f"  Tren margin 3Q: {margin_trend}  (margin terkini={mom.get('latest_net_margin_pct','—')}%)")
            parts.append("")

        parts.append("ATURAN TREN KUARTALAN:")
        parts.append("- QoQ revenue positif + margin improving_3q = momentum fundamental menguat → perkuat bull case")
        parts.append("- QoQ revenue negatif + margin declining_3q = tekanan fundamental meningkat → perkuat bear case")
        parts.append("- TTM margin vs annual margin: jika TTM > annual → pemulihan sedang berjalan")
        parts.append("- Jika data kuartalan tidak tersedia: catatan sebagai data_gap dalam data_gaps_acknowledged")
        parts.append("")
    else:
        parts.append("TREN KUARTALAN: Tidak tersedia — tambahkan ke data_gaps_acknowledged.")
        parts.append("")

    # ── Block 11: Dividend Profile ───────────────────────────────
    dp = context_json.get("dividend_profile") or {}
    if dp and dp.get("ttm_dps"):
        ttm_dps      = dp.get("ttm_dps")
        ttm_yield    = dp.get("ttm_yield_pct")
        payout       = dp.get("payout_ratio_pct")
        sustainability = dp.get("sustainability", "—")
        div_trend    = dp.get("div_trend", "—")
        history      = dp.get("history") or []

        parts.append("PROFIL DIVIDEN (Block 11 — KRITIS untuk saham yield tinggi):")
        parts.append(f"  TTM DPS:       Rp{ttm_dps:.2f}/saham")
        parts.append(f"  TTM Yield:     {ttm_yield:.2f}%" if ttm_yield else "  TTM Yield:     —")
        parts.append(f"  Payout Ratio:  {payout:.1f}%" if payout else "  Payout Ratio:  —")
        parts.append(f"  Sustainability:{sustainability}  |  Tren: {div_trend}")
        if history:
            parts.append("  Riwayat DPS:")
            for h in history:
                parts.append(f"    {h.get('year')}: Rp{h.get('dps'):.2f}")
        parts.append("")
        parts.append("ATURAN PROFIL DIVIDEN:")
        parts.append("- TTM yield ≥8% pada harga saat ini = high-yield stock → DCF mode 'dividend' HARUS digunakan sebagai anchor utama")
        parts.append("- Payout ratio >100% = dividen tidak sustainable dari laba — lihat FCF untuk konfirmasi kemampuan bayar")
        parts.append("- Jika yield ≥9% dan sustainability 'moderate'/'healthy': ini adalah sinyal value utama, harus masuk business_narrative")
        parts.append("- Dividen konsisten selama 3+ tahun meski revenue volatile = tanda komitmen manajemen terhadap pemegang saham")
        parts.append("- Jangan abaikan yield hanya karena revenue berfluktuasi — properti/kawasan industri memang cyclical secara revenue")
        parts.append("")
    else:
        parts.append("PROFIL DIVIDEN: Tidak tersedia atau belum pernah bayar dividen.")
        parts.append("")

    # Data bundle
    parts.append("STOCK DATA BUNDLE:")
    parts.append(json.dumps(context_json, indent=2, default=str))
    parts.append("")

    # Output instruction
    parts.append("Respond with ONLY the following JSON schema:")
    parts.append(OUTPUT_SCHEMA)

    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Main analyst class
# ---------------------------------------------------------------------------

class AIAnalyst:
    """
    Generate 3-scenario investment thesis via LLM.

    Model-agnostic: supports OpenAI (default: gpt-5.2) and Anthropic.
    """

    def __init__(
        self,
        provider: str = "openai",
        model: Optional[str] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
    ):
        self.llm = get_provider(provider, model, api_key, base_url)
        self.provider_name = provider
        self.model_name = model or ("gpt-5.2" if provider == "openai" else "claude-sonnet-4-20250514")

    def analyze(
        self,
        context_bundle: dict,
        current_price: Optional[float] = None,
        data_gap_flags: Optional[List[str]] = None,
        reliability_grade: Optional[str] = None,
        sector_template: Optional[dict] = None,
        domain_notes: Optional[str] = None,
        retry: bool = True,
    ) -> AIAnalysisResult:
        """
        Run single enriched LLM call for one ticker.

        Args:
            context_bundle: The full context JSON from ai_context_cache
            current_price: Latest stock price (for validation)
            data_gap_flags: From stock_scores (for validation)
            reliability_grade: From stock_scores (for validation)
            sector_template: From sector_templates table
            domain_notes: From stock_notes table
            retry: If True, retry once on validation failure

        Returns:
            AIAnalysisResult
        """
        ticker = context_bundle.get("ticker", "UNKNOWN")
        start = time.time()

        # Build macro context from bundle or load fresh
        macro = context_bundle.get("macro_context")

        # Build prompt
        user_prompt = build_user_prompt(
            context_json=context_bundle,
            sector_template=sector_template,
            macro_context=macro,
            domain_notes=domain_notes,
        )

        # Call LLM
        try:
            response = self.llm.chat(SYSTEM_PROMPT, user_prompt)
        except Exception as e:
            logger.error("LLM call failed for %s: %s", ticker, e, exc_info=True)
            return AIAnalysisResult(
                ticker=ticker, success=False,
                error=f"LLM call failed: {str(e)}"
            )

        # Parse JSON
        try:
            # Strip markdown code fences if present
            content = response.content.strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[1] if "\n" in content else content[3:]
                if content.endswith("```"):
                    content = content[:-3]
                content = content.strip()

            output = json.loads(content)
        except json.JSONDecodeError as e:
            logger.error("JSON parse failed for %s: %s", ticker, e)
            return AIAnalysisResult(
                ticker=ticker, success=False,
                error=f"JSON parse failed: {str(e)}",
                prompt_tokens=response.prompt_tokens,
                output_tokens=response.output_tokens,
            )

        # Validate
        validation_errors = validate_output(
            output,
            current_price=current_price,
            data_gap_flags=data_gap_flags,
            reliability_grade=reliability_grade,
        )

        if validation_errors:
            logger.warning("Validation errors for %s: %s", ticker, validation_errors)
            if retry:
                logger.info("Retrying %s...", ticker)
                return self.analyze(
                    context_bundle, current_price, data_gap_flags,
                    reliability_grade, sector_template, domain_notes,
                    retry=False,
                )
            return AIAnalysisResult(
                ticker=ticker, success=False,
                error=f"Validation failed: {validation_errors}",
                prompt_tokens=response.prompt_tokens,
                output_tokens=response.output_tokens,
            )

        # Estimate cost based on OpenAI pricing (short context <272K tokens)
        # Our prompts are ~6K tokens — always short context
        PRICING = {
            # model: (input $/M, output $/M)
            "gpt-5.4":      (2.50, 15.00),
            "gpt-5.4-mini": (0.75, 4.50),
            "gpt-5.4-nano": (0.20, 1.25),
            "gpt-5.4-pro":  (30.00, 180.00),
            "gpt-5.2":      (2.50, 15.00),  # assume similar to gpt-5.4
            "gpt-4o":       (2.50, 10.00),
            "gpt-4o-mini":  (0.15, 0.60),
        }
        model_key = self.model_name.lower()
        input_rate, output_rate = PRICING.get(model_key, (2.50, 15.00))  # default to flagship
        prompt_cost = response.prompt_tokens * input_rate / 1_000_000
        output_cost = response.output_tokens * output_rate / 1_000_000
        cost = prompt_cost + output_cost

        duration = time.time() - start
        logger.info(
            "%s analysis complete: verdict=%s confidence=%s cost=$%.4f (%.1fs)",
            ticker, output.get("analyst_verdict"), output.get("confidence_level"),
            cost, duration,
        )

        return AIAnalysisResult(
            ticker=ticker,
            success=True,
            lynch_category=output.get("lynch_category"),
            lynch_rationale=output.get("lynch_rationale"),
            buffett_moat=output.get("buffett_moat"),
            buffett_moat_source=output.get("buffett_moat_source"),
            business_narrative=output.get("business_narrative"),
            financial_health_signal=output.get("financial_health_signal"),
            analyst_verdict=output.get("analyst_verdict"),
            confidence_level=output.get("confidence_level"),
            bull_case=output.get("bull_case"),
            bear_case=output.get("bear_case"),
            neutral_case=output.get("neutral_case"),
            strategy_fit=output.get("strategy_fit"),
            what_to_watch=output.get("what_to_watch"),
            caveats=output.get("caveats"),
            data_gaps_acknowledged=output.get("data_gaps_acknowledged"),
            prompt_tokens=response.prompt_tokens,
            output_tokens=response.output_tokens,
            cost_usd_estimate=cost,
        )

    def analyze_batch(
        self,
        bundles: List[dict],
        delay_between: float = 2.0,
        **kwargs,
    ) -> List[AIAnalysisResult]:
        """Batch analysis with rate limiting."""
        results = []
        for i, bundle in enumerate(bundles):
            result = self.analyze(bundle, **kwargs)
            results.append(result)
            if i < len(bundles) - 1:
                time.sleep(delay_between)
        return results
