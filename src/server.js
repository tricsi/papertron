"use strict";
module.exports = (function() {

    var io = require("socket.io")();

    io.on("connect", function (socket) {
        console.log("user connected");
        
        function leave() {
            if (socket.room) {
                socket.leave(socket.room);
                socket.room = null;
                console.log(socket.nick + " leave " + socket.room);
            }
        }
        
        socket.on("join", function (nick, room) {
            socket.nick = nick;
            socket.room = room || nick;
            socket.join(socket.room);
            console.log(socket.nick + " join to " + socket.room);
        });
        
        socket.on("message", function (message) {
            socket.emit("message", message);
            if (socket.room) {
                socket.to(socket.room).emit("message", message);
            }
            console.log(socket.nick + " message to " + socket.room);
        });
        
        socket.on("disconnect", function () {
            console.log("user disconnected");
        });
        
    });

    return io;
})();
