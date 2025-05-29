import uuid

from fastapi import APIRouter, Depends
from src.api.dependencies import get_chat_service
from src.domain.chat.interfaces import ChatService
from src.dto import ChatRequest, FeedbackRequest, UpdateRequest

router = APIRouter()


@router.post("/chat/thread", tags=["chat"])
async def create_thread():
    thread_id = str(uuid.uuid4())

    return {"thread_id": thread_id}


@router.post("/chat/thread/{thread_id}/ask", tags=["chat"])
async def chat_endpoint(
    request: ChatRequest,
    chat_service: ChatService = Depends(get_chat_service),
):
    response = await chat_service.process_chat(
        thread_id=request.thread_id, messages=request.messages
    )
    return response


@router.post("/chat/thread/{thread_id}/update", tags=["chat"])
async def update_tool_call(
    thread_id: str,
    request: UpdateRequest,
    chat_service: ChatService = Depends(get_chat_service),
):
    response = await chat_service.update_tool_call(thread_id, request.args)
    return response


@router.post("/chat/thread/{thread_id}/feedback", tags=["chat"])
async def feedback_tool_call(
    thread_id: str,
    request: FeedbackRequest,
    chat_service: ChatService = Depends(get_chat_service),
):
    response = await chat_service.provide_feedback(thread_id, request.feedback)
    return response


@router.get("/chat/thread/{thread_id}/continue", tags=["chat"])
async def continue_chat(
    thread_id: str,
    chat_service: ChatService = Depends(get_chat_service),
):
    response = await chat_service.continue_chat(thread_id)
    return response
