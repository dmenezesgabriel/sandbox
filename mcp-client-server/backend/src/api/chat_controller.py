import uuid

from fastapi import APIRouter
from src.domain.chat.interfaces import ChatService
from src.dto import ChatRequest, FeedbackRequest, UpdateRequest


class ChatApiAdapter:
    def __init__(self, chat_service: ChatService) -> None:
        self._chat_service = chat_service
        self.router = APIRouter()
        self.router.add_api_route(
            "/chat/thread", self.create_thread, methods=["POST"], tags=["chat"]
        )
        self.router.add_api_route(
            "/chat/thread/{thread_id}/ask",
            self.chat_endpoint,
            methods=["POST"],
            tags=["chat"],
        )
        self.router.add_api_route(
            "/chat/thread/{thread_id}/update",
            self.update_tool_call,
            methods=["POST"],
            tags=["chat"],
        )
        self.router.add_api_route(
            "/chat/thread/{thread_id}/feedback",
            self.feedback_tool_call,
            methods=["POST"],
            tags=["chat"],
        )
        self.router.add_api_route(
            "/chat/thread/{thread_id}/continue",
            self.continue_chat,
            methods=["GET"],
            tags=["chat"],
        )

    async def create_thread(self):
        thread_id = str(uuid.uuid4())
        return {"thread_id": thread_id}

    async def chat_endpoint(self, request: ChatRequest):
        response = await self._chat_service.process_chat(
            thread_id=request.thread_id, messages=request.messages
        )
        return response

    async def update_tool_call(self, thread_id: str, request: UpdateRequest):
        response = await self._chat_service.update_tool_call(
            thread_id, request.args
        )
        return response

    async def feedback_tool_call(
        self, thread_id: str, request: FeedbackRequest
    ):
        response = await self._chat_service.provide_feedback(
            thread_id, request.feedback
        )
        return response

    async def continue_chat(self, thread_id: str):
        response = await self._chat_service.continue_chat(thread_id)
        return response
