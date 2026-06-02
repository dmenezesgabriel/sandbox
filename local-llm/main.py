from __future__ import annotations

import argparse
import ast
import json
import operator
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Final, Literal

from llama_cpp import Llama


MODEL_PATH: Final[Path] = Path("models/LFM2-8B-A1B-Q4_K_M.gguf")

Role = Literal["system", "user", "assistant"]
AgentAction = Literal["calculator", "final"]


@dataclass(frozen=True)
class AppConfig:
    prompt: str
    model_path: Path
    context_size: int
    thread_count: int
    gpu_layer_count: int
    temperature: float
    max_tokens: int
    max_iterations: int


@dataclass(frozen=True)
class ChatMessage:
    role: Role
    content: str

    def to_llama_message(self) -> dict[str, str]:
        return {
            "role": self.role,
            "content": self.content,
        }


@dataclass(frozen=True)
class AgentDecision:
    action: AgentAction
    action_input: str | None
    answer: str | None


@dataclass(frozen=True)
class AgentStep:
    iteration: int
    model_output: str
    action: str
    observation: str


@dataclass(frozen=True)
class AgentResult:
    answer: str
    elapsed_seconds: float
    steps: list[AgentStep] = field(default_factory=list)


@dataclass(frozen=True)
class LocalLlamaSettings:
    model_path: Path
    context_size: int
    thread_count: int
    gpu_layer_count: int
    temperature: float
    max_tokens: int


class LocalLlamaClient:
    def __init__(self, settings: LocalLlamaSettings) -> None:
        self._settings = settings
        self._llm = self._create_model(settings)

    def complete(self, messages: list[ChatMessage]) -> str:
        response = self._llm.create_chat_completion(
            messages=[message.to_llama_message() for message in messages],
            temperature=self._settings.temperature,
            max_tokens=self._settings.max_tokens,
        )

        return extract_response_content(response)

    def _create_model(self, settings: LocalLlamaSettings) -> Llama:
        if not settings.model_path.exists():
            raise FileNotFoundError(
                f"Model file not found: {settings.model_path}. "
                "Expected a local GGUF model file."
            )

        return Llama(
            model_path=str(settings.model_path),
            n_ctx=settings.context_size,
            n_threads=settings.thread_count,
            n_gpu_layers=settings.gpu_layer_count,
            verbose=False,
        )


class CalculatorTool:
    def run(self, expression: str) -> str:
        try:
            result = evaluate_math_expression(expression)
            return format_number(result)
        except ValueError as error:
            return f"Calculator error: {error}"


class SimpleAgent:
    def __init__(
        self,
        client: LocalLlamaClient,
        calculator: CalculatorTool,
        max_iterations: int,
    ) -> None:
        self._client = client
        self._calculator = calculator
        self._max_iterations = max_iterations

    def run(self, prompt: str) -> AgentResult:
        started_at = time.perf_counter()

        messages = [
            ChatMessage(role="system", content=create_system_prompt()),
            ChatMessage(role="user", content=prompt),
        ]

        steps: list[AgentStep] = []

        for iteration in range(1, self._max_iterations + 1):
            model_output = self._client.complete(messages)
            messages.append(ChatMessage(role="assistant", content=model_output))

            try:
                decision = parse_agent_decision(model_output)
            except ValueError as error:
                observation = create_json_repair_observation(error, prompt)
                messages.append(ChatMessage(role="user", content=observation))

                steps.append(
                    AgentStep(
                        iteration=iteration,
                        model_output=model_output,
                        action="repair",
                        observation=observation,
                    )
                )
                continue

            if decision.action == "final":
                answer = require_final_answer(decision)
                elapsed_seconds = time.perf_counter() - started_at

                return AgentResult(
                    answer=answer,
                    elapsed_seconds=elapsed_seconds,
                    steps=steps,
                )

            tool_input = require_action_input(decision)
            observation = self._calculator.run(tool_input)

            messages.append(
                ChatMessage(
                    role="user",
                    content=(
                        f"Original user question:\n{prompt}\n\n"
                        f"Calculator observation:\n{observation}\n\n"
                        "Now answer the full original user question.\n"
                        "Return only one valid JSON object with action='final'."
                    ),
                )
            )

            steps.append(
                AgentStep(
                    iteration=iteration,
                    model_output=model_output,
                    action=decision.action,
                    observation=observation,
                )
            )

        elapsed_seconds = time.perf_counter() - started_at

        return AgentResult(
            answer=(
                "The agent reached the maximum number of iterations without "
                "producing a final answer."
            ),
            elapsed_seconds=elapsed_seconds,
            steps=steps,
        )


def parse_args() -> AppConfig:
    parser = argparse.ArgumentParser(description="Run a small local LLM agent.")

    parser.add_argument(
        "-p",
        "--prompt",
        default=(
            "Explain llama.cpp in exactly 3 short bullet points. "
            "Be specific: mention GGUF models, local inference, and CPU-friendly execution."
        ),
        help="Prompt to send to the local model.",
    )

    parser.add_argument(
        "--model-path",
        default=str(MODEL_PATH),
        help="Path to the local GGUF model.",
    )

    parser.add_argument(
        "--ctx",
        type=int,
        default=8192,
        help="Context size.",
    )

    parser.add_argument(
        "--threads",
        type=int,
        default=8,
        help="CPU thread count.",
    )

    parser.add_argument(
        "--gpu-layers",
        type=int,
        default=0,
        help="Number of GPU layers. Use 0 for CPU-only.",
    )

    parser.add_argument(
        "--temperature",
        type=float,
        default=0.0,
        help="Sampling temperature.",
    )

    parser.add_argument(
        "--max-tokens",
        type=int,
        default=512,
        help="Maximum generated tokens.",
    )

    parser.add_argument(
        "--max-iterations",
        type=int,
        default=5,
        help="Maximum agent loop iterations.",
    )

    namespace = parser.parse_args()

    return AppConfig(
        prompt=str(namespace.prompt),
        model_path=Path(str(namespace.model_path)),
        context_size=int(namespace.ctx),
        thread_count=int(namespace.threads),
        gpu_layer_count=int(namespace.gpu_layers),
        temperature=float(namespace.temperature),
        max_tokens=int(namespace.max_tokens),
        max_iterations=int(namespace.max_iterations),
    )


def create_system_prompt() -> str:
    return """
You are a strict JSON agent running inside a local agent loop.

You have one tool:

calculator:
Use it for arithmetic and numeric expressions.

You must always return exactly one valid JSON object.

Valid tool call:

{
  "action": "calculator",
  "action_input": "144 / 12",
  "answer": null
}

Valid final answer:

{
  "action": "final",
  "action_input": null,
  "answer": "144 divided by 12 is 12. 12 is even."
}

Rules:
- Return JSON only.
- Do not return Markdown.
- Do not use triple backticks.
- Do not return plain text.
- Do not return more than one JSON object.
- For arithmetic, call the calculator first.
- After receiving a calculator observation, answer the full original user question.
- The final answer must address every part of the original user question.
""".strip()


def extract_response_content(response: object) -> str:
    if not isinstance(response, dict):
        raise TypeError(f"Expected response dict, got: {type(response)}")

    choices = response.get("choices")

    if not isinstance(choices, list):
        raise TypeError(f"Expected response choices list, got: {type(choices)}")

    if len(choices) == 0:
        raise ValueError("Expected at least one response choice, got empty list.")

    first_choice = choices[0]

    if not isinstance(first_choice, dict):
        raise TypeError(f"Expected choice dict, got: {type(first_choice)}")

    message = first_choice.get("message")

    if not isinstance(message, dict):
        raise TypeError(f"Expected message dict, got: {type(message)}")

    content = message.get("content")

    if not isinstance(content, str):
        raise TypeError(f"Expected message content string, got: {type(content)}")

    return content.strip()


def parse_agent_decision(model_output: str) -> AgentDecision:
    json_text = extract_first_json_object(model_output)
    parsed = json.loads(json_text)

    if not isinstance(parsed, dict):
        raise ValueError(f"Expected JSON object, got: {type(parsed)}")

    action = parsed.get("action")
    action_input = parsed.get("action_input")
    answer = parsed.get("answer")

    if action not in ("calculator", "final"):
        raise ValueError(
            f"Expected action to be 'calculator' or 'final', got: {action}"
        )

    if action_input is not None and not isinstance(action_input, str):
        raise ValueError(
            f"Expected action_input to be string or null, got: {type(action_input)}"
        )

    if answer is not None and not isinstance(answer, str):
        raise ValueError(f"Expected answer to be string or null, got: {type(answer)}")

    return AgentDecision(
        action=action,
        action_input=action_input,
        answer=answer,
    )


def extract_first_json_object(text: str) -> str:
    stripped = text.strip()
    start = stripped.find("{")

    if start == -1:
        raise ValueError(f"Could not find JSON object in model output: {text}")

    decoder = json.JSONDecoder()

    try:
        _, end = decoder.raw_decode(stripped[start:])
    except json.JSONDecodeError as error:
        raise ValueError(f"Invalid JSON object in model output: {text}") from error

    return stripped[start : start + end]


def create_json_repair_observation(error: ValueError, original_prompt: str) -> str:
    return (
        f"Your previous response was invalid. Error: {error}\n\n"
        f"Original user question:\n{original_prompt}\n\n"
        "Return only one valid JSON object.\n\n"
        "Use this schema for a final answer:\n"
        '{"action":"final","action_input":null,"answer":"..."}\n\n'
        "Use this schema for calculator:\n"
        '{"action":"calculator","action_input":"2 + 2","answer":null}\n\n'
        "Do not return plain text. Do not return multiple JSON objects."
    )


def require_final_answer(decision: AgentDecision) -> str:
    if decision.answer is None:
        raise ValueError("Final action requires a non-null answer.")

    return decision.answer.strip()


def require_action_input(decision: AgentDecision) -> str:
    if decision.action_input is None:
        raise ValueError(f"Action {decision.action} requires a non-null action_input.")

    return decision.action_input.strip()


def evaluate_math_expression(expression: str) -> float:
    try:
        tree = ast.parse(expression, mode="eval")
    except SyntaxError as error:
        raise ValueError(
            f"Invalid expression: {expression}. Expected a numeric expression."
        ) from error

    return evaluate_ast_node(tree.body)


def evaluate_ast_node(node: ast.AST) -> float:
    binary_operators: dict[type[ast.operator], Callable[[float, float], float]] = {
        ast.Add: operator.add,
        ast.Sub: operator.sub,
        ast.Mult: operator.mul,
        ast.Div: operator.truediv,
        ast.FloorDiv: operator.floordiv,
        ast.Mod: operator.mod,
        ast.Pow: safe_power,
    }

    unary_operators: dict[type[ast.unaryop], Callable[[float], float]] = {
        ast.UAdd: operator.pos,
        ast.USub: operator.neg,
    }

    if isinstance(node, ast.Constant):
        return evaluate_constant(node)

    if isinstance(node, ast.BinOp):
        left = evaluate_ast_node(node.left)
        right = evaluate_ast_node(node.right)
        operator_type = type(node.op)
        operation = binary_operators.get(operator_type)

        if operation is None:
            raise ValueError(
                f"Unsupported binary operator: {operator_type.__name__}. "
                "Expected one of +, -, *, /, //, %, **."
            )

        return operation(left, right)

    if isinstance(node, ast.UnaryOp):
        value = evaluate_ast_node(node.operand)
        operator_type = type(node.op)
        operation = unary_operators.get(operator_type)

        if operation is None:
            raise ValueError(
                f"Unsupported unary operator: {operator_type.__name__}. "
                "Expected + or -."
            )

        return operation(value)

    raise ValueError(
        f"Unsupported expression node: {type(node).__name__}. "
        "Expected a safe numeric expression."
    )


def evaluate_constant(node: ast.Constant) -> float:
    value = node.value

    if isinstance(value, bool):
        raise ValueError(f"Unsupported boolean value: {value}. Expected a number.")

    if isinstance(value, int | float):
        return float(value)

    raise ValueError(f"Unsupported constant value: {value}. Expected a number.")


def safe_power(left: float, right: float) -> float:
    if abs(left) > 1_000_000:
        raise ValueError(f"Power base too large: {left}. Expected <= 1000000.")

    if abs(right) > 12:
        raise ValueError(f"Power exponent too large: {right}. Expected <= 12.")

    return operator.pow(left, right)


def format_number(value: float) -> str:
    if value.is_integer():
        return str(int(value))

    return str(value)


def create_client(config: AppConfig) -> LocalLlamaClient:
    settings = LocalLlamaSettings(
        model_path=config.model_path,
        context_size=config.context_size,
        thread_count=config.thread_count,
        gpu_layer_count=config.gpu_layer_count,
        temperature=config.temperature,
        max_tokens=config.max_tokens,
    )

    return LocalLlamaClient(settings)


def print_result(result: AgentResult) -> None:
    print(result.answer)
    print(f"\nElapsed: {result.elapsed_seconds:.2f}s")

    if len(result.steps) == 0:
        return

    print("\nAgent steps:")

    for step in result.steps:
        print(f"\nStep {step.iteration}")
        print(f"Action: {step.action}")
        print(f"Observation: {step.observation}")


def main() -> None:
    config = parse_args()
    client = create_client(config)

    agent = SimpleAgent(
        client=client,
        calculator=CalculatorTool(),
        max_iterations=config.max_iterations,
    )

    result = agent.run(config.prompt)
    print_result(result)


if __name__ == "__main__":
    main()
