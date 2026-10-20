"""
Alembic Migration Environment Configuration for Scanly
"""
import asyncio
from logging.config import fileConfig
import sys
import os

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context

# Add app to path
current_dir = os.path.dirname(os.path.abspath(__file__))
app_dir = os.path.abspath(os.path.join(current_dir, ".."))
project_root = os.path.abspath(os.path.join(current_dir, "..", "..", ".."))
if app_dir not in sys.path:
    sys.path.insert(0, app_dir)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from app.core.config import settings
from app.db.base import Base
import app.models  # load all models

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = settings.DATABASE_URL_SYNC
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    from app.db.session import async_engine
    async with async_engine.connect() as connection:
        await connection.run_sync(do_run_migrations)


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
