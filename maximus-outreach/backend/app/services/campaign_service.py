"""Campaign CRUD service (execution logic added in 11.4)."""
import uuid
from datetime import datetime

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.campaign import Campaign, CampaignEnrollment, CampaignStep
from app.models.lead import Lead
from app.schemas.campaign import (
    CampaignCreate,
    CampaignStats,
    CampaignStepCreate,
    CampaignStepUpdate,
    CampaignUpdate,
    EnrollLeadsRequest,
    EnrollLeadsResponse,
)


# ---------------------------------------------------------------------------
# Campaign CRUD
# ---------------------------------------------------------------------------

async def get_campaign(campaign_id: uuid.UUID, db: AsyncSession) -> Campaign | None:
    result = await db.execute(
        select(Campaign)
        .where(Campaign.id == campaign_id)
        .options(selectinload(Campaign.steps).selectinload(CampaignStep.media))
    )
    return result.scalar_one_or_none()


async def get_campaigns_for_client(
    client_id: uuid.UUID,
    db: AsyncSession,
    page: int = 1,
    page_size: int = 25,
) -> tuple[list[Campaign], int]:
    count_q = select(func.count()).select_from(Campaign).where(Campaign.client_id == client_id)
    items_q = (
        select(Campaign)
        .where(Campaign.client_id == client_id)
        .options(selectinload(Campaign.steps).selectinload(CampaignStep.media))
        .order_by(Campaign.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    total = (await db.execute(count_q)).scalar_one()
    campaigns = (await db.execute(items_q)).scalars().all()
    return list(campaigns), total


async def create_campaign(client_id: uuid.UUID, data: CampaignCreate, db: AsyncSession) -> Campaign:
    campaign = Campaign(
        client_id=client_id,
        name=data.name,
        description=data.description,
        stop_on_reply=data.stop_on_reply,
        max_attempts=data.max_attempts,
        repeat_delay_days=data.repeat_delay_days,
        pacing_mode=data.pacing_mode,
        pacing_leads_per_day=data.pacing_leads_per_day,
        send_window_start=data.send_window_start,
        send_window_end=data.send_window_end,
        send_timezone=data.send_timezone,
    )
    db.add(campaign)
    await db.flush()

    for step_data in data.steps:
        step = CampaignStep(
            campaign_id=campaign.id,
            step_order=step_data.step_order,
            channel=step_data.channel,
            delay_days=step_data.delay_days,
            delay_hours=step_data.delay_hours,
            message_template=step_data.message_template,
            use_ai_generation=step_data.use_ai_generation,
            ai_prompt_override=step_data.ai_prompt_override,
            subject_template=step_data.subject_template,
        )
        db.add(step)

    await db.commit()
    return await get_campaign(campaign.id, db)


async def update_campaign(campaign: Campaign, data: CampaignUpdate, db: AsyncSession) -> Campaign:
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(campaign, field, value)
    await db.commit()
    return await get_campaign(campaign.id, db)


async def delete_campaign(campaign: Campaign, db: AsyncSession) -> None:
    await db.delete(campaign)
    await db.commit()


# ---------------------------------------------------------------------------
# Step CRUD
# ---------------------------------------------------------------------------

async def get_step(step_id: uuid.UUID, db: AsyncSession) -> CampaignStep | None:
    result = await db.execute(
        select(CampaignStep)
        .where(CampaignStep.id == step_id)
        .options(selectinload(CampaignStep.media))
    )
    return result.scalar_one_or_none()


async def add_step(campaign_id: uuid.UUID, data: CampaignStepCreate, db: AsyncSession) -> CampaignStep:
    step = CampaignStep(
        campaign_id=campaign_id,
        step_order=data.step_order,
        channel=data.channel,
        delay_days=data.delay_days,
        delay_hours=data.delay_hours,
        message_template=data.message_template,
        use_ai_generation=data.use_ai_generation,
        ai_prompt_override=data.ai_prompt_override,
        subject_template=data.subject_template,
    )
    db.add(step)
    await db.commit()
    return await get_step(step.id, db)


async def update_step(step: CampaignStep, data: CampaignStepUpdate, db: AsyncSession) -> CampaignStep:
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(step, field, value)
    await db.commit()
    return await get_step(step.id, db)


async def delete_step(step: CampaignStep, db: AsyncSession) -> None:
    await db.delete(step)
    await db.commit()


# ---------------------------------------------------------------------------
# Enrollment
# ---------------------------------------------------------------------------

async def enroll_leads(
    campaign_id: uuid.UUID,
    data: EnrollLeadsRequest,
    db: AsyncSession,
) -> EnrollLeadsResponse:
    enrolled = 0
    skipped_already = 0
    skipped_not_found = 0

    campaign_result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = campaign_result.scalar_one_or_none()
    if not campaign:
        return EnrollLeadsResponse(enrolled=0, skipped_already_enrolled=0, skipped_not_found=0)

    # Resolve lead IDs from explicit list or status filter
    if data.lead_ids:
        lead_ids = list(data.lead_ids)
    elif data.filter_status:
        result = await db.execute(
            select(Lead.id).where(
                Lead.client_id == campaign.client_id,
                Lead.status == data.filter_status,
            )
        )
        lead_ids = [row[0] for row in result.fetchall()]
    else:
        return EnrollLeadsResponse(enrolled=0, skipped_already_enrolled=0, skipped_not_found=0)

    # Active enrollments (not finished/opted-out) — skip re-enrolling
    existing_result = await db.execute(
        select(CampaignEnrollment.lead_id).where(
            CampaignEnrollment.campaign_id == campaign_id,
            CampaignEnrollment.status.notin_(["completed", "opted_out"]),
        )
    )
    already_enrolled = {row[0] for row in existing_result.fetchall()}

    for lead_id in lead_ids:
        lead_result = await db.execute(
            select(Lead).where(Lead.id == lead_id, Lead.client_id == campaign.client_id)
        )
        lead = lead_result.scalar_one_or_none()
        if lead is None:
            skipped_not_found += 1
            continue
        if lead_id in already_enrolled:
            skipped_already += 1
            continue
        db.add(CampaignEnrollment(campaign_id=campaign_id, lead_id=lead_id, status="queued"))
        enrolled += 1

    if enrolled > 0:
        campaign.total_enrolled = (campaign.total_enrolled or 0) + enrolled
        await db.commit()

    return EnrollLeadsResponse(
        enrolled=enrolled,
        skipped_already_enrolled=skipped_already,
        skipped_not_found=skipped_not_found,
    )


# ---------------------------------------------------------------------------
# Campaign lifecycle
# ---------------------------------------------------------------------------

async def start_campaign(campaign: Campaign, db: AsyncSession) -> Campaign:
    campaign.status = "active"
    if campaign.pacing_mode == "all_at_once":
        now = datetime.utcnow()
        await db.execute(
            update(CampaignEnrollment)
            .where(
                CampaignEnrollment.campaign_id == campaign.id,
                CampaignEnrollment.status == "queued",
            )
            .values(status="active", activated_at=now)
        )
        count_result = await db.execute(
            select(func.count()).select_from(CampaignEnrollment).where(
                CampaignEnrollment.campaign_id == campaign.id,
                CampaignEnrollment.status == "active",
            )
        )
        campaign.total_activated = count_result.scalar_one()
    await db.commit()
    return await get_campaign(campaign.id, db)


async def pause_campaign(campaign: Campaign, db: AsyncSession) -> Campaign:
    campaign.status = "paused"
    await db.commit()
    return await get_campaign(campaign.id, db)


async def resume_campaign(campaign: Campaign, db: AsyncSession) -> Campaign:
    campaign.status = "active"
    await db.commit()
    return await get_campaign(campaign.id, db)


# ---------------------------------------------------------------------------
# Stats & pacing
# ---------------------------------------------------------------------------

async def get_campaign_stats(campaign_id: uuid.UUID, db: AsyncSession) -> CampaignStats:
    result = await db.execute(
        select(CampaignEnrollment.status, func.count())
        .where(CampaignEnrollment.campaign_id == campaign_id)
        .group_by(CampaignEnrollment.status)
    )
    counts = {row[0]: row[1] for row in result.fetchall()}
    return CampaignStats(
        total_enrolled=sum(counts.values()),
        total_activated=counts.get("active", 0),
        total_queued=counts.get("queued", 0),
        total_completed=counts.get("completed", 0),
        total_replied=counts.get("replied", 0),
    )


async def get_pacing_status(campaign: Campaign, db: AsyncSession) -> dict:
    stats = await get_campaign_stats(campaign.id, db)
    config = campaign.pacing_leads_per_day or {}
    remaining = stats.total_queued
    estimated_weeks: float | None = None

    if remaining > 0:
        daily = 0
        if campaign.pacing_mode == "fixed_daily":
            daily = config.get("daily", 0)
        elif campaign.pacing_mode == "gradual_rampup":
            daily = config.get("week4_plus", config.get("week1", 0))
        elif campaign.pacing_mode == "all_at_once":
            daily = remaining
        if daily > 0:
            estimated_weeks = round(remaining / (daily * 7), 1)

    return {
        "campaign_id": campaign.id,
        "campaign_name": campaign.name,
        "pacing_mode": campaign.pacing_mode,
        "total_enrolled": stats.total_enrolled,
        "total_activated": stats.total_activated,
        "total_queued": stats.total_queued,
        "leads_per_day_config": config,
        "estimated_weeks_remaining": estimated_weeks,
    }


# ---------------------------------------------------------------------------
# 11.4 — Campaign Execution
# ---------------------------------------------------------------------------

async def execute_campaign(campaign_id: uuid.UUID, db: AsyncSession) -> int:
    """
    Process active enrollments: for each step that is now due and not yet dispatched,
    create an OutreachLog entry (status=queued).  Social DM also gets a SocialDmQueue row.
    Returns number of outreach entries created.
    """
    from app.models.outreach import OutreachLog, SocialDmQueue  # avoid circular at module level

    campaign = await get_campaign(campaign_id, db)
    if not campaign or campaign.status != "active":
        return 0

    steps = sorted(campaign.steps, key=lambda s: s.step_order)
    if not steps:
        return 0

    # Load active enrollments with leads
    enroll_result = await db.execute(
        select(CampaignEnrollment)
        .where(
            CampaignEnrollment.campaign_id == campaign_id,
            CampaignEnrollment.status == "active",
        )
        .options(selectinload(CampaignEnrollment.lead))
    )
    enrollments = enroll_result.scalars().all()

    now = datetime.utcnow()
    created = 0

    for enrollment in enrollments:
        lead = enrollment.lead
        if not lead:
            continue

        # stop_on_reply: close out this enrollment
        if campaign.stop_on_reply and lead.status == "replied":
            enrollment.status = "completed"
            enrollment.completed_at = now
            continue

        # Already-dispatched step IDs for this enrollment
        existing_result = await db.execute(
            select(OutreachLog.step_id).where(OutreachLog.enrollment_id == enrollment.id)
        )
        dispatched_step_ids = {row[0] for row in existing_result.fetchall()}

        ref_time = enrollment.activated_at or enrollment.enrolled_at

        for step in steps:
            from datetime import timedelta
            due_at = ref_time + timedelta(days=step.delay_days, hours=step.delay_hours)
            if now < due_at:
                continue  # not yet due — steps are ordered so we can keep checking (non-sequential delays)
            if step.id in dispatched_step_ids:
                continue  # already dispatched

            # Skip if lead missing channel contact data
            if not _lead_has_channel_data(lead, step.channel):
                continue

            message = _render_template(step.message_template, lead) if step.message_template else None
            subject = _render_template(step.subject_template, lead) if step.subject_template else None

            log = OutreachLog(
                enrollment_id=enrollment.id,
                step_id=step.id,
                lead_id=lead.id,
                channel=step.channel,
                status="queued",
                message_content=message,
                subject=subject,
                scheduled_at=due_at,
            )

            if step.channel == "social_dm":
                platform = _detect_social_platform(lead)
                profile_url = _get_social_profile(lead) or ""
                log.social_platform = platform
                log.social_profile_url = profile_url
                db.add(log)
                await db.flush()
                db.add(SocialDmQueue(
                    outreach_log_id=log.id,
                    lead_id=lead.id,
                    client_id=campaign.client_id,
                    platform=platform,
                    profile_url=profile_url,
                    message_content=message or f"Hi {lead.business_name or 'there'}",
                    status="pending",
                    scheduled_for=due_at,
                ))
            else:
                db.add(log)

            created += 1

        # Mark enrollment completed if last step's due time has passed
        last_step = steps[-1]
        from datetime import timedelta as td
        last_due = ref_time + td(days=last_step.delay_days, hours=last_step.delay_hours)
        if now >= last_due:
            enrollment.status = "completed"
            enrollment.completed_at = now

    if enrollments:
        await db.commit()

    return created


# ---------------------------------------------------------------------------
# Execution helpers
# ---------------------------------------------------------------------------

def _lead_has_channel_data(lead: Lead, channel: str) -> bool:
    if channel == "email":
        return bool(lead.email)
    if channel in ("sms", "mms", "whatsapp"):
        return bool(lead.phone)
    if channel == "social_dm":
        return bool(lead.facebook or lead.instagram or lead.linkedin or lead.twitter or lead.tiktok)
    return False


def _render_template(template: str, lead: Lead) -> str:
    return (
        template
        .replace("{business_name}", lead.business_name or "")
        .replace("{phone}", lead.phone or "")
        .replace("{email}", lead.email or "")
        .replace("{address}", lead.address or "")
    )


def _get_social_profile(lead: Lead) -> str | None:
    return lead.instagram or lead.facebook or lead.linkedin or lead.twitter or lead.tiktok


def _detect_social_platform(lead: Lead) -> str:
    if lead.instagram:
        return "instagram"
    if lead.facebook:
        return "facebook"
    if lead.linkedin:
        return "linkedin"
    if lead.twitter:
        return "twitter"
    if lead.tiktok:
        return "tiktok"
    return "unknown"
