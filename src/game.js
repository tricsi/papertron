var Game = (function() {
	
	var frame = 0;
		motors = [];
	
	function Motor(x, y, v) {
		this.x = x;
		this.y = y;
		this.v = v;
		this.speed = 1;
		this.data = [];
		this.add();
	}
	
	Motor.UP = 0;
	Motor.RIGHT = 1;
	Motor.DOWN = 2;
	Motor.LEFT = 3;
	
	Motor.prototype.add = function() {
		this.data.push([this.x, this.y, this.v]);
	};
	
	Motor.prototype.move = function() {
		switch (this.v) {
			case Motor.LEFT:
				this.x -= this.speed;
				break;
			case Motor.RIGHT:
				this.x += this.speed;
				break;
			case Motor.UP:
				this.y -= this.speed;
				break;
			case Motor.DOWN:
				this.y += this.speed;
				break;
		}
	};
	
	Motor.prototype.turn = function(to) {
		switch (to) {
			case Motor.LEFT:
				if (--this.v < Motor.UP) this.v = Motor.LEFT;
				this.add();
				break;
			case Motor.RIGHT:
				if (++this.v > Motor.LEFT) this.v = Motor.UP;
				this.add();
				break;
		}
	};

	function add(x, y, v) {
		var motor = new Motor(x, y, v);
		motors.push(motor);
		return motor;
	}

	function get() {
		return motors;
	}

	function run() {
		frame++;
		motors.forEach(function(motor) {
				motor.move();
		});
	}

	return {
		get: get,
		add: add,
		run: run
	};
	
})();