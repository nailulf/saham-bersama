import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scrapers.idx_calendar import _classify_event, _parse_row


class TestClassify:
    def _row(self, desc="", jenis=""):
        return {"description": desc, "Jenis": jenis, "Step": ""}

    def test_public_expose(self):
        assert _classify_event(self._row(desc="Jadwal Public Expose BBRI")) == "public_expose"

    def test_dividend(self):
        assert _classify_event(self._row(desc="tanggal cum Dividen Tunai PT X")) == "dividend"

    def test_rups(self):
        assert _classify_event(self._row(desc="Pemberitahuan RUPS Rencana PT X")) == "rups"

    def test_bond_by_jenis(self):
        assert _classify_event(self._row(jenis="obligasiJatuhTempo")) == "bond"

    def test_ipo_by_jenis(self):
        assert _classify_event(self._row(jenis="pencatatanAwal")) == "ipo"

    def test_other(self):
        assert _classify_event(self._row(desc="Laporan Pembelian Kembali Saham")) == "other"


class TestParseRow:
    def _raw(self, **over):
        base = {
            "id": 200528, "title": "mtel",
            "description": "Pemberitahuan RUPS Rencana PT Dayamitra Telekomunikasi Tbk",
            "Jenis": "Rencana", "Step": "rencana",
            "start": "2026-06-30T00:00:00",
            "TglWaktuRups": "2026-06-30T14:00:00",
            "TglWaktuPE": "1911-01-01T00:00:00",
            "location": "Jakarta",
        }
        base.update(over)
        return base

    def test_basic_fields(self):
        row = _parse_row(self._raw())
        assert row["idx_id"] == 200528
        assert row["ticker"] == "MTEL"          # uppercased
        assert row["event_date"] == "2026-06-30"
        assert row["event_type"] == "rups"
        assert row["title"].startswith("Pemberitahuan RUPS")

    def test_rups_at_parsed_pe_null(self):
        row = _parse_row(self._raw())
        assert row["rups_at"] == "2026-06-30T14:00:00"
        assert row["pe_at"] is None              # 1911 sentinel → null

    def test_invalid_row_returns_none(self):
        assert _parse_row({"id": 1, "title": "", "start": ""}) is None