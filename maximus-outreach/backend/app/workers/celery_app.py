"""Celery application configuration."""
from celery import Celery

from app.config import settings

celery_app = Celery(
    "maximus_outreach",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.workers.ai_health_worker",
        "app.workers.email_warmup_worker",
        "app.workers.pacing_worker",
        "app.workers.scheduler_worker",
        "app.workers.outreach_worker",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    # Beat schedule
    beat_schedule={
        "ai-health-check-every-30-min": {
            "task": "app.workers.ai_health_worker.check_ai_key_health",
            "schedule": 1800,  # 30 minutes in seconds
        },
        "email-warmup-daily-midnight": {
            "task": "app.workers.email_warmup_worker.run_email_warmup",
            "schedule": 86400,  # 24 hours in seconds (runs daily)
        },
        "pacing-every-15-min": {
            "task": "app.workers.pacing_worker.run_pacing",
            "schedule": 900,  # 15 minutes
        },
        "scheduler-every-5-min": {
            "task": "app.workers.scheduler_worker.run_scheduler",
            "schedule": 300,  # 5 minutes
        },
        "outreach-queue-every-5-min": {
            "task": "app.workers.outreach_worker.process_outreach_queue",
            "schedule": 300,  # 5 minutes
        },
    },
)
