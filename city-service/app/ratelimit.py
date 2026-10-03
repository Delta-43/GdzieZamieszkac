"""A token bucket in memory. Behind the tailnet proxy all clients share one address, so each endpoint has one shared bucket."""
from __future__ import annotations

import time
from collections.abc import Callable


class Bucket:
    def __init__(self, per_minute: int, clock: Callable[[], float] = time.monotonic):
        self.rate, self.capacity, self.clock = per_minute / 60.0, float(per_minute), clock
        self.tokens, self.last = float(per_minute), clock()

    def check(self) -> float | None:
        """None if the request may pass, else the seconds to wait."""
        if self.capacity <= 0:
            return None
        now = self.clock()
        self.tokens = min(self.capacity, self.tokens + (now - self.last) * self.rate)
        self.last = now
        if self.tokens >= 1:
            self.tokens -= 1
            return None
        return (1 - self.tokens) / self.rate
