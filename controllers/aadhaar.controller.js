const fs = require("fs")
const sharp = require("sharp")
const { createWorker } = require("tesseract.js")
const { returnJsonError } = require("../error")
const { cleanString, isImageBlurry, deleteAllUploadedFiles } = require("../utils/utils")

exports.adhaarOcr = async (req, res) => {
    try {
        const imagePath = `./uploads/${req.file.originalname}`

        const metadata = await sharp(imagePath).metadata()

        const heightWidthRatio = metadata.height / metadata.width
        console.log("Height width ratio:", heightWidthRatio)
        let aadhaarData
        if (heightWidthRatio <= 0.85) {
            console.log("Short ID")
            aadhaarData = await extractAadhaarNumberDobAndGenderForSmallIds(imagePath)
        } else {
            console.log("Long ID")
            aadhaarData = await extractAadhaarNumberDobAndGenderForSmallIds(imagePath, "Long")
        }

        res.send({ success: true, status: 200, data: aadhaarData })
    } catch (err) {
        console.log(err)
        return returnJsonError(res, 500, err.message)
    } finally {
        deleteAllUploadedFiles()
    }
}


async function performAadhaarOcr(image) {
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

async function extractAadhaarNumberDobAndGenderForSmallIds(imagePath, aadhaarType) {
    try {

        let image = sharp(imagePath).grayscale()
        fs.writeFileSync("./uploads/grayimage.png", await image.toBuffer(), { encoding: "binary" })
        const metadata = await image.metadata()
        console.log("Metadata:", metadata)
        if (aadhaarType !== "Long") {
            const cropWidth = Math.round(metadata.width / 1.35);
            const croppedPixels = metadata.width - cropWidth
            await image
                .greyscale()
                .extract({ left: croppedPixels, top: 0, width: cropWidth - croppedPixels, height: metadata.height })
                .toFile("./uploads/grayimage.png");
        } else {
            const cropHeight = Math.round(metadata.height / 2.5);
            const cropWidth = Math.round(metadata.width / 1.35);
            const croppedPixels = metadata.width - cropWidth

            await image
                .greyscale()
                .extract({ left: croppedPixels, top: metadata.height - cropHeight, width: cropWidth - croppedPixels, height: cropHeight })
                .toFile("./uploads/grayimage.png")
        }

        let count = 0
        let aadhaarNumber, dob, aadhaarNumberMatch, yob, gender, name

        while ((!aadhaarNumberMatch || !aadhaarNumber || (!dob && !yob) || !gender) && count < 15) {
            console.log("Try", count + 1)
            const threshold = aadhaarType ? 10 * count : 20 * count
            image = image.threshold(threshold)
            fs.writeFileSync("./uploads/grayimage.png", await image.toBuffer(), { encoding: "binary" })
            let { extractedText } = await performAadhaarOcr(image);
            console.log("extractedText:", extractedText)
            const aadhaarRegex = /([2-9]{1}[0-9]{3}\s[0-9]{4}\s[0-9]{4})/;
            const extractedArray = extractedText.split("\n")
            console.log("Treshold", extractedArray)
            if (!aadhaarNumberMatch) {
                aadhaarNumberMatch = String(extractedText).match(aadhaarRegex);
            }
            if (aadhaarNumberMatch && !aadhaarNumber) {
                aadhaarNumber = aadhaarNumberMatch[0]
            }

            if (!dob || !yob) {
                let dobRegex = /\b\d{2}\/\d{2}\/\d{4}\b/
                console.log("Name:", name)
                dob = extractedText.match(dobRegex) && extractedText.match(dobRegex).length ? extractedText.match(dobRegex)[0] : null
                yob = extractYearOfBirthFromText(extractedText)
            }

            gender = gender ? gender : extractedText.toLowerCase().includes("male") ? "Male" : extractedText.toLowerCase().includes("female") ? "Female" : ""

            console.log(extractedArray)
            console.log({ aadhaarNumber, dob, yob, name, gender })

            count++
        }


        console.log("Got adhaar number, dob, yob, gender... now getting name")
        count = 0

        let nameMatch
        while (!name && count <= 10) {
            const resolution = metadata.height * metadata.width
            console.log("Image Resolution:", resolution)
            fs.writeFileSync("./uploads/grayimage.png", await image.toBuffer(), { encoding: "binary" })
            const threshold = count * 25
            image = image.threshold(threshold)
            let { extractedText } = await performAadhaarOcr(image);
            console.log("extractedTextforname:", extractedText.split("\n").filter(item => item !== ""))
            fs.writeFileSync("./uploads/grayimage.png", await image.toBuffer(), { encoding: "binary" })
            let govtIndex
            extractedText.split("\n").filter(item => item !== "").forEach((element, i) => {
                if (element.includes("Government")) {
                    govtIndex = i
                }
            });


            name = cleanString(extractedText.split("\n").filter(item => item !== "")[govtIndex + 2] || "")
            count++
        }

        if (dob)
            return { aadhaarNumber, dob, gender, name }
        else
            return { aadhaarNumber, yob, gender, name }


    } catch (error) {
        console.error('Error extracting Addhaar details:', error);
        return null;
    }
}

function extractYearOfBirthFromText(ocrText) {
    const yearRegex = /\b(19\d{2}|20[0-2]\d)\b/g;

    const matches = ocrText.match(yearRegex);

    if (matches && matches.length > 0) {
        const yearOfBirth = parseInt(matches[0]);
        return yearOfBirth;
    } else {
        return null;
    }
}

