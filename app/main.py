from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.db.session import engine
from app.db.base import Base
from app.api.v1.routers import invoices, auth

from app.models import client, invoice  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield
    engine.dispose()


app = FastAPI(lifespan=lifespan)
app.include_router(auth.router, prefix="/api/v1")
app.include_router(invoices.router, prefix="/api/v1")

# NOVO — serve os arquivos do frontend
app.mount("/static", StaticFiles(directory="app/static"), name="static")


@app.get("/")
def serve_frontend():
    from fastapi.responses import FileResponse
    return FileResponse("app/static/index.html")