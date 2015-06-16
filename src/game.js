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
	
	Motor.prototype.turn = function (to){
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

    Motor.prototype.check = function(x1, y1, x2, y2) {
        var i = this.data.length - 1,
            x = this.data[i][0],
            y = this.data[i][1],
            a1 = y2 - y1,
            b1 = x1 - x2,
            c1 = a1 * x1 + b1 * y1,
            a2 = y - this.y,
            b2 = this.x - x,
            c2 = a2 * this.x + b2 * this.y;
            d = a1 * b2 - a2 * b1;
        if (d == 0) {
            return false;
        } else {
            x = (b2 * c1 - b1 * c2) / d;
            y = (a1 * c2 - a2 * c1) / d;
            console.log([x, y]);
            x1 -= x;
            x2 -= x;
            y1 -= y;
            y2 -= y;
            return x1 <= 0 && x2 >= 0 || x2 <= 0 && x1 >= 0 || y1 <= 0 && y2 >= 0 || y2 <= 0 && y1 >= 0;
        }
    };

	function add(x, y, v) {
		var motor = new Motor(x, y, v);
		motors.push(motor);
		return motor;
	}

    function check(motor)
    {
        var result = false;
        motors.forEach(function(other) {
            var x = other.x,
                y = other.y;
            other.data.forEach(function(item) {
                if (motor.check(x, y, item[0], item[1])) {
                    result = true;
                }
                x = item[0];
                y = item[1];
            });
        });
        return result;
    }

	function get() {
		return motors;
	}

	function run() {
		frame++;
		motors.forEach(function(motor) {
            if (!check(motor)) {
                motor.move();
            }
		});
	}

	return {
		get: get,
		add: add,
		run: run
	};
	
})();