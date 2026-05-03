from celery import Celery

from app.config import settings

celery_app = Celery(
    "sporthink",
    broker=settings.redis_broker_url,
    backend=settings.redis_broker_url,
    include=[
        # "app.tasks.import_tasks",
        # "app.tasks.normalize_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)
