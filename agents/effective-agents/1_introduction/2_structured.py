# %%
import litellm
from pydantic import BaseModel
from rich.console import Console

console = Console()


class CalendarEvent(BaseModel):
    name: str
    date: str
    participants: list[str]


messages = [
    {"role": "system", "content": "Extract the event information."},
    {
        "role": "user",
        "content": "Alice and Bob are going to a science fair on friday.",
    },
]

completion = litellm.completion(
    model="gemini/gemini-2.0-flash",
    messages=messages,
    response_format=CalendarEvent,
)

response = completion.choices[0].message.content
console.log(response)

# %%
