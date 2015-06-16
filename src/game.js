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

Motor.prototype.inline = function(x, y, x1, y1, x2, y2) {
    x1 -= x;
    x2 -= x;
    y1 -= y;
    y2 -= y;
    return x1 <= 0 && x2 >= 0 || x2 <= 0 && x1 >= 0 || y1 <= 0 && y2 >= 0 || y2 <= 0 && y1 >= 0;
};

Motor.prototype.check = function(x1, y1, x2, y2) {
    var i = this.data.length - 1,
        x = this.data[i][0],
        y = this.data[i][1],
        d = ((x2 - x1) * (y - this.y)) - ((y2 - y1) * (x - this.x)),
        n1 = ((y1 - this.y) * (x - this.x)) - ((x1 - this.x) * (y - this.y)),
        n2 = ((y1 - this.y) * (x2 - x1)) - ((x1 - this.x) * (y2 - y1)),
        r,
        s;
    if (d == 0) {
        return n1 == 0 && n2 == 0;
    }
    r = n1 / d;
    s = n2 / d;
    return (r >= 0 && r <= 1) && (s >= 0 && s <= 1);
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

module.exports =  {
    Motor: Motor,
    check: check,
    get: get,
    add: add,
    run: run
};
