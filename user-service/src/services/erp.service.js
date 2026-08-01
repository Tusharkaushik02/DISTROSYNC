const prisma = require("../config/prisma");

const createERPConfig = async (userId, configData) => {

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

    // 3. Check if company already has ERP configuration
    const existingConfig = await prisma.eRPConfiguration.findUnique({
        where: {
            companyId: existingUser.companyId
        }
    });

    if (existingConfig) {
        throw new Error("ERP configuration already exists");
    }

    // 4. Validate configuration
    if (
        !configData.erpType ||
        !configData.pluginName ||
        !configData.connectionConfig
    ) {
        throw new Error("Invalid ERP configuration.");
    }

    // 5. Create ERP configuration
    const config = await prisma.eRPConfiguration.create({
        data: {
            companyId: existingUser.companyId,
            erpType: configData.erpType,
            pluginName: configData.pluginName,
            connectionConfig: configData.connectionConfig
        }
    });

    // 6. Return configuration
    return config;
};

const getERPConfig = async (userId) => {

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

    // 3. Find configuration
    const config = await prisma.eRPConfiguration.findUnique({
        where: {
            companyId: existingUser.companyId
        }
    });

    if (!config) {
        throw new Error("ERP configuration not found");
    }

    return config;
};

const updateERPConfig = async (userId, configData) => {

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
    const existingConfig = await prisma.eRPConfiguration.findUnique({
        where: {
            companyId: existingUser.companyId
        }
    });

    if (!existingConfig) {
        throw new Error("ERP configuration not found");
    }

    // 4. Build update object
    const updateData = {};

    if (configData.erpType)
        updateData.erpType = configData.erpType;

    if (configData.pluginName)
        updateData.pluginName = configData.pluginName;

    if (configData.connectionConfig)
        updateData.connectionConfig = configData.connectionConfig;

    // 5. Update configuration
    const updatedConfig = await prisma.eRPConfiguration.update({
        where: {
            companyId: existingUser.companyId
        },
        data: updateData
    });

    return updatedConfig;
};

const deleteERPConfig = async (userId) => {

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
    const existingConfig = await prisma.eRPConfiguration.findUnique({
        where: {
            companyId: existingUser.companyId
        }
    });

    if (!existingConfig) {
        throw new Error("ERP configuration not found");
    }

    // 4. Delete configuration
    await prisma.eRPConfiguration.delete({
        where: {
            companyId: existingUser.companyId
        }
    });

    return {
        message: "ERP configuration deleted successfully"
    };
};

module.exports = {
    createERPConfig,
    getERPConfig,
    updateERPConfig,
    deleteERPConfig
};