"use strict";

var express = require("express");
var app = express();
var http = require("http").Server(app);
var io = require("socket.io")(http);

app.use(express.static("src"));

io.on("connection", function(socket){
    console.log("a user connected");
});

http.listen(80, function() {
    console.log("Server started");
});
