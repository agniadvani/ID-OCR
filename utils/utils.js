const getPixels = require("get-pixels")
const fs = require("fs")
const { createWorker } = require("tesseract.js")

exports.cleanString = (str) => {
    str = str.replace(/[^a-zA-Z\s]/g, '').trim();
    str = str.split(" ").filter(item => item.charCodeAt(0) && item.charCodeAt(0) > 64 && item.charCodeAt(0) < 91)
    str = str.join(" ")
    return str
}

exports.deleteAllUploadedFiles = () => {
    fs.readdirSync("./uploads").forEach(item => {
        fs.rmSync(`./uploads/${item}`)
    })
}

exports.returnResponseJson = (res, status, data) => {
    return res.status(status).json({ success: true, status: status, data: data })
}

exports.performOcr = async (image) => {
    try {
        const worker = await createWorker(['eng']);
        const { data: { text, confidence } } = await worker.recognize(await image.toBuffer());
        await worker.terminate();
        return { extractedText: text.trim(), confidence: confidence };
    } catch (err) {
        console.log(err)
        return null
    }
}