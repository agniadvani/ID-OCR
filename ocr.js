const express = require("express")
const app = express()
const multer = require("multer")
const { panOcr } = require("./controllers/pan.controller")
const { adhaarOcr } = require("./controllers/aadhaar.controller")
const { voterIdOcr } = require("./controllers/voterId.controller")
const { uploadFile } = require("./middlewares/middleware")


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

app.post("/ocr/pan", uploadFile, panOcr)
app.post("/ocr/aadhaar", uploadFile, adhaarOcr)
app.post("/ocr/voterId", uploadFile, voterIdOcr)

const PORT = 8888
app.listen(PORT, () => {
    console.log("Listening on port:", PORT)
})