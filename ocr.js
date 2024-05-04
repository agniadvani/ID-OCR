const express = require("express")
const app = express()
const multer = require("multer")
const { panOcr } = require("./controllers/pan.controller")
const { adhaarOcr } = require("./controllers/aadhaar.controller")


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./uploads")
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname)
    }

})
const upload = multer({ storage: storage }).single('document')

app.use(upload)
app.use(express.json())

app.post("/ocr/pan", panOcr)
app.post("/ocr/aadhaar", adhaarOcr)

const PORT = 8888
app.listen(PORT, () => {
    console.log("Listening on port:", PORT)
})




