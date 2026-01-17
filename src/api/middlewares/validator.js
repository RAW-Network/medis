const { isUuid } = require('../../utils/security');
const CustomError = require('../../utils/CustomError');

exports.validateId = (req, res, next) => {
    const { id } = req.params;
    if (!isUuid(id)) {
        return next(new CustomError('Invalid ID format', 400));
    }
    next();
};