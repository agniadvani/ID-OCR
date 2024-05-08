const fs = require("fs")
const sharp = require("sharp")
const { createWorker } = require("tesseract.js")
const { returnJsonError } = require("../error")
const { cleanString, isImageBlurry, deleteAllUploadedFiles } = require("../utils/utils")


exports.panOcr = async (req, res) => {
    try {
        const imagePath = `./uploads/${req.file.originalname}`

        const { panNumber, dob } = await extractPANNumberAndDob(imagePath)
        const { name, fatherName } = await extractNameAndFatherNameFromPan(imagePath)

        res.send({ success: true, status: 200, data: { panNumber, dob, name, fatherName } })
    } catch (err) {
        console.log(err)
        return returnJsonError(res, 500, err.message)
    } finally {
        deleteAllUploadedFiles()
    }
}

async function performPanNumberOcr(image) {
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

async function extractPANNumberAndDob(imagePath) {
    try {

        let image = sharp(imagePath).resize({ fit: "inside", height: 800 }).grayscale()
        fs.writeFileSync("./uploads/grayimage.png", await image.toBuffer(), { encoding: "binary" })
        const metadata = await image.metadata()
        let panNumberMatch
        let dob

        let count = 0
        while ((!panNumberMatch || !dob) && count < 15) {
            console.log("Try", count + 1)
            const threshold = 35 * count
            image = image.threshold(threshold)
            fs.writeFileSync("./uploads/grayimage.png", await image.toBuffer(), { encoding: "binary" })
            const { extractedText } = await performPanNumberOcr(image);
            console.log("extractedText:", extractedText)

            const panRegex = /[A-Z]{5}[0-9]{4}[A-Z]{1}/;
            panNumberMatch = extractedText.match(panRegex);

            const extractedArray = extractedText.split("\n")

            if (!dob) {
                let dobRegex = /\b\d{2}\/\d{2}\/\d{4}\b/
                dob = extractedText.match(dobRegex) && extractedText.match(dobRegex).length ? extractedText.match(dobRegex)[0] : null
            }
            console.log(extractedArray)
            count++
        }
        if (panNumberMatch) {
            const panNumber = panNumberMatch[0];
            console.log({ panNumber, dob })
            return { panNumber, dob };
        } else {
            return null
        }

    } catch (error) {
        console.error('Error extracting PAN number:', error);
        return null;
    }
}

async function extractNameAndFatherNameFromPan(imagePath) {

    try {
        let image = sharp(imagePath)

        const metadata = await image.metadata()

        const cropWidth = Math.floor(metadata.width / 2);
        await image
            .greyscale()
            .extract({ left: 0, top: 0, width: cropWidth, height: metadata.height })
            .toFile("./uploads/grayimage.png");

        let count = 0

        let name, fatherName

        while (count < 10 && (!name || !fatherName)) {
            const threshold = 15 * count
            image = image.threshold(threshold)
            fs.writeFileSync("./uploads/grayimage.png", await image.toBuffer(), { encoding: "binary" })
            const { extractedText, confidence } = await performPanNumberOcr(image);
            console.log("confidence:", confidence, "extractedText:", extractedText.split("\n"))

            const extractedNames = extractNameAndFatherName(extractedText.split("\n"))

            name = extractedNames.name
            fatherName = extractedNames.fatherName

            if (name && fatherName) {
                return { name: cleanString(name), fatherName: cleanString(fatherName) }
            }

            count++
        }

        if (!fatherName && !name) {
            console.log("PAN without name and father's name")

            image = sharp(imagePath)
            await image
                .greyscale()
                .extract({ left: 0, top: 0, width: cropWidth, height: metadata.height })
                .toFile("./uploads/grayimage.png");

            count = 0
            while ((count < 10 && (!name || !fatherName))) {
                const threshold = 15 * count
                image = image.threshold(threshold)
                fs.writeFileSync("./uploads/grayimage.png", await image.toBuffer(), { encoding: "binary" })
                const { extractedText, confidence } = await performPanNumberOcr(image);
                console.log("Confidence:", confidence)
                if (confidence >= 50) {
                    const extractedTextArray = extractedText.split("\n").filter(item => item !== '')

                    let nameIndex
                    extractedTextArray.forEach((item, i) => {
                        if (item.includes("INCOME TAX")) {
                            nameIndex = i + 1
                        }
                    })

                    const fatherNameIndex = nameIndex + 1

                    name = extractedTextArray[nameIndex] || ""
                    fatherName = extractedTextArray[fatherNameIndex] || ""

                }
                if (name && fatherName) {
                    return { name: cleanString(name), fatherName: cleanString(fatherName) }
                }
                count++
            }
        }

        return { name, fatherName }
    } catch (err) {
        console.error('Error extracting PAN number:', err);
        return null;
    }
}


function extractNameAndFatherName(textArray, name, fatherName) {
    let nameIndex = -1
    let fatherIndex = -1
    textArray.forEach((item, i) => {
        if (item.includes("Name") && !item.includes("Father's Name")) {
            nameIndex = i + 1
            return
        }
    })

    textArray.forEach((item, i) => {
        if (item.includes("Father's Nam")) {
            fatherIndex = i + 1
            return
        }
    })

    name = nameIndex > -1 ? textArray[nameIndex] : ""
    fatherName = fatherIndex > -1 ? textArray[fatherIndex] : ""
    return { name, fatherName }
}
