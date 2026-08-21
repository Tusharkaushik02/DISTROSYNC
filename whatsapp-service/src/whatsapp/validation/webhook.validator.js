// Webhook payload validation runner
const { detectWebhookType, getSchemaForType } = require('./webhook.schema');

// Validate Twilio webhook request body against Zod schemas
function validate(reqBody) {
    if (!reqBody || typeof reqBody !== 'object' || Object.keys(reqBody).length === 0) {
        return {
            valid: false,
            errors: [
                {
                    field: '_body',
                    code: 'EMPTY_BODY',
                    message: 'Request body is empty or not an object',
                },
            ],
        };
    }

    const webhookType = detectWebhookType(reqBody);
    const schema = getSchemaForType(webhookType);

    const result = schema.safeParse(reqBody);

    if (result.success) {
        return {
            valid: true,
            data: result.data,
            webhookType,
        };
    }

    // Transform Zod errors into our structured format
    const errors = result.error.issues.map((issue) => {
        const field = issue.path.length > 0 ? issue.path.join('.') : '_unknown';

        let code;
        if (issue.code === 'invalid_type' && issue.received === 'undefined') {
            code = 'MISSING_FIELD';
        } else if (issue.code === 'too_small' && issue.minimum === 1) {
            code = 'EMPTY_FIELD';
        } else if (issue.code === 'invalid_string') {
            code = 'INVALID_FORMAT';
        } else if (issue.code === 'custom') {
            code = 'INVALID_VALUE';
        } else {
            code = 'VALIDATION_FAILED';
        }

        return {
            field,
            code,
            message: issue.message,
        };
    });

    return {
        valid: false,
        errors,
    };
}

module.exports = {
    validate,
};
