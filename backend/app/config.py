from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://brewsignal:brewsignal_dev@localhost:5432/brewsignal"

    # Google Trends Official API
    google_trends_api_key: str = ""
    google_trends_project_id: str = ""

    # Collector
    collector_source: str = "pytrends"  # "official" | "pytrends"
    pytrends_request_interval_sec: float = 5.0
    pytrends_max_retries: int = 3
    pytrends_circuit_breaker_threshold: int = 5
    pytrends_circuit_breaker_cooldown_sec: int = 1800

    # Signal thresholds
    signal_wow_growth_threshold: float = 0.30
    signal_acceleration_weeks: int = 2
    signal_breakout_percentile: int = 85
    signal_lead_time_weeks: int = 12

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
