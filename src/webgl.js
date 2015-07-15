(function () {

	var canvas, //canvas object
		gl, //WebGL context
		program, //shader program
		vertexShader, //vertex shader
		fragmentShader, //fragment shader
		colorLocation, //color location param
		matrixLocation, //matrix location param
		positionLocation, //position location param
		fieldOfViewRadians, //FOV param
		board; //board

	function Board(s) {
		this.geometry = [
			-s, -s, 0,
			s, -s, 0,
			-s, s, 0,
			s, -s, 0,
			s, s, 0,
			-s, s, 0,
		];
		this.colors = [];
	};

	Board.prototype.color = function(r, g, b) {
		for (var i = 0; i < this.geometry.length; i += 3) {
			this.colors[i] = r;
			this.colors[i + 1] = g;
			this.colors[i + 2] = b;
		};
	};

	function createShader(gl, script, type) {
		var shader = gl.createShader(type);
		gl.shaderSource(shader, script);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			gl.deleteShader(shader);
		}
		return shader;
	}

	function createProgram(gl, shaders) {
		var program = gl.createProgram();
		for (var i = 0; i < shaders.length; i++) {
			gl.attachShader(program, shaders[i]);
		}
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			gl.deleteProgram(program);
		} else {
			gl.useProgram(program);
		}
		return program;
	}

	function makePerspective(fieldOfViewInRadians, aspect, near, far) {
		var f = Math.tan(Math.PI * 0.5 - 0.5 * fieldOfViewInRadians),
			rangeInv = 1.0 / (near - far);
		return [
			f / aspect, 0, 0, 0,
			0, f, 0, 0,
			0, 0, (near + far) * rangeInv, -1,
			0, 0, near * far * rangeInv * 2, 0
		];
	};

	function makeTranslation(tx, ty, tz) {
		return [
			1, 0, 0, 0,
			0, 1, 0, 0,
			0, 0, 1, 0,
			tx, ty, tz, 1
		];
	}

	function makeXRotation(angleInRadians) {
		var c = Math.cos(angleInRadians);
		var s = Math.sin(angleInRadians);
		return [
			1, 0, 0, 0,
			0, c, s, 0,
			0, -s, c, 0,
			0, 0, 0, 1
		];
	};

	function makeYRotation(angleInRadians) {
		var c = Math.cos(angleInRadians);
		var s = Math.sin(angleInRadians);
		return [
			c, 0, -s, 0,
			0, 1, 0, 0,
			s, 0, c, 0,
			0, 0, 0, 1
		];
	};

	function makeZRotation(angleInRadians) {
		var c = Math.cos(angleInRadians);
		var s = Math.sin(angleInRadians);
		return [
			c, s, 0, 0,
			-s, c, 0, 0,
			0, 0, 1, 0,
			0, 0, 0, 1,
		];
	}

	function makeScale(sx, sy, sz) {
		return [
			sx, 0, 0, 0,
			0, sy, 0, 0,
			0, 0, sz, 0,
			0, 0, 0, 1,
		];
	}

	function matrixMultiply(a, b) {
		var a00 = a[0 * 4 + 0],
			a01 = a[0 * 4 + 1],
			a02 = a[0 * 4 + 2],
			a03 = a[0 * 4 + 3],
			a10 = a[1 * 4 + 0],
			a11 = a[1 * 4 + 1],
			a12 = a[1 * 4 + 2],
			a13 = a[1 * 4 + 3],
			a20 = a[2 * 4 + 0],
			a21 = a[2 * 4 + 1],
			a22 = a[2 * 4 + 2],
			a23 = a[2 * 4 + 3],
			a30 = a[3 * 4 + 0],
			a31 = a[3 * 4 + 1],
			a32 = a[3 * 4 + 2],
			a33 = a[3 * 4 + 3],
			b00 = b[0 * 4 + 0],
			b01 = b[0 * 4 + 1],
			b02 = b[0 * 4 + 2],
			b03 = b[0 * 4 + 3],
			b10 = b[1 * 4 + 0],
			b11 = b[1 * 4 + 1],
			b12 = b[1 * 4 + 2],
			b13 = b[1 * 4 + 3],
			b20 = b[2 * 4 + 0],
			b21 = b[2 * 4 + 1],
			b22 = b[2 * 4 + 2],
			b23 = b[2 * 4 + 3],
			b30 = b[3 * 4 + 0],
			b31 = b[3 * 4 + 1],
			b32 = b[3 * 4 + 2],
			b33 = b[3 * 4 + 3];
		return [
			a00 * b00 + a01 * b10 + a02 * b20 + a03 * b30,
			a00 * b01 + a01 * b11 + a02 * b21 + a03 * b31,
			a00 * b02 + a01 * b12 + a02 * b22 + a03 * b32,
			a00 * b03 + a01 * b13 + a02 * b23 + a03 * b33,
			a10 * b00 + a11 * b10 + a12 * b20 + a13 * b30,
			a10 * b01 + a11 * b11 + a12 * b21 + a13 * b31,
			a10 * b02 + a11 * b12 + a12 * b22 + a13 * b32,
			a10 * b03 + a11 * b13 + a12 * b23 + a13 * b33,
			a20 * b00 + a21 * b10 + a22 * b20 + a23 * b30,
			a20 * b01 + a21 * b11 + a22 * b21 + a23 * b31,
			a20 * b02 + a21 * b12 + a22 * b22 + a23 * b32,
			a20 * b03 + a21 * b13 + a22 * b23 + a23 * b33,
			a30 * b00 + a31 * b10 + a32 * b20 + a33 * b30,
			a30 * b01 + a31 * b11 + a32 * b21 + a33 * b31,
			a30 * b02 + a31 * b12 + a32 * b22 + a33 * b32,
			a30 * b03 + a31 * b13 + a32 * b23 + a33 * b33
		];
	}

	function render() {
		var aspect = canvas.clientWidth / canvas.clientHeight,
			geometry = board.geometry,
			colors = board.colors,
			buffer,
			matrix;
		matrix = makeScale(1, 1, 1);
		matrix = matrixMultiply(matrix, makeXRotation(-1));
		matrix = matrixMultiply(matrix, makeYRotation(0));
		matrix = matrixMultiply(matrix, makeZRotation(0));
		matrix = matrixMultiply(matrix, makeTranslation(0, 0, -350));
		matrix = matrixMultiply(matrix, makePerspective(fieldOfViewRadians, aspect, 1, 2000));

		buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.enableVertexAttribArray(positionLocation);
		gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry), gl.STATIC_DRAW);

		buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.enableVertexAttribArray(colorLocation);
		gl.vertexAttribPointer(colorLocation, 3, gl.UNSIGNED_BYTE, true, 0, 0);
		gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(colors), gl.STATIC_DRAW);

		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		gl.uniformMatrix4fv(matrixLocation, false, matrix);
		gl.drawArrays(gl.TRIANGLES, 0, geometry.length / 3);

		window.requestAnimationFrame(render);
	}

	function init() {
		canvas = document.getElementById("canvas");
		gl = canvas.getContext("experimental-webgl");
		vertexShader = createShader(gl, document.getElementById("3d-vertex-shader").text, gl.VERTEX_SHADER);
		fragmentShader = createShader(gl, document.getElementById("3d-fragment-shader").text, gl.FRAGMENT_SHADER);
		program = createProgram(gl, [vertexShader, fragmentShader]);
		colorLocation = gl.getAttribLocation(program, "a_color");
		matrixLocation = gl.getUniformLocation(program, "u_matrix");
		positionLocation = gl.getAttribLocation(program, "a_position");
		fieldOfViewRadians = Math.PI / 180 * 60,
		gl.enable(gl.CULL_FACE);
		gl.enable(gl.DEPTH_TEST);

		board = new Board(125);
		board.color(255, 255, 255);
		render();
	}

	window.onload = init;
})();