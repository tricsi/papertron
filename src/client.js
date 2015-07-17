/**
 * Client application
 */
var App = (function () {
    "use strict";

    var socket, //server connection
        myMatch, //actual game
        myMotor; //player's motor

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
     * Scene renderer module
     */
    var Scene = (function () {

        var container,  //canvas container
            canvas, //canvas element
            ctx, //canvas context
            width,  //canvas width
            height, //canvas height
            rotate, //canvas rotation
            colors = ["#00c", "#c00", "#0f0", "#f0c"]; //motor colors

        /**
         * Render 2D scene
         * @param {Game.Match} match
         * @param {Game.Motor} motor
         */
        function render(match, me) {
            container.style.transform = "rotateX(45deg) translateY(100px) scale(1) rotateZ(" + rotate + "deg)";
            canvas.style.transform = "translate(" + (-me.x * 2) + "px," + (-me.y * 2) + "px)";
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

        /**
         * Init scene
         */
        function init() {
            container = $("#container");
            canvas = $("canvas");
            ctx = canvas.getContext("2d");
            width = canvas.width;
            height = canvas.height;
            rotate = 0;
        }

        return {
            init: init,
            render: render,
            rotate: rotate
        };

    })();

    /**
     * Game menu
     */
    var Menu = (function () {

        var container, //menu container
            events, //menu events
            games, //game list
            nick, //nickname
            navs; //menu navigations

        /**
         * Add menu event
         * @param {string} event
         * @callback callback
         */
        function addEvent(event, callback) {
            events[event] = callback;
        }

        /**
         * Show menu
         */
        function show() {
            container.className = "";
        }

        /**
         * Hide menu
         */
        function hide() {
            container.className = "hide";
        }

        /**
         * Get nickname
         */
        function getNick() {
            return nick.value.trim();
        }

        /**
         * Get game name
         */
        function getGame() {
            return games.value;
        }

        /**
         * Update game list
         * @param {string[]} list
         */
        function setGames(list) {
            while (games.options.length) {
                games.remove(0);
            }
            games.add(new Option("NEW GAME", "", true));
            list.forEach(function (game) {
                games.add(new Option(game + "'s game", game));
            });
        }

        /**
         * Bind menu events
         */
        function bind() {
            on(container, "click", function (e) {
                var i,
                    id,
                    item;
                if (e.target.tagName === "A") {
                    id = e.target.getAttribute("href").substr(1);
                    for (i = 0; i < navs.length; i++) {
                        item = navs.item(i);
                        if (item.id !== id) {
                            item.className = "hide";
                        } else {
                            item.className = "";
                        }
                    }
                }
                if (id in events) {
                    events[id].call(Menu);
                }
                e.preventDefault();
            });
        }

        /**
         * Module init
         */
        function init() {
            container = $("#menu");
            events = {};
            games = $("select", container);
            nick = $("input", container);
            navs = container.getElementsByTagName("nav");
            bind();
        }

        return {
            init: init,
            show: show,
            hide: hide,
            on: addEvent,
            nick: getNick,
            game: getGame,
            games: setGames
        };

    })();

    /**
     * Chat module
     */
    var Chat = (function () {

        var container, //chat form
            text, //chat input
            texts, //chat messages
            room; //players list

        /**
         * Add chat message
         * @param {string} message
         */
        function addMesage(message) {
            var br = document.createElement("br");
            texts.insertBefore(br, texts.firstChild);
            texts.insertBefore(document.createTextNode(message), br);
        }

        /**
         * Update room
         * @param {string[]} list
         */
        function setRoom(list) {
            room.innerHTML = "";
            list.forEach(function (nick) {
                room.appendChild(document.createTextNode(nick));
                room.appendChild(document.createElement("br"));
            });
        }

        /**
         * Bind chat events
         */
        function bind() {
            on(container, "submit", function (e) {
                var value = text.value.trim(),
                    nick = Menu.nick();
                if (value !== "") {
                    socket.emit("message", value);
                    addMesage(nick + ": " + value);
                }
                text.value = "";
                e.preventDefault();
            });
        }

        /**
         * Init chat
         */
        function init() {
            container = $("form");
            text = $("input", container);
            texts = $("div.texts", container);
            room = $("div.room", container);
            bind();
        }

        return {
            init: init,
            room: setRoom,
            add: addMesage
        };

    })();

    /**
     * Run animations and game logic
     */
    function anim() {
        requestAnimationFrame(anim);
        myMatch.run();
        Scene.render(myMatch, myMotor);
    }

    /**
     * Bind events
     */
    function bind() {

        Menu.on("join", function () {
            socket.emit("join", Menu.nick(), Menu.game());
        });

        socket.on("connect", function () {
            socket.emit("games");
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

        on(document.body, "keydown", function (e) {
            switch (e.keyCode) {
                case 37:
                    myMotor.turn(Game.Motor.LEFT);
                    Scene.rotate += 90;
                    e.preventDefault();
                    break;
                case 39:
                    myMotor.turn(Game.Motor.RIGHT);
                    Scene.rotate -= 90;
                    e.preventDefault();
                    break;
            }
        });
    }

    /**
     * App init
     */
    function init() {
        myMatch = new Game.Match();
        myMotor = myMatch.add(0, 100, Game.Motor.UP);
        myMatch.add(0, -100, Game.Motor.DOWN, true);
        myMatch.add(-100, 0, Game.Motor.RIGHT, true);
        myMatch.add(100, 0, Game.Motor.LEFT, true);
        Scene.init();
        Chat.init();
        Menu.init();
        socket = io();
        bind();
        anim();
        setInterval(function () {
            myMatch.ai();
        }, 25);
    }

    return {
        init: init
    };

})();

window.onload = App.init;
