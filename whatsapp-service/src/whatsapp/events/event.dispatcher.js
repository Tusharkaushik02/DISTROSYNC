const { resolveEventString } = require('./event.registry');

// Dispatch a classified canonical event to its event identifier
function dispatch(canonicalEvent) {
    const { eventType, messageType } = canonicalEvent;

    const event = resolveEventString(eventType, messageType);

    return {
        event,
        canonicalEvent,
    };
}

module.exports = {
    dispatch,
};
