"""Ollama AI service for parsing and categorization."""

import json
from typing import Any

import httpx
from pydantic import BaseModel

from app.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class OllamaError(Exception):
    """Exception raised for Ollama-related errors."""

    pass


class OllamaResponse(BaseModel):
    """Response from Ollama API."""

    model: str
    response: str
    done: bool


class OllamaService:
    """
    Service for interacting with Ollama LLM.

    Provides methods for:
    - Transaction parsing from SMS/email text
    - Vendor categorization suggestions
    - Chat Q&A about spending
    - Report narrative generation
    """

    def __init__(
        self,
        base_url: str | None = None,
        model: str | None = None,
        timeout: float | None = None,
        num_thread: int | None = None,
    ):
        """
        Initialize Ollama service.

        Args:
            base_url: Ollama API base URL (defaults to settings)
            model: Model name to use (defaults to settings)
            timeout: Request timeout in seconds (defaults to settings)
            num_thread: Number of CPU threads for inference (defaults to settings)
        """
        self.base_url = (base_url or settings.ollama_base_url or "").rstrip("/")
        self.model = model or settings.ollama_model or "llama3"
        self.timeout = timeout or settings.ollama_timeout
        self.num_thread = num_thread or settings.ollama_num_thread
        self._client: httpx.Client | None = None

    @property
    def is_configured(self) -> bool:
        """Check if Ollama is configured."""
        return bool(self.base_url)

    def _get_client(self) -> httpx.Client:
        """Get or create HTTP client."""
        if self._client is None:
            self._client = httpx.Client(timeout=self.timeout)
        return self._client

    async def _get_async_client(self) -> httpx.AsyncClient:
        """Get async HTTP client."""
        return httpx.AsyncClient(timeout=self.timeout)

    def check_connection(self) -> dict[str, Any]:
        """
        Check connection to Ollama server.

        Returns:
            Dict with connection status and available models
        """
        if not self.is_configured:
            return {
                "connected": False,
                "error": "Ollama base URL not configured",
                "models": [],
            }

        try:
            client = self._get_client()
            response = client.get(f"{self.base_url}/api/tags")
            response.raise_for_status()
            data = response.json()
            models = [m.get("name", "") for m in data.get("models", [])]
            return {
                "connected": True,
                "models": models,
                "configured_model": self.model,
                "model_available": self.model in models or any(
                    m.startswith(self.model.split(":")[0]) for m in models
                ),
            }
        except httpx.ConnectError as e:
            return {
                "connected": False,
                "error": f"Connection failed: {str(e)}",
                "models": [],
            }
        except Exception as e:
            return {
                "connected": False,
                "error": f"Error: {str(e)}",
                "models": [],
            }

    def generate(
        self,
        prompt: str,
        system: str | None = None,
        temperature: float = 0.1,
        model: str | None = None,
    ) -> str:
        """
        Generate text completion from Ollama.

        Args:
            prompt: The prompt to send
            system: Optional system prompt
            temperature: Sampling temperature (lower = more deterministic)
            model: Override model for this request

        Returns:
            Generated text response
        """
        if not self.is_configured:
            raise OllamaError("Ollama is not configured")

        client = self._get_client()
        options = {
            "temperature": temperature,
        }
        # Add num_thread if configured (critical for remote Ollama instances)
        if self.num_thread:
            options["num_thread"] = self.num_thread

        payload = {
            "model": model or self.model,
            "prompt": prompt,
            "stream": False,
            "options": options,
        }

        if system:
            payload["system"] = system

        try:
            response = client.post(
                f"{self.base_url}/api/generate",
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            return data.get("response", "")
        except httpx.HTTPStatusError as e:
            raise OllamaError(f"HTTP error: {e.response.status_code}") from e
        except httpx.ConnectError as e:
            raise OllamaError(f"Connection failed: {str(e)}") from e
        except Exception as e:
            raise OllamaError(f"Generation failed: {str(e)}") from e

    def generate_json(
        self,
        prompt: str,
        schema: dict[str, Any],
        system: str | None = None,
        temperature: float = 0.1,
        model: str | None = None,
    ) -> dict[str, Any]:
        """
        Generate JSON response from Ollama with schema validation.

        Args:
            prompt: The prompt to send
            schema: JSON schema for validation
            system: Optional system prompt
            temperature: Sampling temperature
            model: Override model for this request

        Returns:
            Parsed JSON dict
        """
        # Build JSON-focused prompt
        schema_str = json.dumps(schema, indent=2)
        json_prompt = f"""{prompt}

You MUST respond with valid JSON matching this schema:
{schema_str}

Respond ONLY with the JSON object, no other text or markdown."""

        json_system = system or "You are a precise data extraction assistant. Always respond with valid JSON only."

        response = self.generate(
            prompt=json_prompt,
            system=json_system,
            temperature=temperature,
            model=model,
        )

        # Parse JSON from response
        return self._parse_json_response(response)

    def _parse_json_response(self, response: str) -> dict[str, Any]:
        """
        Parse JSON from LLM response, handling common issues.

        Args:
            response: Raw text response from LLM

        Returns:
            Parsed JSON dict
        """
        # Clean up response
        text = response.strip()

        # Remove markdown code blocks if present
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

        # Try to parse
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # Try to find JSON object in response
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                try:
                    return json.loads(text[start:end])
                except json.JSONDecodeError:
                    pass

            raise OllamaError(f"Failed to parse JSON from response: {text[:200]}")

    def parse_transaction(
        self,
        sender: str,
        body: str,
        observed_at_str: str,
        custom_prompt: str | None = None,
    ) -> dict[str, Any]:
        """
        Parse transaction data from SMS/email body using AI.

        Args:
            sender: Message sender
            body: Message body text
            observed_at_str: ISO format timestamp when message was received
            custom_prompt: Optional custom prompt template (Jinja2 format)
                          Variables: sender, body, observed_at_str

        Returns:
            Parsed transaction data dict
        """
        schema = {
            "type": "object",
            "properties": {
                "amount": {"type": "number", "description": "Transaction amount"},
                "currency": {"type": "string", "description": "ISO currency code (e.g., AED, USD)"},
                "direction": {"type": "string", "enum": ["debit", "credit"]},
                "occurred_at": {"type": "string", "description": "Transaction date/time in ISO format"},
                "vendor_raw": {"type": "string", "description": "Merchant/vendor name"},
                "card_last4": {"type": "string", "description": "Last 4 digits of card if present"},
                "account_tail": {"type": "string", "description": "Account number suffix if present"},
                "available_balance": {"type": "number", "description": "Balance after transaction"},
                "reference_id": {"type": "string", "description": "Transaction reference number"},
            },
            "required": ["amount", "currency", "direction"],
        }

        # Use custom prompt if provided, otherwise use default
        if custom_prompt:
            try:
                from jinja2 import Template
                template = Template(custom_prompt)
                prompt = template.render(
                    sender=sender,
                    body=body,
                    observed_at_str=observed_at_str,
                )
            except Exception as e:
                logger.warning(f"Failed to render custom prompt: {e}, using default")
                custom_prompt = None

        if not custom_prompt:
            prompt = f"""Extract transaction details from this bank SMS/email message.

Sender: {sender}
Received at: {observed_at_str}

Message:
{body}

Extract the transaction details. For 'direction':
- Use "debit" for purchases, withdrawals, payments (money going out)
- Use "credit" for deposits, refunds, incoming transfers (money coming in)

If a field cannot be determined from the message, omit it from the response."""

        system = """You are a financial data extraction assistant. Your job is to accurately extract transaction details from bank SMS and email messages.

Key rules:
1. Extract amounts exactly as shown (e.g., 1,234.56 becomes 1234.56)
2. Use ISO currency codes (AED, USD, EUR, etc.)
3. Parse dates to ISO format (YYYY-MM-DDTHH:MM:SS)
4. Extract vendor names exactly as shown
5. Only include fields that are clearly present in the message
6. Be precise - financial data accuracy is critical"""

        result = self.generate_json(
            prompt=prompt,
            schema=schema,
            system=system,
            temperature=0.1,
        )

        return result

    def suggest_category(
        self,
        vendor_name: str,
        categories: list[dict[str, str]],
        transaction_history: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """
        Suggest a category for a vendor.

        Args:
            vendor_name: Canonical vendor name
            categories: List of available categories with id and name
            transaction_history: Optional recent transactions for context

        Returns:
            Suggestion with category_id, confidence, and rationale
        """
        categories_list = "\n".join(
            f"- {c['id']}: {c['name']}" for c in categories
        )

        history_context = ""
        if transaction_history:
            history_items = [
                f"  - {t.get('amount', 'N/A')} {t.get('currency', 'AED')} on {t.get('date', 'N/A')}"
                for t in transaction_history[:5]
            ]
            history_context = f"\nRecent transactions:\n" + "\n".join(history_items)

        schema = {
            "type": "object",
            "properties": {
                "category_id": {"type": "string", "description": "UUID of suggested category"},
                "confidence": {"type": "number", "description": "Confidence score 0.0 to 1.0"},
                "rationale": {"type": "string", "description": "Brief explanation for the suggestion"},
            },
            "required": ["category_id", "confidence", "rationale"],
        }

        prompt = f"""Suggest a category for this vendor/merchant.

Vendor name: {vendor_name}
{history_context}

Available categories:
{categories_list}

Choose the most appropriate category based on the vendor name and any transaction context.
Return the category ID, your confidence level (0.0-1.0), and a brief rationale."""

        system = """You are a financial categorization assistant. Suggest the most appropriate spending category for vendors based on their name and transaction patterns.

Guidelines:
- Choose the most specific applicable category
- High confidence (>0.8) for clear matches like "CARREFOUR" -> Groceries
- Medium confidence (0.5-0.8) for reasonable assumptions
- Low confidence (<0.5) for unclear vendors
- Explain your reasoning briefly"""

        return self.generate_json(
            prompt=prompt,
            schema=schema,
            system=system,
            temperature=0.2,
        )

    def generate_query_plan(
        self,
        question: str,
        allowed_queries: list[dict[str, Any]],
        data_range: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        """
        Generate a structured query plan for a user question.

        Args:
            question: User's question about their spending
            allowed_queries: List of allowed query types with parameters
            data_range: Optional dict with 'earliest' and 'latest' transaction dates

        Returns:
            Query plan with query type and parameters
        """
        from datetime import date

        queries_desc = json.dumps(allowed_queries, indent=2)
        today = date.today().isoformat()

        schema = {
            "type": "object",
            "properties": {
                "query_type": {"type": "string", "description": "Type of query to execute"},
                "parameters": {"type": "object", "description": "Query parameters"},
                "explanation": {"type": "string", "description": "What this query will find"},
            },
            "required": ["query_type", "parameters", "explanation"],
        }

        data_context = ""
        if data_range:
            data_context = f"\nAvailable data range: {data_range.get('earliest', 'unknown')} to {data_range.get('latest', 'unknown')}"

        prompt = f"""Convert this user question into a structured query plan.

Today's date: {today}{data_context}

User question: {question}

Available query types:
{queries_desc}

Choose the most appropriate query type and fill in the parameters to answer the user's question.
When no specific date is mentioned, use reasonable defaults based on the question context (e.g., "last month" means the previous calendar month, "this year" means {today[:4]})."""

        system = """You are a query planning assistant. Convert natural language questions about spending into structured database queries.

Rules:
1. Choose the most specific query type that answers the question
2. Extract time periods, categories, vendors, amounts from the question
3. Use ISO date formats (YYYY-MM-DD)
4. Be conservative - only query what's needed"""

        return self.generate_json(
            prompt=prompt,
            schema=schema,
            system=system,
            temperature=0.1,
        )

    def summarize_query_results(
        self,
        question: str,
        query_plan: dict[str, Any],
        results: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Generate a natural language summary of query results.

        Args:
            question: Original user question
            query_plan: The executed query plan
            results: Query results data

        Returns:
            Summary with answer text and optional chart suggestion
        """
        schema = {
            "type": "object",
            "properties": {
                "answer": {"type": "string", "description": "Natural language answer"},
                "highlights": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Key points to highlight",
                },
                "chart_type": {
                    "type": "string",
                    "enum": ["bar", "line", "pie", "none"],
                    "description": "Suggested chart visualization",
                },
            },
            "required": ["answer"],
        }

        results_str = json.dumps(results, indent=2, default=str)

        prompt = f"""Summarize these financial query results in natural language.

Original question: {question}

Query executed: {query_plan.get('explanation', 'N/A')}

Results:
{results_str}

Provide a clear, helpful answer to the user's question based on these results.
Include key highlights and suggest a chart type if visualization would be helpful."""

        system = """You are a friendly financial assistant. Explain query results in clear, helpful language.

Guidelines:
1. Answer the specific question asked
2. Highlight notable patterns or amounts
3. Use currency formatting (e.g., AED 1,234.56)
4. Be concise but complete
5. Don't reveal internal database details
6. Suggest charts only when visualization adds value"""

        return self.generate_json(
            prompt=prompt,
            schema=schema,
            system=system,
            temperature=0.3,
        )

    def generate_report_insights(
        self,
        analytics: dict[str, Any],
        period_description: str,
    ) -> dict[str, Any]:
        """
        Generate AI insights for a financial report.

        Args:
            analytics: Aggregated analytics data
            period_description: Human-readable period description

        Returns:
            Insights with narrative text and recommendations
        """
        schema = {
            "type": "object",
            "properties": {
                "summary": {"type": "string", "description": "Brief executive summary"},
                "insights": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Key insights about spending patterns",
                },
                "recommendations": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Actionable recommendations",
                },
                "notable_changes": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Notable changes from previous period",
                },
            },
            "required": ["summary", "insights"],
        }

        analytics_str = json.dumps(analytics, indent=2, default=str)

        prompt = f"""Generate insights for this financial report.

Period: {period_description}

Analytics data:
{analytics_str}

Provide:
1. A brief executive summary (2-3 sentences)
2. Key insights about spending patterns
3. Actionable recommendations (if any)
4. Notable changes from the previous period (if data available)"""

        system = """You are a financial advisor assistant. Generate helpful insights from spending data.

Guidelines:
1. Focus on actionable insights
2. Highlight unusual patterns
3. Compare to previous periods when data available
4. Keep recommendations practical
5. Be encouraging but honest about overspending
6. Use specific numbers to support insights"""

        return self.generate_json(
            prompt=prompt,
            schema=schema,
            system=system,
            temperature=0.4,
        )

    def close(self):
        """Close HTTP client."""
        if self._client:
            self._client.close()
            self._client = None


# Singleton instance
_ollama_service: OllamaService | None = None


def get_ollama_service() -> OllamaService:
    """Get or create Ollama service singleton."""
    global _ollama_service
    if _ollama_service is None:
        _ollama_service = OllamaService()
    return _ollama_service
