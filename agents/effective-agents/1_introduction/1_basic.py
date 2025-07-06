# %%
import litellm
from rich.console import Console

console = Console()

messages = [
    {"role": "system", "content": "You're a helpful assistant."},
    {
        "role": "user",
        "content": "Write a limerick about the Python programming language.",
    },
]

completion = litellm.completion(
    model="gemini/gemini-2.0-flash",
    messages=messages,
)

response = completion.choices[0].message.content
console.log(response)

# %%
