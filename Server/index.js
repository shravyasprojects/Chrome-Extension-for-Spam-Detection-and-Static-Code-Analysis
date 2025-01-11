const express = require("express");
const cors = require("cors");

const app = express();

const bodyParser = require("body-parser");
app.use(cors());
app.use(bodyParser.json());

const chatGPTRoutes = require("./routes/chatGPT");

// app.post("/", (req, res) => {
//     res.status(200).send({message: "hello"})
// })
app.use("/chatGPT", chatGPTRoutes);

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send("Internal Server Error");
});

app.listen(3000, () => {
    console.log("Server started on port 3000");
});