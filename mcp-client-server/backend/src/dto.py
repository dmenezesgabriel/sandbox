import uuid
from typing import List, Optional, Union

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from pydantic import BaseModel, ConfigDict


class ChatRequest(BaseModel):
    messages: List[Union[HumanMessage, AIMessage, SystemMessage]]
    thread_id: Optional[str] = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "messages": [
                    {
                        "type": "system",
                        "content": (
                            "You are a helpful assistant. \n"
                            "You're provided with a list of tools, and a input from the user.\n"
                            "Your job is to determine whether or not you have a tool which can handle the users input, "
                            "or respond with plain text.\n"
                        ),
                    },
                    {"type": "human", "content": "How much is 2+2?"},
                ],
                "thread_id": str(uuid.uuid4()),
            }
        }
    )


class UpdateRequest(BaseModel):
    args: dict


class FeedbackRequest(BaseModel):
    feedback: str
