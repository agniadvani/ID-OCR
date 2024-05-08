const { returnJsonError } = require("../error")


exports.voterIdOcr = async (req, res) => {
    try {

    } catch (err) {
        console.log(err)
        return returnJsonError(res, 500, err.message)
    }
}