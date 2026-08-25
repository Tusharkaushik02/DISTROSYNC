const { z } = require('zod');

const getDocumentByIdSchema = z.object({
    id: z.string().uuid('Document ID must be a valid UUID')
});

const ingestDocumentParamsSchema = z.object({
    id: z.string().uuid('Document ID must be a valid UUID')
});

module.exports = {
    getDocumentByIdSchema,
    ingestDocumentParamsSchema
};
