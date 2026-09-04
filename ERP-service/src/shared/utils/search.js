const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(value) {
    return UUID_PATTERN.test(String(value || '').trim());
}

module.exports = {
    isValidUuid
};