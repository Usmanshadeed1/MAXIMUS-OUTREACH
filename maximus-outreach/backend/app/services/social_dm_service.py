"""Service: Social Media DM Queue — queue outbound DMs for manual/agent sending."""
import uuid
from urllib.parse import urlparse

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.outreach import SocialDmQueue

# ---------------------------------------------------------------------------
# Platform detection
# ---------------------------------------------------------------------------

_PLATFORM_DOMAINS: list[tuple[str, str]] = [
    ("linkedin.com", "linkedin"),
    ("instagram.com", "instagram"),
    ("facebook.com", "facebook"),
    ("fb.com", "facebook"),
    ("twitter.com", "twitter"),
    ("x.com", "twitter"),
    ("tiktok.com", "tiktok"),
    ("youtube.com", "youtube"),
    ("pinterest.com", "pinterest"),
    ("snapchat.com", "snapchat"),
    ("reddit.com", "reddit"),
    ("threads.net", "threads"),
    ("whatsapp.com", "whatsapp"),
    ("t.me", "telegram"),
    ("telegram.me", "telegram"),
]


def detect_platform(profile_url: str) -> str:
    """
    Infer the social platform from `profile_url`.

    Checks if any known domain appears in the URL host.
    Returns the platform slug (e.g. 'linkedin') or 'other' if not recognised.
    """
    try:
        host = urlparse(profile_url).netloc.lower()
        # Strip www. prefix
        if host.startswith("www."):
            host = host[4:]
        for domain, platform in _PLATFORM_DOMAINS:
            if host == domain or host.endswith("." + domain):
                return platform
    except Exception:
        pass
    return "other"


# ---------------------------------------------------------------------------
# Core service functions
# ---------------------------------------------------------------------------

async def queue_social_dm(
    lead_id: uuid.UUID | None,
    client_id: uuid.UUID | None,
    message: str,
    profile_url: str,
    db: AsyncSession,
    *,
    platform: str | None = None,
    outreach_log_id: uuid.UUID | None = None,
    scheduled_for=None,
) -> SocialDmQueue:
    """
    Create a SocialDmQueue entry with status='pending'.

    If `platform` is not provided, it is auto-detected from `profile_url`.
    """
    resolved_platform = platform if platform else detect_platform(profile_url)

    dm = SocialDmQueue(
        lead_id=lead_id,
        client_id=client_id,
        outreach_log_id=outreach_log_id,
        platform=resolved_platform,
        profile_url=profile_url,
        message_content=message,
        status="pending",
        scheduled_for=scheduled_for,
    )
    db.add(dm)
    await db.flush()
    return dm


async def get_dm_by_id(dm_id: uuid.UUID, db: AsyncSession) -> SocialDmQueue | None:
    result = await db.execute(
        select(SocialDmQueue).where(SocialDmQueue.id == dm_id)
    )
    return result.scalar_one_or_none()
