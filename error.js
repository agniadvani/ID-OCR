exports.returnJsonError = function (res, status, message) {
    return res.status(status).json({
        success: false,
        status: status,
        error: message
    })
}