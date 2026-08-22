const { resolveEventString } = require('./event.registry');
const { textHandler } = require('../handlers/text.handler');
const { buttonHandler } = require('../handlers/button.handler');
const { mediaHandler } = require('../handlers/media.handler');
const { unsupportedHandler } = require('../handlers/unsupported.handler');

// Event string → handler mapping
const HANDLER_REGISTRY = {
    'message.text':        textHandler,
    'interactive.button':  buttonHandler,
    'interactive.list':    buttonHandler,
    'message.image':       mediaHandler,
    'message.audio':       mediaHandler,
    'message.video':       mediaHandler,
    'message.document':    mediaHandler,
    'message.location':    mediaHandler,
    'message.sticker':     mediaHandler,
    'message.contact':     mediaHandler,
    'status':              unsupportedHandler,
    'unknown':             unsupportedHandler,
};

// Dispatch a classified canonical event to its event identifier
function dispatch(canonicalEvent) {
    const { eventType, messageType } = canonicalEvent;

    const event = resolveEventString(eventType, messageType);

    return {
        event,
        canonicalEvent,
    };
}

// Route a dispatch result to the registered handler
function handle(dispatchResult) {
    const handler = HANDLER_REGISTRY[dispatchResult.event] || unsupportedHandler;
    return handler(dispatchResult.canonicalEvent, dispatchResult.event);
}

module.exports = {
    dispatch,
    handle,
    HANDLER_REGISTRY,
};
