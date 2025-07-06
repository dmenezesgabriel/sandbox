# %% Define a tool and call it with Gemini 2.0 Flash
import json

import litellm
from pydantic import BaseModel, Field
from rich.console import Console

console = Console()


def get_weather(location: str):
    return f"The temperature in {location} is 20°C."


tools = [
    {
        "type": "function",
        "name": "get_weather",
        "description": "Get current temperature for provided coordinates in celsius.",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {"type": "string"},
            },
            "required": ["location"],
            "additionalProperties": False,
        },
        "strict": True,
    }
]

messages = [
    {"role": "system", "content": "You're a helpful weather assistant."},
    {
        "role": "user",
        "content": "What's the weather like in Paris today?",
    },
]

completion = litellm.completion(
    model="gemini/gemini-2.0-flash",
    messages=messages,
    tools=tools,
)

console.log(completion.choices[0].message.tool_calls)


# %% Call the functions
def call_function(name, args):
    if name == "get_weather":
        return get_weather(**args)


for tool_call in completion.choices[0].message.tool_calls:
    name = tool_call.function.name
    args = json.loads(tool_call.function.arguments)
    messages.append(completion.choices[0].message)

    result = call_function(name, args)
    messages.append(
        {
            "role": "tool",
            "tool_call_id": tool_call.id,
            "content": result,
        }
    )


# %% Supply results and call the model again
class WeatherResponse(BaseModel):
    location: str = Field(
        ..., description="The location for which the weather is reported."
    )
    temperature: float = Field(
        ..., description="The current temperature in Celsius."
    )


completion_2 = litellm.completion(
    model="gemini/gemini-2.0-flash",
    messages=messages,
    tools=tools,
    response_format=WeatherResponse,
)

response = completion_2.choices[0].message.content
console.log(response)

# %%
