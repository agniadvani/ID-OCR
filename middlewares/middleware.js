const { returnJsonError } = require("../error")



exports.uploadFile = (req, res, next) => {
    if (!req.file) {
        return returnJsonError(res, 400, "Please upload an image")
    }
    next()
}