# %% [markdown]
# # Routing Example

# %%
import json
from datetime import datetime
from typing import List, Optional

import litellm
from pydantic import BaseModel, Field
from rich.console import Console
from typing_extensions import Literal

console = Console()


class CalendarRequestType(BaseModel):
    """Router LLM call: Determine the type of calendar request."""

    request_type: Literal["new_event", "modify_event", "other"] = Field(
        description="Type of calendar request"
    )
    confidence_score: float = Field(
        description="Confidence score between 0 and 1"
    )
    description: str = Field("Cleaned description of the request")


class NewEventDetails(BaseModel):
    """Details for creating a new event."""

    name: str = Field(description="Name of the event")
    date: str = Field(
        description="Date and time of the event in ISO 8601 format"
    )
    duration_minutes: int = Field(
        description="Duration of the event in minutes"
    )
    participants: List[str] = Field(description="List of participants")


class Change(BaseModel):
    """Details for changing an existing event."""

    field: str = Field(description="Field to change")
    new_value: str = Field(description="New value for the field")


class ModifyEventDetails(BaseModel):
    """Details for modifying an existing event."""

    event_identifier: str = Field(
        description="Description to identify the existing event"
    )
    changes: List[Change] = Field(description="List of changes to apply")
    participants_to_add: List[str] = Field(
        description="List of participants to add"
    )
    participants_to_remove: List[str] = Field(
        description="List of participants to remove"
    )


class CalendarResponse(BaseModel):
    """Final response for calendar requests."""

    success: bool = Field(description="Whether the request was successful")
    message: str = Field(description="User-Friendly response message")
    calendar_link: Optional[str] = Field(
        description="Link to the calendar event if applicable"
    )


def route_calendar_request(user_input: str) -> CalendarRequestType:
    """Router LLM call to determine the type of calendar request."""

    console.log("Routing calendar request...")

    completion = litellm.completion(
        model="gemini/gemini-2.0-flash",
        messages=[
            {
                "role": "system",
                "content": "Determine if this is a request to create a new calendar event, modify an existing event, or something else.",
            },
            {
                "role": "user",
                "content": user_input,
            },
        ],
        response_format=CalendarRequestType,
    )

    result = json.loads(completion.choices[0].message.content)
    console.log(
        f"Request routed as: {result['request_type']} with confidence {result['confidence_score']:.2f}"
    )
    return result


def handle_new_event(description: str) -> CalendarResponse:
    """Process a new event request."""

    console.log("Processing new event request...")

    completion = litellm.completion(
        model="gemini/gemini-2.0-flash",
        messages=[
            {
                "role": "system",
                "content": "Extract events for creating a new calendar event.",
            },
            {
                "role": "user",
                "content": description,
            },
        ],
        response_format=NewEventDetails,
    )

    result = json.loads(completion.choices[0].message.content)
    console.log(f"New event details extracted: {result}")
    return CalendarResponse(
        success=True,
        message=f"New event '{result['name']}' for {result['date']} with {result['participants']} created successfully.",
        calendar_link=f"https://calendar.example.com/event/{result['name']}",
    )


def handle_modify_event(description: str) -> CalendarResponse:
    """Process an event modification request."""

    console.log("Processing event modification request...")

    completion = litellm.completion(
        model="gemini/gemini-2.0-flash",
        messages=[
            {
                "role": "system",
                "content": "Extract details for modifying an existing calendar event.",
            },
            {
                "role": "user",
                "content": description,
            },
        ],
        response_format=ModifyEventDetails,
    )

    result = json.loads(completion.choices[0].message.content)
    console.log(f"Modification details extracted: {result}")

    return CalendarResponse(
        success=True,
        message=f"Event '{result['event_identifier']}' modified successfully.",
        calendar_link=f"https://calendar.example.com/event/{result['event_identifier']}",
    )


def process_calendar_request(user_input: str) -> Optional[CalendarResponse]:
    """Main function to process calendar requests."""

    console.log("Processing calendar request")
    console.log(f"Raw input: {user_input}")

    routing_result = route_calendar_request(user_input)

    if routing_result["confidence_score"] < 0.7:
        console.log(
            f"Routing confidence too low: {routing_result['confidence_score']:.2f}. Request not processed."
        )
        return None

    if routing_result["request_type"] == "new_event":
        return handle_new_event(routing_result["description"])
    elif routing_result["request_type"] == "modify_event":
        return handle_modify_event(routing_result["description"])
    else:
        console.log("Request type not recognized or unsupported.")
        return None


# %%
new_event_input = (
    "Let's schedule a team meeting next Tuesday at 2pm with Alice and Bob"
)
result = process_calendar_request(new_event_input)
console.log(result.message)

# %%
modify_event_input = "Can you move the team meeting with Alice and Bob to Wednesday at 3pm instead?"
result = process_calendar_request(modify_event_input)
console.log(result.message)

# %%
invalid_input = "What is the weather like in Paris today?"
result = process_calendar_request(invalid_input)
if result:
    console.log(result.message)
