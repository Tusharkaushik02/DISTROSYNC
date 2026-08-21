/**
 * Event dispatcher — terminal point of the inbound pipeline.
 *
 * Takes a fully classified canonical event and resolves the final
 * dot-notation event identifier (e.g. "message.text", "status").
 *
 * Does NOT invoke handlers. Returns the identified event for downstream consumption.
 */

const { resolveEventString } = require('./event.registry');

/**
 * Dispatch a classified canonical event.
 *
 * @param {object} canonicalEvent — Must have `eventType` and `messageType` set by classifiers.
 * @returns {{ event: string, canonicalEvent: object }}
 */
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
