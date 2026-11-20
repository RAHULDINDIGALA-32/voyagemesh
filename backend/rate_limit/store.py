from __future__ import annotations

from datetime import UTC, datetime, timedelta

from config import get_settings
from rate_limit.limits import RateLimitError


def seconds_until_midnight() -> int:
    now = datetime.now(UTC)
    tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return max(1, int((tomorrow - now).total_seconds()))


async def reserve_workflow(repository, user_id: str) -> None:
    settings = get_settings()
    if not settings.rate_limit_enabled:
        return
    await repository.cleanup_stale_workflows(settings.workflow_running_ttl_seconds, settings.hitl_expiry_hours)
    await repository.reserve_workflow(
        user_id,
        max_active=settings.max_active_workflows_per_user,
        daily_limit=settings.max_workflows_per_user_per_day,
        running_ttl_seconds=settings.workflow_running_ttl_seconds,
    )

