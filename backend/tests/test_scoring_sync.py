from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_scoring_copy_is_identical_to_the_data_pipeline():
    """The backend carries a copy of data/sources/derived/scoring.py so it deploys alone. The two must not drift, or /recommend would
    stop reproducing the stored livability_score_default. Change both files together."""
    backend = (ROOT / "backend/app/core/scoring.py").read_bytes()
    data = (ROOT / "data/sources/derived/scoring.py").read_bytes()
    assert backend == data
