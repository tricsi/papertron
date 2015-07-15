/**
 * Client application
 */
var App = (function() {
    "use strict";

    var container, //canvas container
        canvas, //canvas element
        ctx, //canvas context
        chat, //chat form
        text, //chat input
        texts, //chat messages
        menu, //menu container
        navs, //menu navigations
        width, //canvas width
        height, //canvas height
        rotate, //canvas rotation
        colors = ["#00c", "#c00", "#0f0", "#f0c"], //motor colors
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
     * Bind controls
     */
    function bind() {
        on(chat, "submit", function(e) {
            console.log(text.value);
            var br = document.createElement("br"),
                value = text.value.trim();
            if (value !== "") {
                texts.insertBefore(br, texts.firstChild);
                texts.insertBefore(document.createTextNode(value), br);
            }
            text.value = "";
            e.preventDefault();
        });
        on(menu, "click", function(e) {
            var i,
                id,
                item;
            if (e.target.tagName === "A") {
                 id = e.target.getAttribute("href").substr(1);
                 for (i = 0; i < navs.length; i++) {
                    item = navs.item(i);
                    item.className = item.id !== id ? "hide" : "";
                }
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
        container = $("#container");
        canvas = $("canvas");
        chat = $("form");
        text = $("input", chat);
        texts = $("div", chat);
        menu = $("#menu");
        navs = menu.getElementsByTagName("nav");
        ctx = canvas.getContext("2d");
        width = canvas.width;
        height = canvas.height;
        rotate = 0;
        myMatch = new Game.Match();
        myMotor = myMatch.add(0, 100, Game.Motor.UP);
        myMatch.add(0, -100, Game.Motor.DOWN, true);
        myMatch.add(-100, 0, Game.Motor.RIGHT, true);
        myMatch.add(100, 0, Game.Motor.LEFT, true);
        bind();
        anim();
        io();
        setInterval(function() {
            myMatch.ai();
        }, 25);
    }

    return {
        init: init
    };

})();

window.onload = App.init;
