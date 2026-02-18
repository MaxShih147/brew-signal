"""Tests for MAL title matching logic.

Validates that _is_title_match correctly accepts related anime
and rejects unrelated ones (e.g. the 芙莉蓮 → Love Live false positive).
"""
import pytest

from app.services.mal_sync_service import _is_title_match


# --- Helper: build a minimal Jikan-style anime dict ---

def _anime(title: str, title_en: str | None = None, title_jp: str | None = None, extra_titles: list[str] | None = None) -> dict:
    d: dict = {"title": title}
    if title_en:
        d["title_english"] = title_en
    if title_jp:
        d["title_japanese"] = title_jp
    if extra_titles:
        d["titles"] = [{"type": "Synonym", "title": t} for t in extra_titles]
    return d


# --- True positives: should match ---

class TestTruePositives:
    def test_romaji_substring(self):
        """'Frieren' matches 'Sousou no Frieren'."""
        anime = _anime("Sousou no Frieren", title_en="Frieren: Beyond Journey's End", title_jp="葬送のフリーレン")
        assert _is_title_match("Frieren", anime)

    def test_japanese_exact(self):
        """Full Japanese title matches itself."""
        anime = _anime("Sousou no Frieren", title_jp="葬送のフリーレン")
        assert _is_title_match("葬送のフリーレン", anime)

    def test_english_title(self):
        """English title substring match."""
        anime = _anime("Sousou no Frieren", title_en="Frieren: Beyond Journey's End")
        assert _is_title_match("Frieren: Beyond Journey's End", anime)

    def test_chiikawa_romaji(self):
        anime = _anime("Chiikawa", title_jp="ちいかわ")
        assert _is_title_match("Chiikawa", anime)

    def test_chiikawa_japanese(self):
        anime = _anime("Chiikawa", title_jp="ちいかわ")
        assert _is_title_match("ちいかわ", anime)

    def test_case_insensitive(self):
        anime = _anime("SPY×FAMILY", title_en="SPY x FAMILY")
        assert _is_title_match("spy×family", anime)

    def test_title_in_search_term(self):
        """Search term is longer than the title (title is substring of term)."""
        anime = _anime("Frieren")
        assert _is_title_match("Sousou no Frieren Season 2", anime)

    def test_extra_titles_synonym(self):
        """Match via the titles[] array."""
        anime = _anime("Sousou no Frieren", extra_titles=["Frieren", "Frieren - Beyond Journey's End"])
        assert _is_title_match("Frieren", anime)


# --- True negatives: should NOT match ---

class TestTrueNegatives:
    def test_fulilian_vs_love_live(self):
        """芙莉蓮 must NOT match Love Live's 蓮ノ空 (the original bug)."""
        anime = _anime(
            "Love Live! Hasunosora Jogakuin School Idol Club Movie: Bloom Garden Party",
            title_jp="映画 ラブライブ！蓮ノ空女学院スクールアイドルクラブ Bloom Garden Party",
        )
        assert not _is_title_match("芙莉蓮", anime)

    def test_fulilian_vs_namu_amida(self):
        """芙莉蓮 must NOT match 蓮台 UTENA."""
        anime = _anime("Namu Amida Butsu! Rendai Utena", title_jp="なむあみだ仏っ! -蓮台 UTENA-")
        assert not _is_title_match("芙莉蓮", anime)

    def test_completely_unrelated(self):
        anime = _anime("Naruto", title_jp="ナルト")
        assert not _is_title_match("Chiikawa", anime)

    def test_single_char_overlap(self):
        """Single shared character should not cause a match."""
        anime = _anime("Ren", title_jp="蓮")
        assert not _is_title_match("蓮華", anime)

    def test_empty_search_term(self):
        anime = _anime("Anything")
        assert not _is_title_match("", anime)

    def test_empty_titles(self):
        assert not _is_title_match("Frieren", {})
