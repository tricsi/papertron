"use strict";

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
 * Client application
 */
var App = (function() {

    var container = $("#container"),  //canvas container
        canvas = $("canvas"), //canvas element
        chat = $("form"), //chat form
        text = $("input", chat), //chat input
        texts = $("div.texts", chat), //chat messages
        room = $("div.room", chat), //players list
        menu = $("#menu"), //menu container
        games = $("select", menu), //game list
        navs = menu.getElementsByTagName("nav"), //menu navigations
        ctx = canvas.getContext("2d"), //canvas context
        width = canvas.width,  //canvas width
        height = canvas.height, //canvas height
        rotate = 0, //canvas rotation
        colors = ["#00c", "#c00", "#0f0", "#f0c"], //motor colors
        socket, //server connection
        myMatch, //actual game
        myMotor; //player's motor

    /**
     * Event handler helper
     * @param {Object} element
     * @param {string} event
     * @callback handler
     */
    function on(element, event, handler) {
        element.addEventListener(event, handler, false);
    }

    function message(text) {
        var br = document.createElement("br");
        texts.insertBefore(br, texts.firstChild);
        texts.insertBefore(document.createTextNode(text), br);
    }
    
    function players(list) {
        room.innerHTML = "";
        list.forEach(function(nick) {
            room.appendChild(document.createTextNode(nick));
            room.appendChild(document.createElement("br"));
        });
    }

    /**
     * Render 2D canvas
     */
    function render() {
        canvas.style.transform = "translate(" + (-myMotor.x * 2) + "px," + (-myMotor.y * 2) + "px)";
        container.style.transform = "rotateX(45deg) translateY(100px) scale(1) rotateZ(" + rotate + "deg)";
        ctx.save();
        ctx.clearRect(0, 0, width, height);
        ctx.translate(Math.round(width / 2), Math.round(height / 2));
        myMatch.motors.forEach(function(motor, color) {
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
     * Run animations and game logic
     */
    function anim() {
        requestAnimationFrame(anim);
        myMatch.run();
        render();
    }

    /**
     * Bind events
     */
    function bind() {

        socket.on("connect", function () {
            socket.emit("games");
        });
        
        socket.on("games", function (values) {
            while (games.options.length) {
                games.remove(0);
            }
            games.add(new Option("NEW GAME", "", true));
            values.forEach(function(game) {
                games.add(new Option(game + "'s game", game));
            });
        });
        
        socket.on("players", function (list) {
            players(list);
        });

        socket.on("joined", function (nick, list) {
            message(nick + " joined");
            players(list);
        });

        socket.on("left", function (nick, list) {
            message(nick + " left");
            players(list);
        });

        socket.on("message", function (nick, text) {
            message(nick + ": " + text);
        });

        on(chat, "submit", function(e) {
            var value = text.value.trim(),
                nick = $("input", menu).value.trim();
            if (value !== "") {
                socket.emit("message", value);
                message(nick + ": " + value);
            }
            text.value = "";
            e.preventDefault();
        });

        on(menu, "click", function(e) {
            var i,
                id,
                item,
                close = true;
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
            if (id && close) {
                menu.className = "hide";
            }
            switch (id) {
                case "join":
                    var nick = $("input", menu).value.trim(),
                        game = $("select", menu).value;
                    socket.emit("join", nick, game);
                    break;
            }
            e.preventDefault();
        });

        on(document.body, "keydown", function(e) {
            switch (e.keyCode) {
                case 37:
                    myMotor.turn(Game.Motor.LEFT);
                    rotate += 90;
                    e.preventDefault();
                    break;
                case 39:
                    myMotor.turn(Game.Motor.RIGHT);
                    rotate -= 90;
                    e.preventDefault();
                    break;
            }
        });
    }

    /**
     * Init client
     */
    function init() {
        myMatch = new Game.Match();
        myMotor = myMatch.add(0, 100, Game.Motor.UP);
        myMatch.add(0, -100, Game.Motor.DOWN, true);
        myMatch.add(-100, 0, Game.Motor.RIGHT, true);
        myMatch.add(100, 0, Game.Motor.LEFT, true);
        socket = io();
        bind();
        //anim();
        setInterval(function() {
            myMatch.ai();
        }, 25);
    }

    return {
        init: init
    };

})();

window.onload = App.init;
