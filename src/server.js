var logic = require("./game.js"); //game.logic

var io = require("socket.io")(), //server
    games = [], //game list
    names = [], //nicknames
    store = {}; //game data

io.on("connect", function (socket) {

    var match, //actual match
        thread; //game thread

    socket.nick = "Player";
    socket.game = null;

    /**
     * Game players nick
     */
    function nicks(game) {
        var list = [];
        if (store[game]) {
            store[game].players.forEach(function(client) {
                list.push(client.nick);
            });
        }
        return list;
    }

    /**
     * Get match snapshot
     */
    function snapshot(game) {
        return store[game] && store[game].match
            ? store[game].match.save()
            : null;
    }

    /**
     * Thread run
     */
    function run() {
        var winner,
            stuck = [],
            data,
            game = socket.game;
        winner = match.run(function (id, time) {
            stuck.push(id);
            console.log(match.motors[id].nick + " stuck at " + time);
        });
        if (winner === false) {
            match.ai(function (to, time, id) {
                console.log("Robot turn " + to + " at " + time);
            });
        }
        data = snapshot(game);
        socket.emit("shot", data, stuck, winner);
        socket.to(game).emit("shot", data, stuck, winner);
        if (winner !== false) {
            clearInterval(thread);
            if (store[game]) {
                store[game].match = null;
            }
            console.log(match.motors[winner].nick + " wins");
        }
    }

    function removeNick()
    {
        var index = names.indexOf(socket.nick);
        if (index >= 0) {
            names.splice(index, 1);
        }
    }

    /**
     * Leave game
     */
    function leave() {
        var nick = socket.nick,
            game = socket.game,
            players;
        if (game) {
            socket.game = null;
            players = store[game].players;
            players.splice(players.indexOf(socket), 1);
            console.log(nick + " leave " + game);
            if (players.length === 0) {
                games.splice(games.indexOf(game), 1);
                delete store[game];
                console.log("room deleted: " + game);
            } else {
                socket.to(game).emit("left", nick, nicks(game));
            }
        }
    }

    /**
     * Client disconnects
     */
    socket.on("disconnect", function () {
        leave();
        removeNick();
        console.log(socket.nick + " disconnected");
    });

    /**
     * Open game
     */
    socket.on("open", function (nick) {
        if (!nick || !nick.match(/^[0-9a-zA-Z]+$/)) {
            socket.emit("alert", "Invalid name!");
        } else if (names.indexOf(nick) >= 0) {
            socket.emit("alert", "Name exists!");
        } else {
            removeNick();
            names.push(nick);
            socket.nick = nick;
            socket.emit("open");
        }
    });

    /**
     * List games
     */
    socket.on("games", function () {
        socket.emit("games", games);
        console.log(socket.nick + " get games");
    });

    /**
     * Create new game
     */
    socket.on("create", function (game, params) {
        if (!game) {
            socket.emit("alert", "Invalid name!");
        } else if (games.indexOf(game) >= 0) {
            socket.emit("alert", "Game exists!");
        } else {
            socket.leave(socket.game);
            leave();
            games.push(game);
            store[game] = {
                params: params,
                players: [socket]
            };
            socket.join(game);
            socket.game = game;
            socket.emit("join", [socket.nick]);
            console.log(socket.nick + " created " + game);
        }
    });

    /**
     * Player join or create game
     */
    socket.on("join", function (game) {
        var list,
            nick = socket.nick;
        game = game || nick;
        if (nick && store[game] && store[game].players.indexOf(socket) === -1) {
            socket.join(game);
            socket.game = game;
            store[game].players.push(socket);
            list = nicks(game);
            socket.emit("join", list, snapshot(game));
            socket.to(game).emit("joined", nick, list);
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
    socket.on("start", function () {
        var i,
            data,
            bots,
            player,
            params,
            game = store[socket.game];
       if (game) {
            params = game.params;
            bots = params.bots;
            match = new logic.Match(params.mode);
            for (i = 0; i < game.players.length; i++) {
                player = game.players[i];
                player.motor = match.add(player.nick);
            }
            while (i++ < 4 && bots-- > 0) {
                player = match.add();
            }
            game.match = match;
            data = snapshot(socket.game);
            game.players.forEach(function(client, id) {
                client.emit("start", data, id, params.mode, params.map);
            });
            thread = setInterval(run, 1000 / match.timer);
            console.log(socket.nick + " started " + socket.game + " with bot number " + params.bots);
        }
    });

    /**
     * Player turn
     */
    socket.on("turn", function (to, time) {
        var motor;
        if (socket.game) {
            motor = socket.motor;
            motor.move(time);
            motor.turn(to);
            socket.to(socket.game).emit("turn", to, time, motor.id);
            console.log(socket.nick + " turn " + to + " at " + time);
        }
    });

    console.log(socket.nick + " connected");
});

module.exports = io;
