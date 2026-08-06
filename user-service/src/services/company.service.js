const prisma = require("../config/prisma")


const createCompany = async (userId, companyData) => {

    const {
        companyName,
        address,
        contactEmail,
        contactPhone,
    } = companyData;

    const cleanCompanyName = companyName ? companyName.trim() : "";

    // 1. Validate company information
    if (
        !companyName ||
        cleanCompanyName.length < 3 ||
        cleanCompanyName.length > 100 ||
        (contactEmail &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) ||
        (contactPhone &&
            !/^[0-9]{10}$/.test(contactPhone))
    ) {
        throw new Error("Invalid company information.");
    }

    // 2. Execute database transaction
    const company = await prisma.$transaction(async (tx) => {

        // Check if user exists
        const existingUser = await tx.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                companyId: true
            }
        });

        if (!existingUser) {
            throw new Error("User not found");
        }

        // Check if user already belongs to a company
        if (existingUser.companyId) {
            throw new Error("User already belongs to a company");
        }

        // Create Company
        const newCompany = await tx.company.create({
            data: {
                companyName: cleanCompanyName,
                address,
                contactEmail,
                contactPhone,
            }
        });

        // Link Company with User
        await tx.user.update({
            where: {
                id: userId
            },
            data: {
                companyId: newCompany.id
            }
        });

        return newCompany;
    });

    // 3. Return newly created company
    return company;

}



const getCompany = async (userId, companyId) => {

    // 1. Find user
    const existingUser = await prisma.user.findUnique({
        where: {
            id: userId
        }
    });

    if (!existingUser) {
        throw new Error("User not found");
    }

    // 2. Check companyId
    if (!existingUser.companyId) {
        throw new Error("User does not belong to any company");
    }

    // 3. Get company
    const company = await prisma.company.findUnique({
        where: {
            id: existingUser.companyId
        }
    });

    // 4. Check company exists
    if (!company) {
        throw new Error("Company not found");
    }

    // 5. Return company
    return company;
};

const updateCompany = async (userId, companyData, companyId) => {

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

    // 3. Validate company data
    if (
        companyData.companyName &&
        (
            companyData.companyName.trim().length < 3 ||
            companyData.companyName.trim().length > 100
        )
    ) {
        throw new Error("Company name must be between 3 and 100 characters.");
    }

    if (
        companyData.contactEmail &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyData.contactEmail)
    ) {
        throw new Error("Invalid email.");
    }

    if (
        companyData.contactPhone &&
        !/^[0-9]{10}$/.test(companyData.contactPhone)
    ) {
        throw new Error("Invalid phone number.");
    }

    // 4. Update Company
    const updatedCompany = await prisma.company.update({
        where: {
            id: existingUser.companyId
        },
        data: {
            companyName: companyData.companyName,
            address: companyData.address,
            contactEmail: companyData.contactEmail,
            contactPhone: companyData.contactPhone
        }
    });

    // 5. Return updated company
    return updatedCompany;
};


const deleteCompany = async (userId, companyId) => {

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

    // 3. Delete company and unlink user
    await prisma.$transaction(async (tx) => {

        // Remove company from user
        await tx.user.update({
            where: {
                id: userId
            },
            data: {
                companyId: null
            }
        });

        // Delete company
        await tx.company.delete({
            where: {
                id: existingUser.companyId
            }
        });

    });

    // 4. Return success
    return {
        message: "Company deleted successfully"
    };
};


module.exports = {
    createCompany,
    getCompany,
    updateCompany,
    deleteCompany
};

