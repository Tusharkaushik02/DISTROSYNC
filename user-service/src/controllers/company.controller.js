const companyService = require("../services/company.service");

const createCompany = async (req, res) => {
    try {
        const company = await companyService.createCompany(req.user.id, req.body);

        return res.status(201).json({
            success: true,
            message: "Company created successfully",
            data: company
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
};

const getCompany = async (req, res) => {
    try {
        const company = await companyService.getCompany(req.user.id, req.params.companyId);

        return res.status(200).json({
            success: true,
            data: company
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
};

const updateCompany = async (req, res) => {
    try {
        const company = await companyService.updateCompany(req.user.id, req.body, req.params.companyId);

        return res.status(200).json({
            success: true,
            message: "Company updated successfully",
            data: company
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
};

const deleteCompany = async (req, res) => {
    try {
        await companyService.deleteCompany(req.user.id, req.params.companyId);

        return res.status(200).json({
            success: true,
            message: "Company deleted successfully"
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message
        });
    }
};

module.exports = {
    createCompany,
    getCompany,
    updateCompany,
    deleteCompany
};