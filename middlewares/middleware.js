const { returnJsonError } = require("../error")
const { isImageBlurry } = require("../utils/utils")

exports.blurryImageFilter = async (req, res, next) => {
    try {
        if (!req.file) {
            return returnJsonError(res, 400, "Please Upload Image")
        }

        const imagePath = `./uploads/${req.file.originalname}`

        if (await isImageBlurry(imagePath, 600)) {
            console.log("Image is blurry")
            return returnJsonError(res, 400, "Image is too blurry, upload a higher quality image.")
        }

        next()
    } catch (err) {
        console.log(err)
        return returnJsonError(res, 500, err.message)
    }
}