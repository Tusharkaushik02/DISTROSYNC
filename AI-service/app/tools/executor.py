import hashlib
import inspect
import json
import logging
import time
from typing import Any
from pydantic import ValidationError

from app.core.exceptions import ERPServiceError
from app.tools.registry import tool_registry
from app.tools.schemas import ToolResult

logger = logging.getLogger(__name__)

# Simple in-memory LRU/TTL cache for idempotency of write operations
_IDEMPOTENCY_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_IDEMPOTENCY_TTL_SECONDS = 300.0  # 5 minutes


def _clean_idempotency_cache():
    now = time.time()
    expired_keys = [k for k, (ts, _) in _IDEMPOTENCY_CACHE.items() if now - ts > _IDEMPOTENCY_TTL_SECONDS]
    for k in expired_keys:
        _IDEMPOTENCY_CACHE.pop(k, None)


class ToolExecutor:
    """Safely validates and executes tools called by the LLM."""

    def __init__(self, registry=tool_registry):
        self.registry = registry

    async def execute(
        self,
        tool_name: str,
        arguments: dict[str, Any] | str,
        tenant_id: str,
        authenticated_customer: dict[str, Any] | None = None,
    ) -> ToolResult:
        """Validate and execute a tool with the authenticated tenant context."""
        start_time = time.time()
        logger.info("[ToolExecutor] START tool=%s tenant=%s customer=%s", tool_name, tenant_id, authenticated_customer.get("id") if authenticated_customer else "None")

        # 1. Parse string arguments if received as JSON string
        if isinstance(arguments, str):
            try:
                parsed_args = json.loads(arguments) if arguments.strip() else {}
            except json.JSONDecodeError as exc:
                logger.warning("[ToolExecutor] Invalid JSON arguments for %s: %s", tool_name, exc)
                return ToolResult.fail(
                    tool_name=tool_name,
                    code="INVALID_ARGUMENTS_JSON",
                    message=f"Arguments for tool '{tool_name}' must be valid JSON: {str(exc)}",
                )
        elif isinstance(arguments, dict):
            parsed_args = arguments
        else:
            return ToolResult.fail(
                tool_name=tool_name,
                code="INVALID_ARGUMENTS_TYPE",
                message=f"Arguments for tool '{tool_name}' must be a dictionary or JSON string.",
            )

        # 2. Check if tool is registered
        tool_def = self.registry.get_tool(tool_name)
        executor_fn = self.registry.get_executor(tool_name)

        if not tool_def or not executor_fn:
            logger.warning("[ToolExecutor] Unknown tool requested: %s", tool_name)
            return ToolResult.fail(
                tool_name=tool_name,
                code="UNKNOWN_TOOL",
                message=f"Tool '{tool_name}' is not recognized. Please use one of the available tools.",
            )

        # 3. Validate arguments against Pydantic schema
        try:
            validated_args = tool_def.args_schema(**parsed_args)
        except ValidationError as exc:
            errors = exc.errors()
            field_errors = [
                {"field": ".".join(str(loc) for loc in err["loc"]), "message": err["msg"]}
                for err in errors
            ]
            logger.warning("[ToolExecutor] Schema validation failed for %s: %s", tool_name, field_errors)
            return ToolResult.fail(
                tool_name=tool_name,
                code="INVALID_TOOL_ARGUMENTS",
                message=f"Validation failed for tool '{tool_name}' arguments.",
                details={"errors": field_errors},
            )

        # 4. Handle Idempotency for write tools
        idempotency_key = None
        if tool_def.category == "write":
            _clean_idempotency_cache()
            # Generate deterministic idempotency hash based on tenant, customer, tool, and args
            cust_id = (authenticated_customer or {}).get("id", "anon")
            args_hash = hashlib.sha256(
                f"{tenant_id}:{cust_id}:{tool_name}:{json.dumps(validated_args.model_dump(), sort_keys=True)}".encode()
            ).hexdigest()
            idempotency_key = f"idemp_{args_hash[:24]}"

            if idempotency_key in _IDEMPOTENCY_CACHE:
                _, cached_result = _IDEMPOTENCY_CACHE[idempotency_key]
                logger.info("[ToolExecutor] Idempotent hit for %s (key=%s)", tool_name, idempotency_key)
                return ToolResult.ok(tool_name=tool_name, data=cached_result)

        # 5. Execute tool with tenant context and authenticated customer
        try:
            call_kwargs = {
                "args": validated_args,
                "tenant_id": tenant_id,
            }
            try:
                sig = inspect.signature(executor_fn)
                has_var_kw = any(p.kind == inspect.Parameter.VAR_KEYWORD for p in sig.parameters.values())
                if has_var_kw or "authenticated_customer" in sig.parameters:
                    call_kwargs["authenticated_customer"] = authenticated_customer
                if has_var_kw or "idempotency_key" in sig.parameters:
                    call_kwargs["idempotency_key"] = idempotency_key
            except (ValueError, TypeError):
                call_kwargs["authenticated_customer"] = authenticated_customer
                call_kwargs["idempotency_key"] = idempotency_key

            result = await executor_fn(**call_kwargs)

            # Cache successful write results
            if tool_def.category == "write" and idempotency_key and result.success:
                _IDEMPOTENCY_CACHE[idempotency_key] = (time.time(), result.data)

            duration = (time.time() - start_time) * 1000
            logger.info(
                "[ToolExecutor] END tool=%s success=%s duration=%.2fms",
                tool_name,
                result.success,
                duration,
            )
            return result

        except ERPServiceError as exc:
            duration = (time.time() - start_time) * 1000
            logger.warning(
                "[ToolExecutor] ERP error in %s: code=%s message=%s duration=%.2fms",
                tool_name,
                exc.code,
                exc.message,
                duration,
            )
            return ToolResult.fail(
                tool_name=tool_name,
                code=exc.code,
                message=exc.message,
                details=exc.details,
            )
        except Exception as exc:
            duration = (time.time() - start_time) * 1000
            logger.error(
                "[ToolExecutor] Unhandled exception in %s: %s duration=%.2fms",
                tool_name,
                exc,
                duration,
                exc_info=True,
            )
            return ToolResult.fail(
                tool_name=tool_name,
                code="INTERNAL_TOOL_ERROR",
                message=f"An unexpected error occurred executing tool '{tool_name}'.",
            )


tool_executor = ToolExecutor()
