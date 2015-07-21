var io = require("socket.io")(), //server
    logic = require("./game.js"), //game.logic
    games = [], //game list
    players = {}; //game players

io.on("connect", function (socket) {

    socket.nick = "Player";
    socket.game = null;

    /**
     * Leave game
     */
    function leave() {
        var nick = socket.nick,
            game = socket.game;
        if (game) {
            socket.game = null;
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
        console.log(socket.nick + " disconnected");
    });

    /**
     * List games
     */
    socket.on("games", function () {
        socket.emit("games", games);
        console.log(socket.nick + " get games");
    });

    /**
     * Player join or create game
     */
    socket.on("join", function (nick, game) {
        game = game || nick;
        if (nick && (!players[game] || players[game].indexOf(nick) === -1)) {
            socket.join(game);
            socket.nick = nick;
            socket.game = game;
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
        socket.leave(socket.game);
        leave();
    });

    /**
     * Chat message
     */
    socket.on("message", function (message) {
        if (socket.game) {
            socket.to(socket.game).emit("message", socket.nick, message);
            console.log(socket.nick + " message to " + socket.game);
        }
    });

    /**
     * Player start game
     */
    socket.on("start", function (bots) {
        if (socket.game) {
            socket.to(socket.game).emit("start", bots);
            console.log(socket.nick + " started " + socket.game + " with bot number " + bots);
        }
    });

    /**
     * Player turn
     */
    socket.on("turn", function (to, time, id) {
        var list;
        if (socket.game) {
            list = players[socket.game];
            if (id < list.length) {
                id = list.indexOf(socket.nick);
            }
            socket.to(socket.game).emit("turn", to, time, id);
            console.log(socket.nick + " turn " + to + " at " + time);
        }
    });

    console.log(socket.nick + " connected");
});

module.exports = io;
