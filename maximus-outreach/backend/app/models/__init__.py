# All models imported here so Alembic autogenerate can detect them.
from app.models.user import User, UserClientAssignment
from app.models.client import Client
from app.models.lead import Lead, LeadImport
from app.models.campaign import Campaign, CampaignEnrollment, CampaignStep, StepMedia
from app.models.outreach import OutreachLog, SocialDmQueue
from app.models.conversation import Conversation, Message
from app.models.settings import AiApiKey, EmailWarmupSchedule, SmtpSettings, SmsProviderSettings, SmsPhoneNumber, WhatsAppSettings
from app.models.analytics import AnalyticsEvent
from app.models.media import MediaFile

__all__ = [
    "User",
    "UserClientAssignment",
    "Client",
    "Lead",
    "LeadImport",
    "Campaign",
    "CampaignStep",
    "StepMedia",
    "CampaignEnrollment",
    "OutreachLog",
    "SocialDmQueue",
    "Conversation",
    "Message",
    "SmtpSettings",
    "AiApiKey",
    "SmsProviderSettings",
    "SmsPhoneNumber",
    "WhatsAppSettings",
    "EmailWarmupSchedule",
    "AnalyticsEvent",
    "MediaFile",
]
