from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth, clients, leads, users
from app.routers import settings as settings_router
from app.routers import webhooks
from app.routers import social_queue
from app.routers import campaigns
from app.routers import review_queue
from app.routers import conversations
from app.routers import analytics
from app.routers import media
from app.routers import templates
from app.routers import global_templates

app = FastAPI(
    title="Maximus Outreach API",
    description="Multi-tenant AI-powered outreach automation platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(users.router)
app.include_router(clients.router)
app.include_router(leads.router)
app.include_router(settings_router.router)
app.include_router(webhooks.router)
app.include_router(webhooks.wa_router)
app.include_router(social_queue.router)
app.include_router(campaigns.router)
app.include_router(review_queue.router)
app.include_router(conversations.router)
app.include_router(analytics.router)
app.include_router(media.router)
app.include_router(templates.router)
app.include_router(global_templates.router)
