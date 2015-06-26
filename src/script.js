var App = (function() {
    "use strict";

	var container,
		canvas,
		ctx,
		width,
		height,
		rotate,
        myMotor;

	function render() {
		canvas.style.transform = "translate(" + (-myMotor.x) + "px," + (-myMotor.y) + "px)";
        container.style.transform = "rotateX(60deg) translateY(100px) scale(2) rotateZ(" + rotate + "deg)";
        ctx.save();
		ctx.clearRect(0, 0, width, height);
		ctx.translate(Math.round(width / 2), Math.round(height / 2));
        Game.motors.forEach(function(motor) {
			ctx.save();
			ctx.beginPath();
			ctx.moveTo(motor.x, motor.y);
			for (var i = 0; i < motor.data.length; i++) {
				ctx.lineTo(motor.data[i][0], motor.data[i][1]);
			}
			ctx.stroke();
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
		bind();
		anim();
	}

	return {
		init: init
	};

})();

window.onload = App.init;
