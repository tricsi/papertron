"use strict";

function connect(socket) {
    console.log("user connected");
    socket.emit("hello", "Hello Socket.IO!");
    socket.on("disconnect", function () {
        console.log("user disconnected");
    });
}

module.exports = connect;
