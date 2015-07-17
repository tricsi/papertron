"use strict";
module.exports = (function() {

    var io = require("socket.io")(),
        games = [],
        players = {};

    io.on("connect", function (socket) {

        var user = {
            nick: "Player",
            game: null
        };

        function leave() {
            var nick = user.nick,
                game = user.game;
            if (game) {
                user.game = null;
                players[game].splice(players[game].indexOf(nick), 1);
                if (players[game].length === 0) {
                    games.splice(games.indexOf(game), 1);
                    delete players[game];
                } else {
                    socket.to(game).emit("left", nick, players[game]);
                }
                console.log(nick + " leave " + game);
            }
        }

        socket.on("games", function () {
            socket.emit("games", games);
            console.log(user.nick + " get games");
        });

        socket.on("join", function (nick, game) {
            game = game || nick;
            if (nick && (!players[game] || players[game].indexOf(nick) === -1)) {
                socket.join(game);
                user.nick = nick;
                user.game = game;
                if (!players[game]) {
                    players[game] = [];
                    games.push(game);
                }
                players[game].push(nick);
                socket.emit("join", players[game]);
                socket.to(game).emit("joined", nick, players[game]);
                console.log(nick + " join to " + game);
            }
        });

        socket.on("leave", function () {
            socket.leave(user.game);
            leave();
        });

        socket.on("message", function (message) {
            if (user.game) {
                socket.to(user.game).emit("message", user.nick, message);
                console.log(user.nick + " message to " + user.game);
            }
        });

        socket.on("disconnect", function () {
            leave();
            console.log(user.nick + " disconnected");
        });

        console.log(user.nick + " connected");
    });

    return io;
})();
