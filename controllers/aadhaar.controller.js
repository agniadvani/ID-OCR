const fs = require("fs")
const sharp = require("sharp")
const { createWorker } = require("tesseract.js")
const getPixels = require("get-pixels")
const { returnJsonError } = require("../error")
const { extractCardDetails } = require('pan-aadhaar-ocr');

exports.adhaarOcr = async (req, res) => {
    try {
        if (!req.file) {
            return returnJsonError(res, 400, "Please Upload Image")
        }

        const imagePath = `./uploads/${req.file.originalname}`

        if (await isImageBlurry(imagePath)) {
            console.log("Image is blurry")
            return returnJsonError(res, 400, "Image is too blurry, upload a higher quality image.")
        }

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
        // fs.readdirSync("./uploads").forEach(item => {
        //     fs.rmSync(`./uploads/${item}`)
        // })
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

            await image
                .greyscale()
                .extract({ left: 0, top: 0, width: cropWidth, height: metadata.height })
                .toFile("./uploads/grayimage.png");
        } else {
            const cropHeight = Math.round(metadata.height / 1.35);

            await image
                .greyscale()
                .toFile("./uploads/grayimage.png");
            await image
                .greyscale()
                .toFile("./uploads/grayimage.png");
        }



        let count = 0
        let aadhaarNumber
        let dob
        let aadhaarNumberMatch
        let yob
        let gender
        let name

        // (!aadhaarNumberMatch || (!dob && !yob) || !gender) &&
        while ((!aadhaarNumberMatch || (!dob && !yob) || !gender) && count < 15) {
            console.log("Try", count + 1)
            const threshold = aadhaarType ? 10 * count : 20 * count
            image = image.threshold(threshold)
            fs.writeFileSync("./uploads/grayimage.png", await image.toBuffer(), { encoding: "binary" })
            let { extractedText, confidence } = await performAadhaarOcr(image);
            console.log("extractedText:", extractedText)
            const aadhaarRegex = /([2-9]{1}[0-9]{3}\s[0-9]{4}\s[0-9]{4})/;
            const extractedArray = extractedText.split("\n")
            console.log("Treshold", extractedArray)
            if (!aadhaarNumberMatch) {
                if (!aadhaarNumberMatch) {
                    aadhaarNumberMatch = extractedText.match(aadhaarRegex);
                }
            }

            if (!dob || !yob) {
                let dobRegex = /\b\d{2}\/\d{2}\/\d{4}\b/
                console.log("Name:", name)
                dob = extractedText.match(dobRegex) && extractedText.match(dobRegex).length ? extractedText.match(dobRegex)[0] : null
                yob = extractYearOfBirthFromText(extractedText)
            }

            gender = gender ? gender : extractedText.toLowerCase().includes("male") ? "Male" : extractedText.toLowerCase().includes("female") ? "Female" : ""

            console.log(extractedArray)
            console.log({ aadhaarNumber, dob, yob, name })

            count++
        }

        console.log("Got adhaar number, dob, yob, gender... now getting name")
        const resolution = metadata.height * metadata.width
        console.log("Image Resolution:", resolution)
        image = image.threshold(100)
        fs.writeFileSync("./uploads/grayimage.png", await image.toBuffer(), { encoding: "binary" })
        let { extractedText, confidence } = await performAadhaarOcr(image);
        console.log("extractedTextforname:", extractedText.split("\n"))

        if (aadhaarNumberMatch) {
            aadhaarNumber = aadhaarNumberMatch[0];
            if (dob)
                return { aadhaarNumber, dob, gender, name };
            else
                return { aadhaarNumber, yob, gender, name }

        } else {
            return null
        }

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




function isImageBlurry(imagePath) {
    return new Promise((resolve, reject) => {
        getPixels(imagePath, (err, pixels) => {
            if (err) {
                console.log("Bad image path")
                reject(err)
            }
            resolve(pixels.shape.slice()[0] <= 500)
        })
    })
}
