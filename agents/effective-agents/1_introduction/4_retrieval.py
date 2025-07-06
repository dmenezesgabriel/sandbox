# %%
import json

import litellm
from pydantic import BaseModel, Field
from rich.console import Console

console = Console()


def search_kb(question: str):
    return str(
        {
            "records": [
                {
                    "id": 1,
                    "question": "What is the return policy?",
                    "answer": "Items can be returned within 30 days of purchase with original receipt. Refunds will be processed to the original payment method within 5-7 business days.",
                },
                {
                    "id": 2,
                    "question": "Do you ship internationally?",
                    "answer": "Yes, we ship to over 50 countries worldwide. International shipping typically takes 7-14 business days and costs vary by destination. Please note that customs fees may apply.",
                },
                {
                    "id": 3,
                    "question": "What payment methods do you accept?",
                    "answer": "We accept Visa, Mastercard, American Express, PayPal, and Apple Pay. All payments are processed securely through our encrypted payment system.",
                },
            ]
        }
    )


tools = [
    {
        "type": "function",
        "name": "search_kb",
        "description": "Get the answer to the user's question from the knowledge base.",
        "parameters": {
            "type": "object",
            "properties": {
                "question": {"type": "string"},
            },
            "required": ["question"],
            "additionalProperties": False,
        },
        "strict": True,
    }
]

messages = [
    {
        "role": "system",
        "content": "You are a helpful assistant that answers questions from the knowledge base about our e-commerce store.",
    },
    {
        "role": "user",
        "content": "What is the return policy?",
    },
]

completion = litellm.completion(
    model="gemini/gemini-2.0-flash",
    messages=messages,
    tools=tools,
)


console.log(completion)


# %%
def call_function(name, args):
    if name == "search_kb":
        return search_kb(**args)


for tool_call in completion.choices[0].message.tool_calls:
    name = tool_call.function.name
    args = json.loads(tool_call.function.arguments)
    messages.append(completion.choices[0].message)

    result = call_function(name, args)
    messages.append(
        {
            "role": "tool",
            "tool_call_id": tool_call.id,
            "content": json.dumps(result),
        }
    )


# %%
class KBResponse(BaseModel):
    answer: str = Field(
        description="The answer to the user's question from the knowledge base."
    )
    source: str = Field(
        description="The record id of the knowledge base entry that was used to answer the question."
    )


completion_2 = litellm.completion(
    model="gemini/gemini-2.0-flash",
    messages=messages,
    tools=tools,
    response_format=KBResponse,
)

console.log(completion_2.choices[0].message.content)

# %%
