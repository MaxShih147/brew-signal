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

    # YouTube Data API v3
    youtube_api_key: str = ""
    youtube_max_results: int = 10
    youtube_recency_days: int = 90

    # Anthropic Claude API (for alias discovery)
    anthropic_api_key: str = ""

    # Signal thresholds
    signal_wow_growth_threshold: float = 0.30
    signal_acceleration_weeks: int = 2
    signal_breakout_percentile: int = 85
    signal_lead_time_weeks: int = 12

    # Opportunity scoring weights — tunable without code changes
    opp_weight_demand: float = 0.30
    opp_weight_diffusion: float = 0.20
    opp_weight_fit: float = 0.15
    opp_risk_weight_supply: float = 0.25
    opp_risk_weight_gatekeeper: float = 0.10
    opp_scaling_factor: float = 1.35
    opp_timing_low: float = 0.8
    opp_timing_high: float = 0.4

    # BD Allocation weights
    bd_weight_timing: float = 0.35
    bd_weight_demand: float = 0.30
    bd_weight_market_gap: float = 0.20
    bd_weight_feasibility: float = 0.15
    bd_fit_gate_threshold: float = 30.0
    bd_start_threshold: float = 70.0
    bd_monitor_threshold: float = 40.0
    bd_gatekeeper_urgency_factor: float = 0.3
    bd_base_lead_weeks: int = 12

    # Source staleness thresholds (hours) — per source: [fresh_limit, warn_limit]
    # Beyond warn_limit = down. Format: source_key: [fresh_h, warn_h]
    staleness_google_trends_fresh_h: int = 72     # 3d
    staleness_google_trends_warn_h: int = 168     # 7d
    staleness_youtube_fresh_h: int = 72
    staleness_youtube_warn_h: int = 168
    staleness_news_rss_fresh_h: int = 24
    staleness_news_rss_warn_h: int = 72
    staleness_shopee_fresh_h: int = 72
    staleness_shopee_warn_h: int = 168
    staleness_wiki_mal_fresh_h: int = 720         # 30d
    staleness_wiki_mal_warn_h: int = 2160         # 90d
    staleness_amazon_jp_fresh_h: int = 72
    staleness_amazon_jp_warn_h: int = 168

    # Confidence weights
    confidence_indicator_weight: float = 0.6
    confidence_source_weight: float = 0.4
    confidence_key_source_down_penalty: int = 20
    confidence_key_source_warn_penalty: int = 10
    confidence_key_indicator_missing_penalty: int = 10
    confidence_key_indicator_penalty_cap: int = 30

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
