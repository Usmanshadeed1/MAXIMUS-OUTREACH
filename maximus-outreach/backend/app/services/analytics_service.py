"""
Phase 13.1 — Analytics Service

Functions:
- get_dashboard_stats(client_id, date_from, date_to, db)
- get_campaign_analytics(campaign_id, db)
- export_analytics(client_id, format, date_from, date_to, db)
"""
import csv
import io
import json
import uuid
from datetime import date, datetime, timedelta

from sqlalchemy import func, select, and_, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.campaign import Campaign, CampaignEnrollment, CampaignStep
from app.models.lead import Lead
from app.models.outreach import OutreachLog


# ---------------------------------------------------------------------------
# Channel cost per message (USD)
# ---------------------------------------------------------------------------
CHANNEL_COST = {
    "email": 0.0,
    "sms": 0.0079,
    "whatsapp": 0.05,
    "social_dm": 0.0,
}


# ---------------------------------------------------------------------------
# Dashboard Stats
# ---------------------------------------------------------------------------

async def get_dashboard_stats(
    db: AsyncSession,
    client_id: uuid.UUID | None,
    date_from: date | None,
    date_to: date | None,
) -> dict:
    """
    Returns a comprehensive stats dict for the dashboard.
    """
    dt_from = datetime.combine(date_from, datetime.min.time()) if date_from else None
    dt_to   = datetime.combine(date_to,   datetime.max.time()) if date_to   else None

    # ------------------------------------------------------------------
    # 1. Total leads
    # ------------------------------------------------------------------
    lead_q = select(func.count(Lead.id))
    if client_id:
        lead_q = lead_q.where(Lead.client_id == client_id)
    total_leads: int = (await db.execute(lead_q)).scalar_one()

    # ------------------------------------------------------------------
    # 2. Messages sent / replied by channel
    # ------------------------------------------------------------------
    log_filters = [OutreachLog.status == "sent"]
    if client_id:
        # Join through enrollment → campaign to filter by client
        log_filters.append(
            OutreachLog.lead_id.in_(
                select(Lead.id).where(Lead.client_id == client_id)
            )
        )
    if dt_from:
        log_filters.append(OutreachLog.sent_at >= dt_from)
    if dt_to:
        log_filters.append(OutreachLog.sent_at <= dt_to)

    sent_by_channel_q = (
        select(OutreachLog.channel, func.count(OutreachLog.id).label("cnt"))
        .where(and_(*log_filters))
        .group_by(OutreachLog.channel)
    )
    sent_rows = (await db.execute(sent_by_channel_q)).all()
    sent_by_channel = {row.channel: row.cnt for row in sent_rows}
    total_sent = sum(sent_by_channel.values())

    # Replies = leads with status "replied" (within date range if possible)
    reply_q = select(func.count(Lead.id)).where(Lead.status == "replied")
    if client_id:
        reply_q = reply_q.where(Lead.client_id == client_id)
    total_replies: int = (await db.execute(reply_q)).scalar_one()

    reply_rate = round(total_replies / total_sent * 100, 1) if total_sent > 0 else 0.0

    # Conversions = leads with status "customer"
    conv_q = select(func.count(Lead.id)).where(Lead.status == "customer")
    if client_id:
        conv_q = conv_q.where(Lead.client_id == client_id)
    total_customers: int = (await db.execute(conv_q)).scalar_one()
    conversion_rate = round(total_customers / total_leads * 100, 1) if total_leads > 0 else 0.0

    # ------------------------------------------------------------------
    # 3. Messages over time (daily) — last 30 days if no range given
    # ------------------------------------------------------------------
    range_from = dt_from or (datetime.utcnow() - timedelta(days=30))
    range_to   = dt_to   or datetime.utcnow()

    daily_q = (
        select(
            func.date(OutreachLog.sent_at).label("day"),
            func.count(OutreachLog.id).label("sent"),
        )
        .where(
            OutreachLog.status == "sent",
            OutreachLog.sent_at >= range_from,
            OutreachLog.sent_at <= range_to,
        )
        .group_by(func.date(OutreachLog.sent_at))
        .order_by(func.date(OutreachLog.sent_at))
    )
    if client_id:
        daily_q = daily_q.where(
            OutreachLog.lead_id.in_(select(Lead.id).where(Lead.client_id == client_id))
        )
    daily_rows = (await db.execute(daily_q)).all()
    messages_over_time = [{"date": str(r.day), "sent": r.sent} for r in daily_rows]

    # ------------------------------------------------------------------
    # 4. Channel performance comparison
    # ------------------------------------------------------------------
    channel_perf = []
    for ch, sent_cnt in sent_by_channel.items():
        # Replies per channel: leads that replied AND had a sent log on that channel
        ch_reply_q = (
            select(func.count(Lead.id.distinct()))
            .join(OutreachLog, OutreachLog.lead_id == Lead.id)
            .where(
                OutreachLog.channel == ch,
                OutreachLog.status == "sent",
                Lead.status == "replied",
            )
        )
        if client_id:
            ch_reply_q = ch_reply_q.where(Lead.client_id == client_id)
        ch_replies: int = (await db.execute(ch_reply_q)).scalar_one()
        ch_reply_rate = round(ch_replies / sent_cnt * 100, 1) if sent_cnt > 0 else 0.0
        cost_per_msg = CHANNEL_COST.get(ch, 0.0)
        channel_perf.append({
            "channel": ch,
            "sent": sent_cnt,
            "replies": ch_replies,
            "reply_rate": ch_reply_rate,
            "total_cost": round(sent_cnt * cost_per_msg, 4),
        })

    # ------------------------------------------------------------------
    # 5. Lead pipeline: New → Contacted → Replied → Qualified → Customer
    # ------------------------------------------------------------------
    pipeline_statuses = ["new", "contacted", "replied", "qualified", "customer"]
    pipeline = []
    for s in pipeline_statuses:
        pq = select(func.count(Lead.id)).where(Lead.status == s)
        if client_id:
            pq = pq.where(Lead.client_id == client_id)
        cnt: int = (await db.execute(pq)).scalar_one()
        pipeline.append({"status": s, "count": cnt})

    # ------------------------------------------------------------------
    # 6. Top campaigns (by replies)
    # ------------------------------------------------------------------
    camp_q = select(Campaign)
    if client_id:
        camp_q = camp_q.where(Campaign.client_id == client_id)
    campaigns = (await db.execute(camp_q)).scalars().all()

    top_campaigns = []
    for camp in campaigns:
        # Sent for this campaign
        camp_sent_q = (
            select(func.count(OutreachLog.id))
            .join(CampaignEnrollment, OutreachLog.enrollment_id == CampaignEnrollment.id)
            .where(CampaignEnrollment.campaign_id == camp.id, OutreachLog.status == "sent")
        )
        camp_sent: int = (await db.execute(camp_sent_q)).scalar_one()

        # Replied = enrollments with status "replied"
        camp_reply_q = (
            select(func.count(CampaignEnrollment.id))
            .where(CampaignEnrollment.campaign_id == camp.id, CampaignEnrollment.status == "replied")
        )
        camp_replied: int = (await db.execute(camp_reply_q)).scalar_one()

        cr = round(camp_replied / camp_sent * 100, 1) if camp_sent > 0 else 0.0
        top_campaigns.append({
            "id": str(camp.id),
            "name": camp.name,
            "status": camp.status,
            "total_enrolled": camp.total_enrolled,
            "total_activated": camp.total_activated,
            "sent": camp_sent,
            "replies": camp_replied,
            "reply_rate": cr,
        })
    # Sort by replies desc, take top 10
    top_campaigns.sort(key=lambda x: x["replies"], reverse=True)
    top_campaigns = top_campaigns[:10]

    # ------------------------------------------------------------------
    # 7. Cost estimates
    # ------------------------------------------------------------------
    cost_estimates = {}
    for ch, sent_cnt in sent_by_channel.items():
        cost_estimates[ch] = round(sent_cnt * CHANNEL_COST.get(ch, 0.0), 4)

    return {
        "total_leads": total_leads,
        "total_sent": total_sent,
        "total_replies": total_replies,
        "reply_rate": reply_rate,
        "total_customers": total_customers,
        "conversion_rate": conversion_rate,
        "sent_by_channel": sent_by_channel,
        "messages_over_time": messages_over_time,
        "channel_performance": channel_perf,
        "lead_pipeline": pipeline,
        "top_campaigns": top_campaigns,
        "cost_estimates": cost_estimates,
    }


# ---------------------------------------------------------------------------
# Campaign Analytics
# ---------------------------------------------------------------------------

async def get_campaign_analytics(campaign_id: uuid.UUID, db: AsyncSession) -> dict:
    """Per-step performance and drop-off for a campaign."""
    campaign = (await db.execute(
        select(Campaign).where(Campaign.id == campaign_id)
    )).scalar_one_or_none()

    if campaign is None:
        return {}

    steps = (await db.execute(
        select(CampaignStep)
        .where(CampaignStep.campaign_id == campaign_id)
        .order_by(CampaignStep.step_order)
    )).scalars().all()

    total_enrolled = campaign.total_enrolled
    total_activated = campaign.total_activated

    step_stats = []
    for step in steps:
        sent_q = (
            select(func.count(OutreachLog.id))
            .where(OutreachLog.step_id == step.id, OutreachLog.status == "sent")
        )
        sent: int = (await db.execute(sent_q)).scalar_one()

        failed_q = (
            select(func.count(OutreachLog.id))
            .where(OutreachLog.step_id == step.id, OutreachLog.status == "failed")
        )
        failed: int = (await db.execute(failed_q)).scalar_one()

        skipped_q = (
            select(func.count(OutreachLog.id))
            .where(OutreachLog.step_id == step.id, OutreachLog.status == "skipped")
        )
        skipped: int = (await db.execute(skipped_q)).scalar_one()

        reach_rate = round(sent / total_activated * 100, 1) if total_activated > 0 else 0.0

        step_stats.append({
            "step_order": step.step_order,
            "channel": step.channel,
            "sent": sent,
            "failed": failed,
            "skipped": skipped,
            "reach_rate": reach_rate,
        })

    # Drop-off: how many reached step N vs step N-1
    dropoff = []
    for i, s in enumerate(step_stats):
        if i == 0:
            dropoff.append({"step": s["step_order"], "drop_pct": 0.0})
        else:
            prev = step_stats[i - 1]["sent"]
            curr = s["sent"]
            dp = round((prev - curr) / prev * 100, 1) if prev > 0 else 0.0
            dropoff.append({"step": s["step_order"], "drop_pct": dp})

    # Enrollment statuses
    status_q = (
        select(CampaignEnrollment.status, func.count(CampaignEnrollment.id).label("cnt"))
        .where(CampaignEnrollment.campaign_id == campaign_id)
        .group_by(CampaignEnrollment.status)
    )
    status_rows = (await db.execute(status_q)).all()
    enrollment_breakdown = {r.status: r.cnt for r in status_rows}

    # Pacing progress
    pacing_progress = {
        "total_enrolled": total_enrolled,
        "total_activated": total_activated,
        "pct_activated": round(total_activated / total_enrolled * 100, 1) if total_enrolled > 0 else 0.0,
        "pacing_mode": campaign.pacing_mode,
        "pacing_config": campaign.pacing_leads_per_day,
    }

    return {
        "campaign_id": str(campaign.id),
        "campaign_name": campaign.name,
        "status": campaign.status,
        "pacing_progress": pacing_progress,
        "enrollment_breakdown": enrollment_breakdown,
        "step_performance": step_stats,
        "dropoff": dropoff,
    }


# ---------------------------------------------------------------------------
# Export Analytics
# ---------------------------------------------------------------------------

async def export_analytics(
    db: AsyncSession,
    client_id: uuid.UUID,
    format: str,
    date_from: date | None,
    date_to: date | None,
) -> tuple[str, str]:
    """
    Returns (content_string, content_type).
    format = "csv" | "json"
    """
    stats = await get_dashboard_stats(db, client_id, date_from, date_to)

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)

        # Summary
        writer.writerow(["Metric", "Value"])
        writer.writerow(["Total Leads", stats["total_leads"]])
        writer.writerow(["Total Sent", stats["total_sent"]])
        writer.writerow(["Total Replies", stats["total_replies"]])
        writer.writerow(["Reply Rate %", stats["reply_rate"]])
        writer.writerow(["Total Customers", stats["total_customers"]])
        writer.writerow(["Conversion Rate %", stats["conversion_rate"]])
        writer.writerow([])

        # Channel perf
        writer.writerow(["Channel", "Sent", "Replies", "Reply Rate %", "Total Cost $"])
        for ch in stats["channel_performance"]:
            writer.writerow([ch["channel"], ch["sent"], ch["replies"], ch["reply_rate"], ch["total_cost"]])
        writer.writerow([])

        # Lead pipeline
        writer.writerow(["Pipeline Stage", "Count"])
        for p in stats["lead_pipeline"]:
            writer.writerow([p["status"], p["count"]])
        writer.writerow([])

        # Daily timeline
        writer.writerow(["Date", "Sent"])
        for d in stats["messages_over_time"]:
            writer.writerow([d["date"], d["sent"]])

        return output.getvalue(), "text/csv"
    else:
        return json.dumps(stats, indent=2, default=str), "application/json"
