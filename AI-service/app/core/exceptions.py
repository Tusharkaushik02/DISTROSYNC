class AIServiceError(Exception):
    status_code = 500
    code = "AI_SERVICE_ERROR"

    def __init__(self, message: str, *, details: dict | None = None):
        super().__init__(message)
        self.message = message
        self.details = details


class LLMConfigurationError(AIServiceError):
    status_code = 500
    code = "LLM_CONFIGURATION_ERROR"


class LLMAuthenticationError(AIServiceError):
    status_code = 502
    code = "LLM_AUTHENTICATION_ERROR"


class LLMTimeoutError(AIServiceError):
    status_code = 504
    code = "LLM_TIMEOUT"


class LLMProviderError(AIServiceError):
    status_code = 502
    code = "LLM_PROVIDER_ERROR"


class LLMResponseError(AIServiceError):
    status_code = 502
    code = "LLM_RESPONSE_ERROR"


class ERPServiceError(AIServiceError):
    status_code = 502
    code = "ERP_SERVICE_ERROR"

    def __init__(self, message: str, *, error_code: str = "ERP_UNAVAILABLE", status_code: int = 502, details: dict | None = None):
        super().__init__(message, details=details)
        self.code = error_code
        self.status_code = status_code


class ToolExecutionError(AIServiceError):
    status_code = 400
    code = "TOOL_EXECUTION_ERROR"

    def __init__(self, message: str, *, tool_name: str, error_code: str = "TOOL_ERROR", details: dict | None = None):
        super().__init__(message, details=details)
        self.tool_name = tool_name
        self.code = error_code
