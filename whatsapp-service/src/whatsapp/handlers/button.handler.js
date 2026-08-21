// Button/list interactive handler — resolve action from registry
const { createHandlerResult } = require('./handler.result');
const { resolveButtonAction, ACTION_HANDLERS } = require('./button/button.registry');

// Main button handler — handles both button presses and list selections
function buttonHandler(canonicalEvent, event) {
    const raw = (canonicalEvent.metadata && canonicalEvent.metadata.raw) || {};
    const buttonText = raw.ButtonText || null;
    const listId = raw.ListId || null;

    // Resolve the action from registry
    const action = resolveButtonAction(buttonText, listId);

    if (!action) {
        return createHandlerResult({
            handled: false,
            event,
            status: 'rejected',
            error: {
                code: 'UNSUPPORTED_BUTTON',
                message: `Unrecognized button action: ${buttonText || listId || 'unknown'}`,
            },
        });
    }

    if (!action.enabled) {
        return createHandlerResult({
            handled: false,
            event,
            action: action.id,
            status: 'rejected',
            error: {
                code: 'ACTION_DISABLED',
                message: `Action "${action.id}" is currently disabled`,
            },
        });
    }

    // Dispatch to the action handler
    const actionHandler = ACTION_HANDLERS[action.id];

    if (!actionHandler) {
        return createHandlerResult({
            handled: false,
            event,
            action: action.id,
            status: 'rejected',
            error: {
                code: 'ACTION_HANDLER_MISSING',
                message: `No handler registered for action "${action.id}"`,
            },
        });
    }

    const actionResult = actionHandler(canonicalEvent);

    return createHandlerResult({
        handled: true,
        event,
        action: actionResult.action,
        status: actionResult.status,
        data: actionResult.data,
    });
}

module.exports = { buttonHandler };
