# %% [markdown]
# Prompt Chaining Example
# This example demonstrates how to use prompt chaining to extract event information

import json

# %%
from datetime import datetime
from typing import Optional

import litellm
from pydantic import BaseModel, Field
from rich.console import Console

console = Console()


class EventExtraction(BaseModel):
    """Extract basic event information from a text message."""

    description: str = Field(description="Raw description of the event")
    is_calendar_event: bool = Field(
        description="Whether this text describes a calendar event",
        default=False,
    )
    confidence_score: float = Field(
        description="Confidence score of the event extraction between 0 and 1",
    )


class EventDetails(BaseModel):
    """Extract detailed event information from a text message."""

    name: str = Field(description="Name of the event")
    date: str = Field(
        description="Date and time of the event. Use ISO 8601 to format this value."
    )
    duration_in_minutes: int = Field(
        description="Duration of the event in minutes",
    )
    participants: list[str] = Field(
        description="List of participants in the event",
    )


class EventConfirmation(BaseModel):
    """Generate confirmation message"""

    confirmation_message: str = Field(
        description="Natural language confirmation message for the event",
    )
    calendar_link: Optional[str] = Field(
        description="Generated calendar link if applicable",
    )


def extract_event_info(user_input: str) -> EventExtraction:
    console.log("Starting event extraction...")
    console.log(f"User input: {user_input}")

    today = datetime.now()
    date_context = f"Today is {today.strftime('%A, %B %d, %Y')}."

    completion = litellm.completion(
        model="gemini/gemini-2.0-flash",
        messages=[
            {
                "role": "system",
                "content": f"{date_context} Analyze if the text describes a calendar event.",
            },
            {
                "role": "user",
                "content": user_input,
            },
        ],
        response_format=EventExtraction,
    )
    result = json.loads(completion.choices[0].message.content)

    console.log(
        f"Extraction complete - Is calendar event: {result['is_calendar_event']}, Confidence: {result['confidence_score']:.2f}"
    )
    return result


def parse_event_details(description: str) -> EventDetails:
    console.log("Event details parsing")

    today = datetime.now()
    date_context = f"Today is {today.strftime('%A, %B %d, %Y')}."

    completion = litellm.completion(
        model="gemini/gemini-2.0-flash",
        messages=[
            {
                "role": "system",
                "content": f"{date_context} Extract detailed event information. When dates reference 'next Tuesday' or similar relative dates, use this current date as reference.",
            },
            {
                "role": "user",
                "content": description,
            },
        ],
        response_format=EventDetails,
    )
    result = json.loads(completion.choices[0].message.content)
    console.log(
        f"Parsed event details - Name: {result['name']}, Date: {result['date']}, Duration: {result['duration_in_minutes']}min"
    )
    console.log(f"Participants: {', '.join(result['participants'])}")
    return result


def generate_confirmation(event_details: EventDetails) -> EventConfirmation:
    console.log("Generating confirmation message")

    completion = litellm.completion(
        model="gemini/gemini-2.0-flash",
        messages=[
            {
                "role": "system",
                "content": "Generate a natural confirmation message for the event. Sign of with your name; Susie",
            },
            {
                "role": "user",
                "content": str(event_details),
            },
        ],
        response_format=EventConfirmation,
    )
    result = json.loads(completion.choices[0].message.content)
    console.log("Confirmation message generated successfully")
    return result


def process_calendar_request(user_input: str) -> Optional[EventConfirmation]:
    console.log("Processing calendar request")
    console.log(f"Raw input: {user_input}")

    initial_extraction = extract_event_info(user_input)

    if (
        not initial_extraction["is_calendar_event"]
        or initial_extraction["confidence_score"] < 0.7
    ):
        console.log(
            f"Gate check failed - is_calendar_event: {initial_extraction['is_calendar_event']}, confidence: {initial_extraction['confidence_score']:.2f}"
        )
        return None

    console.log("Gate check passed, proceeding with event processing")

    event_details = parse_event_details(initial_extraction["description"])

    confirmation = generate_confirmation(event_details)

    console.log("Calendar request processing completed successfully")
    return confirmation


user_input = "Let's schedule a 1h team meeting next Tuesday at 2pm with Alice and Bob to discuss the project roadmap."

result = process_calendar_request(user_input)
console.log(result)


console.log(f"Confirmation: {result['confirmation_message']}")
if result["calendar_link"]:
    console.log(f"Calendar Link: {result['calendar_link']}")


# %%
