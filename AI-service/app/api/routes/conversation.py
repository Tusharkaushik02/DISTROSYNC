from fastapi import APIRouter, HTTPException

from app.api.schemas.request import ConversationRequest
from app.api.schemas.response import ConversationResponse
from app.core.exceptions import AIServiceError
from app.orchestration.conversation_orchestrator import conversation_orchestrator

router = APIRouter(prefix="/api/v1/conversation", tags=["conversation"])


@router.post("", response_model=ConversationResponse)
async def generate_conversation_response(request: ConversationRequest):
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=422, detail="Message cannot be empty.")

    print("[AI] Received message")
    try:
        response = await conversation_orchestrator.generate_response(message)
        return ConversationResponse(response=response)
    except AIServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"code": exc.code, "message": exc.message},
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        print(f"[AI] Unexpected conversation error: {exc.__class__.__name__}")
        raise HTTPException(
            status_code=500,
            detail={"code": "INTERNAL_SERVER_ERROR", "message": "An internal AI error occurred."},
        ) from exc
