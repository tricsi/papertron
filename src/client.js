/**
 * Client application
 */
var App = (function() {
    "use strict";

	var container,
		canvas,
		ctx,
		width,
		height,
		rotate,
        colors = ["#00c", "#c00", "#0f0", "#f0c"],
        myMatch,
        myMotor;

    /**
     * Render 2D canvas
     */
	function render() {
		canvas.style.transform = "translate(" + (-myMotor.x * 2) + "px," + (-myMotor.y * 2 + 50) + "px)";
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
        document.body.addEventListener("keydown", function(e) {
            if (!myMotor.stuck) {
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
            }
        }, false);
    }

    /**
     * Init client
     */
    function init() {
		container = document.getElementById("container");
		canvas = document.getElementById("canvas");
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
