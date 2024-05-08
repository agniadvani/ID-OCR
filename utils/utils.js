const getPixels = require("get-pixels")
const fs = require("fs")

exports.cleanString = (str) => {
    str = str.replace(/[^a-zA-Z\s]/g, '').trim();
    str = str.split(" ").filter(item => item.charCodeAt(0) && item.charCodeAt(0) > 64 && item.charCodeAt(0) < 91)
    str = str.join(" ")
    return str
}

exports.isImageBlurry = (imagePath, resolution) => {
    return new Promise((resolve, reject) => {
        getPixels(imagePath, (err, pixels) => {
            if (err) {
                console.log("Bad image path")
                reject(err)
            }
            resolve(pixels.shape.slice()[0] <= resolution)
        })
    })
}

exports.deleteAllUploadedFiles = () => {
    fs.readdirSync("./uploads").forEach(item => {
        fs.rmSync(`./uploads/${item}`)
    })
}