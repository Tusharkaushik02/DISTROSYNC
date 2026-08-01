const prisma = require("../config/prisma");

const createWhatsAppConfig = async (userId, configData) => {

    // 1. Check if user exists
    const existingUser = await prisma.user.findUnique({
        where: {
            id: userId
        }
    });

    if (!existingUser) {
        throw new Error("User not found");
    }

    // 2. Check if user belongs to a company
    if (!existingUser.companyId) {
        throw new Error("User does not belong to any company");
    }

    // 3. Check if company already has WhatsApp configuration
    const existingConfig = await prisma.whatsAppConfiguration.findUnique({
        where: {
            companyId: existingUser.companyId
        }
    });

    if (existingConfig) {
        throw new Error("WhatsApp configuration already exists");
    }

    // 4. Validate configuration
    if (
        !configData.businessAccountId ||
        !configData.phoneNumberId ||
        !configData.accessToken ||
        !configData.webhookVerifyToken ||
        !configData.webhookSecret
    ) {
        throw new Error("Invalid WhatsApp configuration.");
    }

    // 5. Create configuration
    const config = await prisma.whatsAppConfiguration.create({
        data: {
            companyId: existingUser.companyId,
            businessAccountId: configData.businessAccountId,
            phoneNumberId: configData.phoneNumberId,
            accessToken: configData.accessToken,
            webhookVerifyToken: configData.webhookVerifyToken,
            webhookSecret: configData.webhookSecret
        }
    });

    // 6. Return configuration
    return config;
};

const getWhatsAppConfig = async (userId) => {

    // 1. Check if user exists
    const existingUser = await prisma.user.findUnique({
        where: {
            id: userId
        }
    });

    if (!existingUser) {
        throw new Error("User not found");
    }

    // 2. Check company
    if (!existingUser.companyId) {
        throw new Error("User does not belong to any company");
    }

    // 3. Find configuration
    const config = await prisma.whatsAppConfiguration.findUnique({
        where: {
            companyId: existingUser.companyId
        }
    });

    if (!config) {
        throw new Error("WhatsApp configuration not found");
    }

    return config;
};

const updateWhatsAppConfig = async (userId, configData) => {

    // 1. Check user
    const existingUser = await prisma.user.findUnique({
        where: {
            id: userId
        }
    });

    if (!existingUser) {
        throw new Error("User not found");
    }

    // 2. Check company
    if (!existingUser.companyId) {
        throw new Error("User does not belong to any company");
    }

    // 3. Check configuration
    const existingConfig = await prisma.whatsAppConfiguration.findUnique({
        where: {
            companyId: existingUser.companyId
        }
    });

    if (!existingConfig) {
        throw new Error("WhatsApp configuration not found");
    }

    // 4. Build update object
    const updateData = {};

    if (configData.businessAccountId)
        updateData.businessAccountId = configData.businessAccountId;

    if (configData.phoneNumberId)
        updateData.phoneNumberId = configData.phoneNumberId;

    if (configData.accessToken)
        updateData.accessToken = configData.accessToken;

    if (configData.webhookVerifyToken)
        updateData.webhookVerifyToken = configData.webhookVerifyToken;

    if (configData.webhookSecret)
        updateData.webhookSecret = configData.webhookSecret;

    // 5. Update configuration
    const updatedConfig = await prisma.whatsAppConfiguration.update({
        where: {
            companyId: existingUser.companyId
        },
        data: updateData
    });

    return updatedConfig;
};

const deleteWhatsAppConfig = async (userId) => {

    // 1. Check user
    const existingUser = await prisma.user.findUnique({
        where: {
            id: userId
        }
    });

    if (!existingUser) {
        throw new Error("User not found");
    }

    // 2. Check company
    if (!existingUser.companyId) {
        throw new Error("User does not belong to any company");
    }

    // 3. Check configuration
    const existingConfig = await prisma.whatsAppConfiguration.findUnique({
        where: {
            companyId: existingUser.companyId
        }
    });

    if (!existingConfig) {
        throw new Error("WhatsApp configuration not found");
    }

    // 4. Delete configuration
    await prisma.whatsAppConfiguration.delete({
        where: {
            companyId: existingUser.companyId
        }
    });

    return {
        message: "WhatsApp configuration deleted successfully"
    };
};

module.exports = {
    createWhatsAppConfig,
    getWhatsAppConfig,
    updateWhatsAppConfig,
    deleteWhatsAppConfig
};