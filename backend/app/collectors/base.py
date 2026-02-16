from __future__ import annotations

import abc
from dataclasses import dataclass, field
from datetime import date


@dataclass
class TrendDataPoint:
    date: date
    value: int


@dataclass
class CollectResult:
    success: bool
    points: list[TrendDataPoint] = field(default_factory=list)
    http_code: int | None = None
    error_code: str | None = None
    message: str | None = None


class BaseTrendCollector(abc.ABC):
    @abc.abstractmethod
    async def fetch(self, keyword: str, geo: str, timeframe_str: str) -> CollectResult:
        ...
