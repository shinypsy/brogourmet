"""MyG `menu_lines` 첫 줄 파싱 — 프론트 `parseMenuLine`과 동일 규칙(가격 상한만 완화)."""

from __future__ import annotations

import re
from typing import NamedTuple

_PRICE_MAX = 2_147_483_647


class ParsedMain(NamedTuple):
    name: str
    price_krw: int


def _parse_price_part(raw: str) -> int | None:
    cleaned = re.sub(r"[,，\s]", "", raw)
    cleaned = re.sub(r"원", "", cleaned, flags=re.IGNORECASE)
    m = re.search(r"(\d+)", cleaned)
    if not m:
        return None
    n = int(m.group(1))
    if n < 0 or n > _PRICE_MAX:
        return None
    return n


def parse_menu_line(line: str) -> ParsedMain | None:
    t = line.strip()
    if not t:
        return None
    colon = re.match(r"^(.+?)\s*[:：∶]\s*(.+)$", t)
    if colon:
        name = colon.group(1).strip()
        price = _parse_price_part(colon.group(2))
        if not name or price is None:
            return None
        return ParsedMain(name, price)
    tail = re.match(r"^(.+?)\s+([\d][\d,]*)\s*(?:원)?\s*$", t, re.IGNORECASE)
    if tail:
        name = tail.group(1).strip()
        price = _parse_price_part(tail.group(2))
        if not name or price is None:
            return None
        return ParsedMain(name, price)
    return None


def parse_menu_lines_first_main(text: str) -> ParsedMain | None:
    for raw in text.splitlines():
        row = parse_menu_line(raw)
        if row:
            return row
    return None
