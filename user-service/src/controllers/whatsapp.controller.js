const whatsappService = require("../services/whatsapp.service");

const createWhatsAppConfig = async (req, res) => {
    try {

        const config = await whatsappService.createWhatsAppConfig(
            req.user.id,
            req.body
        );

        return res.status(201).json({
            success: true,
            message: "WhatsApp configuration created successfully",
            data: config
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
};

const getWhatsAppConfig = async (req, res) => {
    try {

        const config = await whatsappService.getWhatsAppConfig(
            req.user.id
        );

        return res.status(200).json({
            success: true,
            data: config
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
};

const updateWhatsAppConfig = async (req, res) => {
    try {

        const config = await whatsappService.updateWhatsAppConfig(
            req.user.id,
            req.body
        );

        return res.status(200).json({
            success: true,
            message: "WhatsApp configuration updated successfully",
            data: config
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
};

const deleteWhatsAppConfig = async (req, res) => {
    try {

        await whatsappService.deleteWhatsAppConfig(
            req.user.id
        );

        return res.status(200).json({
            success: true,
            message: "WhatsApp configuration deleted successfully"
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
};

module.exports = {
    createWhatsAppConfig,
    getWhatsAppConfig,
    updateWhatsAppConfig,
    deleteWhatsAppConfig
};