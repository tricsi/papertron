var assert = require('assert'),
    game = require('../src/game.js');

var motor = new game.Motor(0, 0, 1);
motor.move(40);

describe('game.Motor', function() {
    describe('check', function() {
        it('return true when crossing', function() {
            assert.equal(true, motor.check(10, 10, 10, -10));
        });
        it('return true when contacting', function() {
            assert.equal(true, motor.check(0, 10, 0, -10));
        });
        it('return false when not crossing', function() {
            assert.equal(false, motor.check(50, 10, 50, -10));
        });
        it('return false when paralel', function() {
            assert.equal(false, motor.check(0, 10, 10, 10));
        });
        it('return true when fade', function() {
            assert.equal(true, motor.check(0, 0, 10, 0));
        });
    });
});
