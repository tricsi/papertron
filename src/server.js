"use strict";
module.exports = (function() {

    var io = require("socket.io")(),
        games = [];

    io.on("connect", function (socket) {
        var user = {
            nick: "Player",
            game: null
        };

        function leave() {
            if (user.game) {
                user.game = null;
                console.log(user.nick + " leave " + user.game);
            }
        }

        socket.on("games", function () {
            socket.emit("games", games);
            console.log(user.nick + " get games");
        });

        socket.on("join", function (nick, game) {
            user.nick = nick;
            user.game = game || nick;
            if (games.indexOf(user.game) < 0) {
                games.push(user.game);
            }
            socket.join(user.game);
            console.log(user.nick + " join to " + user.game);
        });

        socket.on("leave", function () {
            socket.leave(user.game);
            leave();
        });

        socket.on("message", function (message) {
            message = user.nick + ": " + message;
            socket.emit("message", message);
            if (user.game) {
                socket.to(user.game).emit("message", message);
            }
            console.log(user.nick + " message to " + user.game);
        });

        socket.on("disconnect", function () {
            leave();
            console.log(user.nick + " disconnected");
        });

        console.log(user.nick + " connected");
    });

    return io;
})();
