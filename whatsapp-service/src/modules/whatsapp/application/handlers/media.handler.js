// Media handler — reject all media types until processing is implemented
const { createHandlerResult } = require('./handler.result');

// Identify media subtype from canonical event
function identifyMediaType(canonicalEvent) {
    const media = canonicalEvent.content && canonicalEvent.content.media;
    if (!media || media.length === 0) return 'unknown';
    return (media[0].contentType || 'unknown').split('/')[0];
}

// Main media handler — cleanly rejects with media type info
function mediaHandler(canonicalEvent, event) {
    const mediaType = identifyMediaType(canonicalEvent);

    return createHandlerResult({
        handled: false,
        event,
        status: 'rejected',
        data: {
            mediaType,
            mediaCount: canonicalEvent.content && canonicalEvent.content.media
                ? canonicalEvent.content.media.length
                : 0,
        },
        error: {
            code: 'MEDIA_NOT_SUPPORTED',
            message: `Media processing not supported yet (type: ${mediaType})`,
        },
    });
}

module.exports = { mediaHandler, identifyMediaType };
