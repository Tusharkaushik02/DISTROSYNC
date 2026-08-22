// Unified handler result factory
function createHandlerResult({ handled, event, action = null, status, data = {}, error = null }) {
    return {
        handled: Boolean(handled),
        event: event || 'unknown',
        action,
        status,
        data,
        error,
    };
}

module.exports = { createHandlerResult };
