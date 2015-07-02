var App = (function() {
    "use strict";

	var container,
		canvas,
		ctx,
		width,
		height,
		rotate,
        colors = ["#00c", "#c00", "#0f0"],
        socket,
        myMotor;

	function render() {
		canvas.style.transform = "translate(" + (-myMotor.x) + "px," + (-myMotor.y) + "px)";
        container.style.transform = "rotateX(60deg) translateY(100px) scale(2) rotateZ(" + rotate + "deg)";
        ctx.save();
		ctx.clearRect(0, 0, width, height);
		ctx.translate(Math.round(width / 2), Math.round(height / 2));
        Game.motors.forEach(function(motor, color) {
			ctx.save();
            //line
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
            ctx.lineTo(2, 5);
            ctx.lineTo(-2, 5);
            ctx.closePath();
            ctx.fillStyle = colors[color];
            ctx.fill();
			ctx.restore();
		});
		ctx.restore();
	}

	function anim() {
		requestAnimationFrame(anim);
		Game.run();
		render();
	}

	function bind() {
		document.body.addEventListener("keydown", function(e) {
			switch (e.keyCode) {
				case 37:
                    if (myMotor.turn(Game.Motor.LEFT)) {
                        rotate += 90;
                    }
                    e.preventDefault();
					break;
				case 39:
                    if (myMotor.turn(Game.Motor.RIGHT)) {
                        rotate -= 90;
                    }
                    e.preventDefault();
					break;
			}
		}, false);
	}

	function init() {
		container = document.getElementById("container");
		canvas = document.getElementById("canvas");
		ctx = canvas.getContext("2d");
		width = canvas.width;
		height = canvas.height;
		rotate = 0;
        myMotor = Game.add(0, 50, Game.Motor.UP);
        Game.add(0, -50, Game.Motor.DOWN);
        socket = io();
		bind();
		anim();
	}

	return {
		init: init
	};

})();

window.onload = App.init;
