/* global io */
/* global jsfxr */
var socket, //server connection
    Scene, //Game scene module
    Sfx, //Sound module
    Chat, //Chat module
    Game, //Game module
    Menu, //Menu module
    logic; //Game logic

/**
 * Query selector helper
 * @param {string} query
 * @param {Object} element
 */
function $(query, element) {
    element = element || document;
    return element.querySelector(query);
}

/**
 * Event handler helper
 * @param {Object} element
 * @param {string} event
 * @callback handler
 */
function on(element, event, handler) {
    element.addEventListener(event, handler, false);
}

/**
 * Attribute helper
 * @param {Object} element
 * @param {string} name
 * @param {string} value
 */
function attr(element, name, value) {
    if (value !== undefined) {
        element.setAttribute(name, value);
    }
    return element.getAttribute(name);
}

/**
 * Send network message
 */
function emit() {
    if (socket) {
        socket.emit.apply(socket, arguments);
    }
}

Game = (function () {

    var container, //game container
        bots, //robot select
        match, //actual match
        motor; //player's motor

    /**
     * Run animations and game logic
     */
    function run() {
        match.run();
        Scene.render(match, motor);
        requestAnimationFrame(run);
    }

    return {

        /**
         * Module init
         */
        init: function () {
            container = $("#game");
            bots = $("select", container);
            on(container, "click", function (e) {
                var id = attr(e.target, "href");
                switch (id) {
                    case "#start":
                        emit("start", parseInt(bots.value));
                        break;
                    case "#leave":
                        emit("leave");
                        Menu.show();
                        break;
                }
            });
            on(document.body, "keydown", function (e) {
                switch (e.keyCode) {
                    case 37:
                        if (Game.turn(logic.Motor.LEFT)) {
                            Scene.rotate(90);
                        }
                        break;
                    case 39:
                        if (Game.turn(logic.Motor.RIGHT)) {
                            Scene.rotate(-90);
                        }
                        break;
                }
            });
        },

        /**
         * Start new match
         */
        start: function (players, playerNum) {
            var i,
                j = 0,
                nick = players[playerNum],
                player,
                pos = [
                    [0, 50, logic.Motor.UP],
                    [0, -50, logic.Motor.DOWN],
                    [-50, 0, logic.Motor.RIGHT],
                    [50, 0, logic.Motor.LEFT]
                ];

            match = new logic.Match();

            //add players
            for (i = 0; i < players.length; i++) {
                player = match.add(pos[i][0], pos[i][1], pos[i][2]);
                if (players[i] === nick) {
                    Scene.rotate(pos[i][2] * -90, true);
                    motor = player;
                }
            }

            run();
            Game.hide();
        },

        /**
         * Turn motor
         */
        turn: function (to, time, id) {
            var player;
            if (!match) {
                return false;
            }
            player = match.motors[id] || motor;
            time = time || match.getTime();
            if (!player || time < 1) {
                return false;
            }
            if (id === undefined) {
                emit("turn", to, time, id);
            }
            player.move(time);
            player.turn(to);
            Sfx.play("turn");
            return true;
        },

        /**
         * Show game
         */
        show: function (title) {
            $("h1", container).innerHTML = title;
            attr(container, "class", "");
        },

        /**
         * Hide game
         */
        hide: function () {
            attr(container, "class", "hide");
        }
    };

})();

/**
 * Scene renderer module
 */
Scene = (function () {

    var container,  //canvas container
        canvas, //canvas element
        ctx, //canvas context
        width,  //canvas width
        height, //canvas height
        rotate, //canvas rotation
        colors = ["#00c", "#c00", "#0f0", "#f0c"]; //motor colors

    /**
     * Render 2D scene
     * @param {Match} match
     * @param {Motor} motor
     */
    function render(match, me) {
        container.style.transform = "rotateX(45deg) scale(2) rotateZ(" + rotate + "deg)";
        canvas.style.transform = "translate(" + (-me.x) + "px," + (-me.y) + "px)";
        ctx.save();
        ctx.clearRect(0, 0, width, height);
        ctx.translate(Math.round(width / 2), Math.round(height / 2));
        match.motors.forEach(function (motor, color) {
            ctx.save();
            //Lines
            ctx.beginPath();
            ctx.scale(2, 2);
            ctx.moveTo(motor.x, motor.y);
            for (var i = 0; i < motor.data.length; i++) {
                ctx.lineTo(motor.data[i][0], motor.data[i][1]);
            }
            ctx.strokeStyle = colors[color];
            ctx.stroke();
            //Arrow
            ctx.beginPath();
            ctx.translate(motor.x, motor.y);
            ctx.rotate(motor.vec / 2 * Math.PI);
            ctx.moveTo(0, -1);
            ctx.lineTo(1.5, 3);
            ctx.lineTo(-1.5, 3);
            ctx.closePath();
            ctx.fillStyle = colors[color];
            ctx.fill();
            ctx.restore();
        });
        ctx.restore();
    }

    return {

        /**
         * Init scene
         */
        init: function init() {
            container = $("#container");
            canvas = $("canvas");
            ctx = canvas.getContext("2d");
            width = canvas.width;
            height = canvas.height;
            rotate = 0;
        },

        rotate: function (value, reset) {
            rotate = reset ? value : rotate + value;
        },

        render: render
    };

})();

/**
 * Chat module
 */
Chat = (function () {

    var container, //chat form
        text, //chat input
        texts, //chat messages
        room; //players list

    return {

        /**
         * Module init
         */
        init: function () {
            container = $("#chat");
            text = $("input", container);
            texts = $(".texts", container);
            room = $(".room", container);
            on(container, "submit", function (e) {
                var value = text.value.trim(),
                    nick = Menu.nick();
                if (value !== "") {
                    emit("message", value);
                    Chat.add(nick + ": " + value);
                }
                text.value = "";
                e.preventDefault();
            });
        },

        /**
         * Set room members
         * @param {string[]} list
         */
        room: function (list) {
            room.innerHTML = "";
            list.forEach(function (nick) {
                room.appendChild(document.createTextNode(nick));
                room.appendChild(document.createElement("br"));
            });
            Game.players = list;
        },

        /**
         * Add new message
         * @param {string} message
         */
        add: function (message) {
            var br = document.createElement("br");
            texts.insertBefore(br, texts.firstChild);
            texts.insertBefore(document.createTextNode(message), br);
        },

        /**
         * Show chat
         */
        show: function () {
            attr(container, "class", "");
        },

        /**
         * Hide chat
         */
        hide: function () {
            attr(container, "class", "hide");
        }
    };

})();

/**
 * Game menu
 */
Menu = (function () {

    var container, //menu container
        games, //game list
        nick, //nickname
        ping;

    return {

        /**
         * Module init
         */
        init: function () {
            container = $("#menu");
            games = $("select", container);
            nick = $("input", container);
            on(container, "click", function (e) {
                var id = attr(e.target, "href");
                switch (id) {
                    case "#join":
                        emit("join", Menu.nick(), Menu.game());
                        break;
                }
            });
        },

        /**
         * Show menu
         */
        show: function () {
            emit("games");
            attr(container, "class", "");
            Game.hide();
            Chat.hide();
            ping = setInterval(function () {
                emit("games");
            }, 3000);
        },

        /**
         * Hide menu
         */
        hide: function () {
            attr(container, "class", "hide");
            Game.show("New game");
            Chat.show();
            clearInterval(ping);
        },

        /**
         * Get nickname
         * @return string
         */
        nick: function () {
            return nick.value.trim();
        },

        /**
         * Get game name
         * @return string
         */
        game: function () {
            return games.value;
        },

        /**
         * Set games list
         * @param {string[]} list
         */
        games: function (list) {
            var selected = games.value;
            games.selectedIndex = 0;
            while (games.options.length > 1) {
                games.remove(1);
            }
            list.forEach(function (game, index) {
                games.add(new Option(game + "'s game", game));
                if (game === selected) {
                    games.selectedIndex = index + 1;
                }
            });
        }
    };

})();

Sfx = (function () {

    var sounds;

    return {
        init: function () {
            sounds = {
                exp: new Audio(jsfxr([3, , 0.1608, 0.5877, 0.4919, 0.1058, , , , , , , , , , 0.7842, -0.1553, -0.2125, 1, , , , , 0.5])),
                btn: new Audio(jsfxr([0, , 0.0373, 0.3316, 0.1534, 0.785, , , , , , , , , , , , , 1, , , , , 0.5])),
                over: new Audio(jsfxr([2, , 0.0551, , 0.131, 0.37, , 0.1096, , , , , , 0.1428, , 0.6144, , , 1, , , , , 0.5])),
                turn: new Audio(jsfxr([1, , 0.18, , 0.1, 0.3465, , 0.2847, , , , , , 0.4183, , , , , 0.5053, , , , , 0.5]))
            };
            on(document.body, "click", function (e) {
                if (e.target.tagName === "A") {
                    Sfx.play("btn");
                }
            });
            on(document.body, "mouseover", function (e) {
                if (e.target.tagName === "A") {
                    Sfx.play("over");
                }
            });
        },
        play: function (name) {
            sounds[name].play();
        }
    };

})();

/**
 * Bind events
 */
function bind() {

    socket.on("connect", function () {
        emit("games");
    });

    socket.on("games", function (list) {
        Menu.games(list);
    });

    socket.on("join", function (list) {
        Menu.hide();
        Chat.room(list);
    });

    socket.on("joined", function (nick, list) {
        Chat.add(nick + " joined");
        Chat.room(list);
    });

    socket.on("left", function (nick, list) {
        Chat.add(nick + " left");
        Chat.room(list);
    });

    socket.on("message", function (nick, text) {
        Chat.add(nick + ": " + text);
    });

    socket.on("start", function (players, playerNum) {
        Game.start(players, playerNum);
    });

    socket.on("turn", function (to, time, id) {
        Game.turn(to, time, id);
    });
}

/**
 * App init
 */
window.onload = function () {
    logic = exports;
    Sfx.init();
    Scene.init();
    Chat.init();
    Menu.init();
    Game.init();
    if (typeof (io) !== "undefined") {
        socket = io();
        bind();
        Menu.show();
    } else {
        Game.show();
        Game.players = ["Player"];
    }
};
