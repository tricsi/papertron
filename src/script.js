var App = (function() {

	var canvas,
		ctx,
		width,
		height,
		motor;

	function render() {
		var motors = Game.get(),
			motor = motors[0];
		canvas.style.transform = 'rotate(' + (motor.v * -90) + 'deg) translate(' + (-motor.x) + 'px,' + (-motor.y) + 'px)';
		ctx.save();
		ctx.clearRect(0, 0, width, height);
		ctx.translate(Math.round(width / 2), Math.round(height / 2));
		motors.forEach(function(motor) {
			ctx.save();
			ctx.beginPath();
			ctx.moveTo(motor.x, motor.y);
			for (var i=motor.data.length-1; i >= 0; i--) {
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
		document.body.addEventListener('keydown', function(e) {
			switch (e.keyCode) {
				case 39:
					motor.turn(1);
					break;
				case 37:
					motor.turn(3);
					break;
			}
		}, false);
	}

	function init(id) {
		canvas = document.getElementById('canvas');
		ctx = canvas.getContext('2d');
		width = canvas.width;
		height = canvas.height;
		motor = Game.add(0, 0, 0);
		bind();
		anim();
	}

	return {
		init: init
	};

})();

window.onload = App.init;