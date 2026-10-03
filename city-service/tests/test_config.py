import pytest

from app.config import load_settings


def test_key_comes_from_the_environment_only_by_name():
    s = load_settings({"OPENROUTER_LLM_KEY": "abc"})
    assert s.openrouter_key == "abc" and s.model == "z-ai/glm-5.3-flash"
    assert load_settings({}).openrouter_key == ""


def test_production_needs_explicit_origins():
    with pytest.raises(RuntimeError):
        load_settings({"ENVIRONMENT": "production"})
    with pytest.raises(RuntimeError):
        load_settings({"ENVIRONMENT": "production", "CITY_SERVICE_CORS_ORIGINS": "*"})
    assert load_settings({"ENVIRONMENT": "production", "CITY_SERVICE_CORS_ORIGINS": "https://a.example"}).feedback_db_path == "/data/feedback.sqlite"
