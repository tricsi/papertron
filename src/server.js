"use strict";
module.exports = (function() {

    var io = require("socket.io")(), //server
        games = [], //game list
        players = {}; //game players

    io.on("connect", function (socket) {

        /**
         * User object
         */
        var user = {
            nick: "Player",
            game: null
        };

        /**
         * Leave game
         */
        function leave() {
            var nick = user.nick,
                game = user.game;
            if (game) {
                user.game = null;
                players[game].splice(players[game].indexOf(nick), 1);
                console.log(nick + " leave " + game);
                if (players[game].length === 0) {
                    games.splice(games.indexOf(game), 1);
                    delete players[game];
                    console.log("room deleted: " + game);
                } else {
                    socket.to(game).emit("left", nick, players[game]);
                }
            }
        }

        /**
         * Client disconnects
         */
        socket.on("disconnect", function () {
            leave();
            console.log(user.nick + " disconnected");
        });

        /**
         * List games
         */
        socket.on("games", function () {
            socket.emit("games", games);
            console.log(user.nick + " get games");
        });

        /**
         * Player join or create game
         */
        socket.on("join", function (nick, game) {
            game = game || nick;
            if (nick && (!players[game] || players[game].indexOf(nick) === -1)) {
                socket.join(game);
                user.nick = nick;
                user.game = game;
                if (!players[game]) {
                    players[game] = [];
                    games.push(game);
                    console.log("new room: " + game);
                }
                players[game].push(nick);
                socket.emit("join", players[game]);
                socket.to(game).emit("joined", nick, players[game]);
                console.log(nick + " join to " + game);
            }
        });

        /**
         * Player leave
         */
        socket.on("leave", function () {
            socket.leave(user.game);
            leave();
        });

        /**
         * Chat message
         */
        socket.on("message", function (message) {
            if (user.game) {
                socket.to(user.game).emit("message", user.nick, message);
                console.log(user.nick + " message to " + user.game);
            }
        });

        /**
         * Player start game
         */
        socket.on("start", function (bots) {
            if (user.game) {
                socket.to(user.game).emit("start", bots);
                console.log(user.nick + " started " + user.game + " with bot number " + bots);
            }
        });

        /**
         * Player turn
         */
        socket.on("turn", function (to, time, id) {
            var list;
            if (user.game) {
                list = players[user.game];
                if (id < list.length) {
                    id = list.indexOf(user.nick);
                }
                socket.to(user.game).emit("turn", to, time, id);
                console.log(user.nick + " turn " + to + " at " + time);
            }
        });

        console.log(user.nick + " connected");
    });

    return io;
})();
