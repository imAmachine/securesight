import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pycuda.driver as cuda
from app.routes import router
import torch
torch.cuda.empty_cache()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def startup():
    global ctx
    ctx = cuda.Context.attach()
    torch.cuda.empty_cache()


async def shutdown():
    global ctx
    if ctx is not None:
        ctx.detach()

@app.get("/")
async def root():
    return {"message": "Welcome to SecureSight Assistant API"}

@app.get("/ws/test")
async def websocket_test():
    return {"message": "WebSocket is available"}

# Добавляем контекст жизненного цикла к приложению
app.add_event_handler("startup", startup)
app.add_event_handler("shutdown", shutdown)
app.include_router(router, prefix="")
