onload = (function () {

	var canvas, //canvas object
		gl, //WebGL context
		program, //shader program
		vertexShader, //vertex shader
		fragmentShader, //fragment shader
		colorLocation, //color location param
		matrixLocation, //matrix location param
		positionLocation, //position location param
		normalsLocation, //lighting normal vectors
		normalLocation, //light normal
		fieldOfViewRadians, //FOV param
		rotate,
		scale,
		Bike;

	function Data() {
		this.vert = [];
		this.norm = [];
		this.color = [];
	}

	Data.prototype.add = function (vert, norm, color) {
		var i = this.vert.length;
		this.vert = this.vert.concat(vert);
		for (i; i < this.vert.length; i += 3) {
			this.norm = this.norm.concat(norm);
			this.color = this.color.concat(color);
		}
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

	function matrixInverse(mat, dest) {
        var a00 = mat[0], a01 = mat[1], a02 = mat[2],
            a10 = mat[4], a11 = mat[5], a12 = mat[6],
            a20 = mat[8], a21 = mat[9], a22 = mat[10],

            b01 = a22 * a11 - a12 * a21,
            b11 = -a22 * a10 + a12 * a20,
            b21 = a21 * a10 - a11 * a20,

            d = a00 * b01 + a01 * b11 + a02 * b21,
            id;

        if (!d) { return null; }
        id = 1 / d;

        dest[0] = b01 * id;
        dest[1] = (-a22 * a01 + a02 * a21) * id;
        dest[2] = (a12 * a01 - a02 * a11) * id;
        dest[3] = b11 * id;
        dest[4] = (a22 * a00 - a02 * a20) * id;
        dest[5] = (-a12 * a00 + a02 * a10) * id;
        dest[6] = b21 * id;
        dest[7] = (-a21 * a00 + a01 * a20) * id;
        dest[8] = (a11 * a00 - a01 * a10) * id;

        return dest;
    }

	function matrixTranspose(a) {
		var a01 = a[1], a02 = a[2], a12 = a[5];
		a[1] = a[3];
		a[2] = a[6];
		a[3] = a01;
		a[5] = a[7];
		a[6] = a02;
		a[7] = a12;
		return a;
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

	function board(s) {
		return [
			-s, -s, 0,
			s, -s, 0,
			-s, s, 0,
			s, -s, 0,
			s, s, 0,
			-s, s, 0,
		];
	};

	function line(x1, y1, x2, y2, z) {
		return [
			x1, y1, 0,
			x1, y1, z,
			x2, y2, z,
			x2, y2, 0,
			x1, y1, 0,
			x2, y2, z,
			x1, y1, 0,
			x2, y2, z,
			x1, y1, z,
			x2, y2, 0,
			x2, y2, z,
			x1, y1, 0
		];
	}

	Bike = {
		vert: [
			1, 0, 0,
			0, 5, 0,
			0, 0, 2,
			0, 0, 2,
			0, 5, 0,
			-1, 0, 0,
			0, 0, 2,
			-1, 0, 0,
			1, 0, 0
		],
		norm: [
			-.3, 0, .5,
			-.3, 0, .5,
			-.3, 0, .5,
			.3, 0, .5,
			.3, 0, .5,
			.3, 0, .5,
			0, 1, 0,
			0, 1, 0,
			0, 1, 0
		],
		color: [
			255, 0, 0,
			255, 0, 0,
			255, 0, 0,
			255, 0, 0,
			255, 0, 0,
			255, 0, 0,
			255, 0, 0,
			255, 0, 0,
			255, 0, 0
		]
	};

	function move(data, cx, cy, angle) {
		var i,
			x,
			y,
			res = [],
			rad = (Math.PI / 180) * angle,
			cos = Math.cos(rad),
			sin = Math.sin(rad);
		for (i = 0; i < data.length; i += 3) {
			x = data[i];
			y = data[i + 1];
			res.push((cos * x) - (sin * y) + cx);
			res.push((sin * x) + (cos * y) + cy);
			res.push(data[i + 2]);
		}
	    return res;
	};

	function render() {
		var aspect = canvas.width / canvas.height,
			data = new Data(),
			buffer,
			matrix,
			normal = [
				0, 0, 0,
				0, 0, 0,
				0, 0, 0
			],
			dots = [
				[0, 0],
				[0, -50],
				[50, -50],
				[50, -20],
				[20, -20]
			],
			dot,
			i;

		//board
		data.add(board(100), [0, 0, 1], [255, 255, 255]);

		//line
		dot = dots[0];
		for (i = 0; i < dots.length; i++) {
			data.add(line(dot[0], dot[1], dots[i][0],  dots[i][1], 2), [0, -1, 0], [255, 0, 0]);
			dot = dots[i];
		}

		data.vert = data.vert.concat(move(Bike.vert, 0, 0, 90));
		data.norm = data.norm.concat(move(Bike.norm, 0, 0, 90));
		data.color = data.color.concat(Bike.color);

		matrix = makeScale(1, 1, 1);
		matrix = matrixMultiply(matrix, makeTranslation(0, 0, 0));
		matrix = matrixMultiply(matrix, makeXRotation(rotate.x));
		matrix = matrixMultiply(matrix, makeYRotation(rotate.y));
		matrix = matrixMultiply(matrix, makeZRotation(rotate.z));
		matrix = matrixMultiply(matrix, makeTranslation(0, 0, scale-250));
		matrix = matrixMultiply(matrix, makePerspective(fieldOfViewRadians, aspect, 1, 2000));

		normal = matrixInverse(matrix, normal);
		normal = matrixTranspose(normal, normal);

		//normals
		buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.enableVertexAttribArray(normalsLocation);
	  	gl.vertexAttribPointer(normalsLocation, 3, gl.FLOAT, false, 0, 0);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.norm), gl.STATIC_DRAW);

		//coordinates
		buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.enableVertexAttribArray(positionLocation);
		gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.vert), gl.STATIC_DRAW);

		//colors
		buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.enableVertexAttribArray(colorLocation);
		gl.vertexAttribPointer(colorLocation, 3, gl.UNSIGNED_BYTE, true, 0, 0);
		gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(data.color), gl.STATIC_DRAW);

		//render
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		gl.uniformMatrix4fv(matrixLocation, false, matrix);
		gl.uniformMatrix3fv(normalLocation, false, normal);
		gl.drawArrays(gl.TRIANGLES, 0, data.vert.length / 3);
	}

	function anim() {
		render();
		requestAnimationFrame(anim);
	}

	function bind() {
		var x,
			y,
			drag = false,
			body = document.body;

		body.addEventListener("mousedown", function(e) {
			x = e.x;
			y = e.y;
			drag = true;
		}, false);

		body.addEventListener("mousemove", function(e) {
			if (drag) {
				rotate.x -= (y - e.y) / 100;
				rotate.y -= (x - e.x) / 100;
				x = e.x;
				y = e.y;
				e.preventDefault();
			}
		}, false);

		body.addEventListener("mouseup", function(e) {
			drag = false;
		}, false);

		body.addEventListener("mousewheel", function(e) {
			scale -= e.deltaY / 10;
		}, false);
	}

	function resize() {
		canvas.width = canvas.clientWidth;
		canvas.height = canvas.clientHeight;
		gl.viewport(0, 0, canvas.width, canvas.height);
	}

	return function () {
		canvas = document.getElementById("canvas");
		gl = canvas.getContext("webgl");
		vertexShader = createShader(gl, document.getElementById("vert").text, gl.VERTEX_SHADER);
		fragmentShader = createShader(gl, document.getElementById("frag").text, gl.FRAGMENT_SHADER);
		program = createProgram(gl, [vertexShader, fragmentShader]);
		colorLocation = gl.getAttribLocation(program, "a_color");
		matrixLocation = gl.getUniformLocation(program, "u_matrix");
		positionLocation = gl.getAttribLocation(program, "a_position");
		normalsLocation = gl.getAttribLocation(program, "a_normals"),
		normalLocation = gl.getUniformLocation(program, "u_normal"),
		gl.enable(gl.CULL_FACE);
		gl.enable(gl.DEPTH_TEST);
		fieldOfViewRadians = Math.PI / 180 * 60,
		rotate = {x:0, y:0, z:0};
		scale = 1;

		resize();
		bind();
		anim();
		onresize = resize;
	};

})();