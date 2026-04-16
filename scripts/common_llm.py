from __future__ import annotations

import json
import os
import time
from typing import Any

DEFAULT_GITHUB_MODELS_URL = "https://models.github.ai/inference/chat/completions"
DEFAULT_GITHUB_MODELS_MODEL = "openai/gpt-4.1"


class LLMError(RuntimeError):
    pass


def resolve_api_url(raw_url: str) -> str:
    url = raw_url.rstrip("/")
    if url.endswith("/chat/completions") or url.endswith("/v1/chat/completions"):
        return url
    if url.endswith("/v1"):
        return f"{url}/chat/completions"
    return f"{url}/v1/chat/completions"


def unwrap_content(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict):
                if "text" in item:
                    parts.append(str(item["text"]))
                else:
                    parts.append(json.dumps(item, ensure_ascii=False))
            else:
                parts.append(str(item))
        return "\n".join(parts)
    return str(content)


def _load_requests():
    try:
        import requests
    except ImportError as exc:
        raise LLMError("The automation scripts require the `requests` package. Install it before running the AI loop.") from exc
    return requests


def call_chat_completion(
    *,
    system_prompt: str,
    user_prompt: str,
    temperature: float | None = None,
    max_tokens: int = 2200,
    timeout_seconds: int = 300,
) -> str:
    requests = _load_requests()

    api_url = os.environ.get("AI_API_URL", "").strip() or DEFAULT_GITHUB_MODELS_URL
    configured_api_key = os.environ.get("AI_API_KEY", "").strip()
    api_key = configured_api_key
    if not api_key or api_key.upper() == "USE_GITHUB_TOKEN":
        api_key = os.environ.get("GITHUB_TOKEN", "").strip()
    model = os.environ.get("AI_MODEL", "").strip() or DEFAULT_GITHUB_MODELS_MODEL

    if not api_key:
        raise LLMError("AI_API_KEY was not set and GITHUB_TOKEN fallback was unavailable.")

    if temperature is None:
        raw_temperature = os.environ.get("AI_TEMPERATURE", "0.2").strip() or "0.2"
        temperature = float(raw_temperature)

    payload = {
        "model": model,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }

    resolved_url = resolve_api_url(api_url)
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    if "models.github.ai" in resolved_url:
        headers["Accept"] = "application/vnd.github+json"
        headers["X-GitHub-Api-Version"] = "2022-11-28"

    max_attempts = 5

    for attempt in range(1, max_attempts + 1):
        try:
            response = requests.post(
                resolved_url,
                headers=headers,
                json=payload,
                timeout=timeout_seconds,
            )
        except requests.RequestException as exc:
            if attempt == max_attempts:
                raise LLMError(f"AI request failed: {exc}") from exc
            time.sleep(min(30, 3 * attempt))
            continue

        if response.status_code == 429 or response.status_code >= 500:
            if attempt == max_attempts:
                raise LLMError(f"AI request failed with HTTP {response.status_code}: {response.text}")
            retry_after = response.headers.get("Retry-After")
            try:
                sleep_seconds = int(retry_after) if retry_after else 0
            except ValueError:
                sleep_seconds = 0
            time.sleep(sleep_seconds or min(60, 5 * (2 ** (attempt - 1))))
            continue

        if not response.ok:
            raise LLMError(f"AI request failed with HTTP {response.status_code}: {response.text}")

        try:
            parsed = response.json()
            content = unwrap_content(parsed["choices"][0]["message"]["content"]).strip()
        except (ValueError, KeyError, IndexError, TypeError) as exc:
            raise LLMError(f"Unexpected AI response payload: {response.text}") from exc

        if not content:
            raise LLMError("AI response content was empty.")
        return content

    raise LLMError("AI request exhausted retries without a response.")
