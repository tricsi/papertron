"use strict";
module.exports = (function() {
    var io = require("socket.io")();

    io.on("connect", function (socket) {
        console.log("user connected");
        socket.emit("hello", "Hello Socket.IO!");
        socket.on("disconnect", function () {
            console.log("user disconnected");
        });
    });

    return io;
})();
