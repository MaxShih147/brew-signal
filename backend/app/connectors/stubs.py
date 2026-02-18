"""
Connector stubs for future data sources.
Each returns a neutral ConnectorResult when not yet wired to a real API.
Drop-in replacement: implement fetch() to return real data.
"""
from dataclasses import dataclass


@dataclass
class ConnectorResult:
    status: str  # "LIVE" | "MISSING"
    score_0_100: float


class ShopeeConnector:
    async def fetch(self, ip_name: str) -> ConnectorResult:
        return ConnectorResult(status="MISSING", score_0_100=50)


class AmazonConnector:
    async def fetch(self, ip_name: str) -> ConnectorResult:
        return ConnectorResult(status="MISSING", score_0_100=50)


class NewsCollabConnector:
    async def fetch(self, ip_name: str) -> ConnectorResult:
        return ConnectorResult(status="MISSING", score_0_100=50)


class YouTubeConnector:
    async def fetch(self, ip_name: str) -> ConnectorResult:
        return ConnectorResult(status="MISSING", score_0_100=50)


class BahamutConnector:
    async def fetch(self, ip_name: str) -> ConnectorResult:
        return ConnectorResult(status="MISSING", score_0_100=50)


class PublisherProfileConnector:
    async def fetch(self, ip_name: str) -> ConnectorResult:
        return ConnectorResult(status="MISSING", score_0_100=50)


class StreamingConnector:
    async def fetch(self, ip_name: str) -> ConnectorResult:
        return ConnectorResult(status="MISSING", score_0_100=50)
