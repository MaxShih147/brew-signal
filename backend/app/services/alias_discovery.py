"""Auto-discover aliases for an IP using Claude API.

Given an IP name (e.g. "膽大黨"), discovers all known aliases across
languages (zh-TW, zh-CN, ja, en, ko, etc.), including:
- Official translated titles
- Common abbreviations / nicknames
- Romanizations
- Hashtag variants popular on social media
"""
import json
import logging
from typing import Optional

import anthropic

from app.config import settings

logger = logging.getLogger(__name__)

DISCOVERY_PROMPT = """\
You are an expert on anime, manga, games, and character IPs across Asian and global markets.

Given the IP name below, find ALL known aliases that people would search for on Google Trends.
Focus on names that have meaningful search volume.

IP Name: {ip_name}

Return a JSON array of objects. Each object must have:
- "alias": the search term (string)
- "locale": language code — use "zh" for Traditional Chinese (TW), "zh-CN" for Simplified Chinese, "jp" for Japanese, "en" for English, "ko" for Korean, "other" for anything else
- "weight": suggested weight 0.5–1.5 based on how commonly this alias is searched (1.0 = standard, 1.2+ = very popular variant, 0.5–0.8 = niche)
- "note": brief explanation of what this alias is (e.g. "official JP title", "TW fan abbreviation", "English subtitle")

Rules:
- Include the original input name as one of the aliases
- Include official titles in Japanese, English, Traditional Chinese (TW market), Simplified Chinese
- Include common fan abbreviations (e.g. "鬼滅" for "鬼滅之刃")
- Include romanized versions if commonly searched (e.g. "Kimetsu no Yaiba")
- Do NOT include overly generic terms that would pollute trend data
- Do NOT include character names (just the IP/series name)
- Aim for 5–15 high-quality aliases
- Return ONLY the JSON array, no markdown fencing, no extra text
"""


async def discover_aliases(ip_name: str) -> list[dict]:
    """Call Claude to discover aliases for an IP name.

    Returns list of {"alias", "locale", "weight", "note"} dicts.
    """
    if not settings.anthropic_api_key:
        raise ValueError("ANTHROPIC_API_KEY not configured. Set it in .env to use alias discovery.")

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    prompt = DISCOVERY_PROMPT.format(ip_name=ip_name)

    logger.info(f"Discovering aliases for IP: {ip_name}")

    message = await client.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()

    # Parse JSON — handle possible markdown fencing
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1]
        raw = raw.rsplit("```", 1)[0]

    try:
        aliases = json.loads(raw)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Claude response as JSON: {e}\nRaw: {raw}")
        raise ValueError(f"Failed to parse alias discovery response: {e}")

    if not isinstance(aliases, list):
        raise ValueError("Expected a JSON array from alias discovery")

    # Validate and clean
    cleaned = []
    for item in aliases:
        if not isinstance(item, dict) or "alias" not in item:
            continue
        cleaned.append({
            "alias": str(item["alias"]).strip(),
            "locale": str(item.get("locale", "other")).strip(),
            "weight": float(item.get("weight", 1.0)),
            "note": str(item.get("note", "")),
        })

    logger.info(f"Discovered {len(cleaned)} aliases for '{ip_name}'")
    return cleaned
