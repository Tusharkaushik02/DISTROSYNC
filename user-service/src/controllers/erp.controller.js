const erpService = require("../services/erp.service");

const createERPConfig = async (req, res) => {
    try {

        const config = await erpService.createERPConfig(
            req.user.id,
            req.body
        );

        return res.status(201).json({
            success: true,
            message: "ERP configuration created successfully",
            data: config
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getERPConfig = async (req, res) => {
    try {

        const config = await erpService.getERPConfig(
            req.user.id
        );

        return res.status(200).json({
            success: true,
            data: config
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const updateERPConfig = async (req, res) => {
    try {

        const config = await erpService.updateERPConfig(
            req.user.id,
            req.body
        );

        return res.status(200).json({
            success: true,
            message: "ERP configuration updated successfully",
            data: config
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const deleteERPConfig = async (req, res) => {
    try {

        await erpService.deleteERPConfig(
            req.user.id
        );

        return res.status(200).json({
            success: true,
            message: "ERP configuration deleted successfully"
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    createERPConfig,
    getERPConfig,
    updateERPConfig,
    deleteERPConfig
};