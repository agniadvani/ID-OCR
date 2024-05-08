const sharp = require("sharp")
const { returnJsonError } = require("../error")
const { returnResponseJson, performOcr, cleanString } = require("../utils/utils")
const fs = require("fs")
const getPixels = require("get-pixels")

exports.voterIdOcr = async (req, res) => {
    try {
        const imagePath = `./uploads/${req.file.originalname}`
        const voterIdData = await extractVoterIdData(imagePath)
        return returnResponseJson(res, 200, voterIdData)
    } catch (err) {
        console.log(err)
        return returnJsonError(res, 500, err.message)
    } finally {
        // deleteAllUploadedFiles()
    }
}

async function extractVoterIdData(imagePath) {
    try {
        let image = sharp(imagePath).resize({ fit: "inside", height: 800 }).grayscale()
        fs.writeFileSync("./uploads/grayimage.png", await image.toBuffer(), { encoding: "binary" })
        if (await isImageBlurry(imagePath)) {
            console.log("Image too blurry")
            return null
        }

        let voterId
        let dob
        let sex
        let name
        let fathersName

        let count = 0
        const voterIdRegex = /[A-Z]{3}\d{7}/;
        const dobRegex = /\b\d{2}\/\d{2}\/\d{4}\b/
        while (count < 15 && (!voterId || !dob || !sex || !name)) {
            console.log("Try", count + 1)
            const threshold = 15 * count
            image = image.threshold(threshold)
            fs.writeFileSync("./uploads/grayimage.png", await image.toBuffer(), { encoding: "binary" })
            const { extractedText, confidence } = await performOcr(image);
            console.log("extractedText:", extractedText)

            const voterIdMatch = extractedText.match(voterIdRegex);
            const dobMatch = extractedText.match(dobRegex)

            if (voterIdMatch && !voterId) {
                voterId = voterIdMatch[0];
            }

            if (dobMatch && !dob) {
                dob = dobMatch[0]
            }

            if (!sex) {
                sex = extractedText.toLowerCase().includes("male") ? "Male" : extractedText.toLowerCase().includes("female") ? "Female" : ""
            }

            const extractedArray = extractedText.split("\n")
            console.log("extractedArray:", extractedArray)
            let nameIndex
            extractedArray.forEach((item, i) => {
                if (item.includes("Elect") && item.includes("Nam")) {
                    nameIndex = i
                }
            })
            if (!name && nameIndex > 0) {
                let nameArray = extractedArray[nameIndex].split(" ")
                nameArray = nameArray.filter(item => (!item.includes("Elect") && !item.includes("Name")))
                name = cleanString(nameArray.join(" "))
            }
            count++
        }

        return { voterId, dob, sex, name }
    } catch (err) {
        console.log(err)
        return null
    }
}

function isImageBlurry(imagePath) {
    return new Promise((resolve, reject) => {
        getPixels(imagePath, (err, pixels) => {
            if (err) {
                console.log("Bad image path")
                reject(err)
            }
            resolve(pixels.shape.slice()[0] <= 300)
        })
    })
}

