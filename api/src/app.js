const express = require("express");
const app = express();

const users = require("./routes/users");
const mood = require("./routes/mood");

app.use(express.json());
app.use("/users", users);
app.use("/mood", mood);

module.exports = app;

