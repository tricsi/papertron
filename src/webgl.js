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
        models,
        outShader,
        cellShader;

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

	function createPart(x1, y1, x2, y2, v, s, z, end) {
		var xa = 0,
			ya = 0,
			xb = 0,
			yb = 0,
            xn = 0,
            yn = 0,
			data = {};
		switch (v) {
			case 0:
				xa = s;
				yb = s;
                xn = 1;
				break;
			case 1:
				ya = -s;
				xb = s;
                yn = -1;
				break;
			case 2:
				xa = -s;
				yb = -s;
                xn = -1;
				break;
			case 3:
				ya = s;
				xb = -s;
                yn = 1;
				break;
		}
		data.vert = [
			x1 + xa + xb, y1 + ya + yb, 0,
			x1, y1, z,
			x2, y2, z,
			x1 - xa + xb, y1 - ya + yb, 0,
			x2, y2, z,
			x1, y1, z,
			x2 + xa - xb, y2 + ya - yb, 0,
			x1 + xa + xb, y1 + ya + yb, 0,
			x2, y2, z,
			x2 - xa - xb, y2 - ya - yb, 0,
			x2, y2, z,
			x1 - xa + xb, y1 - ya + yb, 0
		];
		data.norm = [
			xn, yn, 0,
			xn, yn, 0,
			xn, yn, 0,
			-xn, -yn, 0,
			-xn, -yn, 0,
			-xn, -yn, 0,
			xn, yn, 0,
			xn, yn, 0,
			xn, yn, 0,
			-xn, -yn, 0,
			-xn, -yn, 0,
			-xn, -yn, 0
		];
		if (end & 1) {
            data.vert.push(
                x1 + xa + xb, y1 + ya + yb, 0,
                x1 - xa + xb, y1 - ya + yb, 0,
                x1, y1, z
            );
            data.norm.push(
                yn, xn, 0,
                yn, xn, 0,
                yn, xn, 0
            );
		}
		if (end & 2) {
            data.vert.push(
                x2 + xa - xb, y2 + ya - yb, 0,
                x2, y2, z,
                x2 - xa - xb, y2 - ya - yb, 0
            );
            data.norm.push(
                yn, -xn, 0,
                yn, -xn, 0,
                yn, -xn, 0
            );
		}
		return data;
	}

	function createLine(dots, color, dec) {
		var i,
			j,
            x,
            y,
            t,
            s,
			end,
			part,
			data = {
				color: color,
				vert: [],
				norm: [],
				idx: []
			};
        s = 1;
        t = dots[0][3] - dots[1][3];
        if (t < dec) {
            s = 2;
            t = dec - t;
        } else {
            t = dec;
        }
		x = dots[s-1][0];
        y = dots[s-1][1];
        switch (dots[s][2]) {
            case 0:
                y -= t;
                break;
            case 1:
                x -= t;
                break;
            case 2:
                y += t;
                break;
            case 3:
                x += t;
                break;
        }
		for (i = s; i < dots.length; i++) {
			j = data.vert.length / 3;
			end = 0;
			if (i === s) {
				end = 1;
			}
			if (i === dots.length - 1) {
				end = end | 2;
			}
			part = createPart(x, y, dots[i][0],  dots[i][1], dots[i][2], .2, 2, end);
			data.vert = data.vert.concat(part.vert);
			data.norm = data.norm.concat(part.norm);
			x = dots[i][0];
            y = dots[i][1];
		}
		return data;
	}

    function createBoard(color, s, z) {
        var n = z > 0 ? 1 : -1;
        return {
            color: color,
            vert: [
                -s, -s, 0,
    			s, -s, 0,
    			-s, s, 0,
    			-s, s, 0,
     			s, -s, 0,
                s, s, 0,
                -s, -s, 0,
    			-s, -s, z,
    			s, -s, 0,
               s, -s, 0,
    			-s, -s, z,
    			s, -s, z,
    			s, s, 0,
    			s, -s, 0,
    			s, -s, z,
    			s, s, 0,
    			s, -s, z,
    			s, s, z,
    			-s, s, 0,
    			s, s, 0,
    			s, s, z,
    			-s, s, 0,
    			s, s, z,
    			-s, s, z,
    			-s, -s, 0,
    			-s, s, 0,
    			-s, s, z,
    			-s, -s, z,
    			-s, -s, 0,
    			-s, s, z
             ],
            norm: [
                -1, -1, 1,
                1, -1, 1,
                -1, 1, 1,
                -1, 1, 1,
                1, -1, 1,
                1, 1, 1,
                0, n, 0,
                0, n, 0,
                0, n, 0,
                0, n, 0,
                0, n, 0,
                0, n, 0,
                -n, 0, 0,
                -n, 0, 0,
                -n, 0, 0,
                -n, 0, 0,
                -n, 0, 0,
                -n, 0, 0,
                0, -n, 0,
                0, -n, 0,
                0, -n, 0,
                0, -n, 0,
                0, -n, 0,
                0, -n, 0,
                n, 0, 0,
                n, 0, 0,
                n, 0, 0,
                n, 0, 0,
                n, 0, 0,
                n, 0, 0
            ]
        };
    }

    function createModel(data) {
        var model = {
                scale: [1, 1, 1],
                trans: [0, 0, 0],
                rotate: [0, 0, 0]
            },
            color = [],
            i;

        for (i = 0; i < data.vert.length; i++) {

            color.push(data.color[i % data.color.length]);
        }

		//coordinates
		model.vert = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, model.vert);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.vert), gl.STATIC_DRAW);

		//normals
		model.norm = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, model.norm);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data.norm), gl.STATIC_DRAW);

		//colors
		model.color = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, model.color);
		gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(color), gl.STATIC_DRAW);

        model.size = data.vert.length / 3;
        return model;
    }

	function render() {
		var aspect = canvas.width / canvas.height,
			matrix,
			normal = [
				0, 0, 0,
				0, 0, 0,
				0, 0, 0
			];
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        for (var name in models) {
            var model = models[name];
    		matrix = makeScale(model.scale[0], model.scale[1], model.scale[2]);
    		matrix = matrixMultiply(matrix, makeZRotation(model.rotate[2]));
    		matrix = matrixMultiply(matrix, makeXRotation(model.rotate[0]));
    		matrix = matrixMultiply(matrix, makeYRotation(model.rotate[1]));
    		matrix = matrixMultiply(matrix, makeTranslation(model.trans[0], model.trans[1], model.trans[2]));

            normal = matrixInverse(matrix, normal);
            normal = matrixTranspose(normal, normal);

    		matrix = matrixMultiply(matrix, makeZRotation(rotate.z));
    		matrix = matrixMultiply(matrix, makeXRotation(rotate.x));
    		matrix = matrixMultiply(matrix, makeYRotation(rotate.y));
    		matrix = matrixMultiply(matrix, makeTranslation(0, 0, scale - 30));
    		matrix = matrixMultiply(matrix, makePerspective(fieldOfViewRadians, aspect, 1, 2000));

            gl.useProgram(cellShader.program);
    		gl.uniformMatrix4fv(cellShader.matrix, false, matrix);
    		gl.uniformMatrix3fv(cellShader.normal, false, normal);

    		//normals
    		gl.bindBuffer(gl.ARRAY_BUFFER, model.norm);
            gl.enableVertexAttribArray(cellShader.normals);
    	  	gl.vertexAttribPointer(cellShader.normals, 3, gl.FLOAT, false, 0, 0);

    		//coordinates
    		gl.bindBuffer(gl.ARRAY_BUFFER, model.vert);
            gl.enableVertexAttribArray(cellShader.position);
    		gl.vertexAttribPointer(cellShader.position, 3, gl.FLOAT, false, 0, 0);

    		//colors
    		gl.bindBuffer(gl.ARRAY_BUFFER, model.color);
            gl.enableVertexAttribArray(cellShader.color);
    		gl.vertexAttribPointer(cellShader.color, 3, gl.UNSIGNED_BYTE, true, 0, 0);

    		//render
    		gl.drawArrays(gl.TRIANGLES, 0, model.size);
        }
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
			x = e.clientX;
			y = e.clientY;
			drag = true;
		}, false);

		body.addEventListener("mousemove", function(e) {
			if (drag) {
                e.preventDefault();
				rotate.x -= (y - e.clientY) / 100;
				rotate.y -= (x - e.clientX) / 100;
				x = e.clientX;
				y = e.clientY;
                render();
			}
		}, false);

		body.addEventListener("mouseup", function(e) {
			drag = false;
		}, false);

		body.addEventListener("mousewheel", function(e) {
			scale += e.wheelDelta / 10;
            render();
		}, false);
	}

	function resize() {
		canvas.width = canvas.clientWidth;
		canvas.height = canvas.clientHeight;
		gl.viewport(0, 0, canvas.width, canvas.height);
	}

	return function () {
		canvas = document.getElementById("canvas");
		gl = canvas.getContext("experimental-webgl");
        program = createProgram(gl, [
            createShader(gl, document.getElementById("cellVert").text, gl.VERTEX_SHADER),
            createShader(gl, document.getElementById("cellFrag").text, gl.FRAGMENT_SHADER)
        ]);
        cellShader = {
            program: program,
            color: gl.getAttribLocation(program, "a_color"),
            position: gl.getAttribLocation(program, "a_position"),
            normals: gl.getAttribLocation(program, "a_normals"),
            matrix: gl.getUniformLocation(program, "u_matrix"),
            normal: gl.getUniformLocation(program, "u_normal")
        };
		gl.enable(gl.CULL_FACE);
		gl.enable(gl.DEPTH_TEST);
		fieldOfViewRadians = Math.PI / 180 * 60,
		rotate = {x:-1.2, y:1, z:0};
		scale = 1;
        models = {};
		models.Line = createModel(createLine([
			[0, 0, 1, 150],
			[0, -50, 0, 100],
			[50, -50, 3, 50],
			[50, 0, 2, 0]
		], [160, 16, 0], 5));
        models.Board = createModel(createBoard([192, 128, 64], 100, 200));
        models.Bike = createModel({
            color: [160, 16, 0],
            vert: [1,4,2,-1,4,2,-0.5,4,4,1,4,2,0.5,4,4,1,2,4,-0.5,0,4,0.5,0,4,0.5,0.5,4,-1,4,2,-0.5,4,0,-1,2,-0,0.5,0,-0,-0.5,0,-0,-1,2,-0,-0.5,0.5,4,-0.5,0.5,6,-0.5,3.5,6,-0.5,3.5,4,-1,2,4,-0.5,0.5,4,0.5,0.5,4,1,2,4,0.5,3.5,4,0.5,3.5,6,0.5,3.5,4,0.5,3.5,2,0.5,3.5,4,0.5,3.5,6,0.5,0.5,6,1,4,8,0.5,4,10,1,2,10,0.5,0.5,6,0.5,3.5,6,1,2,6,-0.5,3.5,6,-0.5,0.5,6,-1,2,6,0.5,0.5,6,0.5,0,6,-0.5,0,6,0.5,4,10,-0.5,4,10,-1,2,10,-1,0,8,-0.5,0,10,-1,2,10,1,4,8,-1,4,8,-0.5,4,10,0.5,4,6,-0.5,4,6,-1,4,8,-1,4,8,-0.4,2,8,-1,2,10,-1,2,6,-0.4,2,8,-1,4,8,-1,2,6,-0.5,0,6,-1,0,8,1,2,10,-1,2,10,-0.5,0,10,1,0,8,0.4,2,8,1,2,10,1,2,6,0.4,2,8,1,0,8,1,2,6,0.5,4,6,1,4,8,1,2,0,-1,2,-0,-0.5,4,0,-1,0,2,-0.4,2,2,-1,2,-0,-1,2,4,-0.4,2,2,-1,0,2,-1,2,4,-0.5,4,4,-1,4,2,1,0,2,0.4,2,2,1,2,4,1,2,0,0.4,2,2,1,0,2,1,2,0,0.5,4,0,1,4,2,0.5,4,0,-0.5,4,0,-1,4,2,-0.5,3.5,8,-0.5,3.5,8,-0.5,3.5,2,-0.5,3.5,4,-0.5,3.5,6,-0.5,3.5,8,0.5,3.5,2,0.5,3.5,2,0.5,3.5,8,-0.5,3.5,2,-0.5,3.5,2,0.5,3.5,2,0.5,3.5,2,0.5,3.5,2,0.5,3.5,8,0.5,3.5,8,0.5,3.5,8,-0.5,3.5,8,-0.5,3.5,2,-0.5,3.5,8,-0.5,4.3,8,0.5,3.5,8,0.5,3.5,8,-0.5,3.5,8,-0.5,3.5,8,-0.5,3.5,8,-0.5,3.5,2,-0.5,3.5,2,-0.5,3.5,2,0.5,3.5,2,0.5,5.5,2,-0.5,5.5,2,-0.5,4.3,8,-0.5,3.5,2,-0.5,5.5,2,0.5,5.5,2,0.5,3.5,2,0.5,5.5,2,0.5,4.3,8,0.5,3.5,8,0.5,4.3,8,-0.5,4.3,8,0.5,4,4,1,4,2,-0.5,4,4,0.4,2,2,1,4,2,1,2,4,-0.5,0.5,4,-0.5,0,4,0.5,0.5,4,-0.4,2,2,-1,4,2,-1,2,-0,1,2,0,0.5,0,-0,-1,2,-0,-0.5,3.5,4,-0.5,0.5,4,-0.5,3.5,6,-1,2,4,-0.5,3.5,4,-0.5,4,4,-1,2,4,-0.5,0,4,-0.5,0.5,4,1,2,4,0.5,0.5,4,0.5,0,4,1,2,4,0.5,4,4,0.5,3.5,4,0.5,3.5,8,0.5,3.5,6,0.5,3.5,2,0.5,0.5,4,0.5,3.5,4,0.5,0.5,6,0.4,2,8,1,4,8,1,2,10,1,2,6,0.5,0,6,0.5,0.5,6,0.5,3.5,6,0.5,4,6,1,2,6,-1,2,6,-0.5,4,6,-0.5,3.5,6,-0.5,0.5,6,-0.5,0,6,-1,2,6,-0.5,0.5,6,0.5,0.5,6,-0.5,0,6,1,2,10,0.5,4,10,-1,2,10,-0.4,2,8,-1,0,8,-1,2,10,0.5,4,10,1,4,8,-0.5,4,10,1,4,8,0.5,4,6,-1,4,8,-0.5,4,10,-1,4,8,-1,2,10,-0.5,4,6,-1,2,6,-1,4,8,-0.4,2,8,-1,2,6,-1,0,8,0.5,0,10,1,2,10,-0.5,0,10,0.5,0,10,1,0,8,1,2,10,0.5,0,6,1,2,6,1,0,8,0.4,2,8,1,2,6,1,4,8,0.5,4,0,1,2,0,-0.5,4,0,-0.5,0,-0,-1,0,2,-1,2,-0,-0.5,0,4,-1,2,4,-1,0,2,-0.4,2,2,-1,2,4,-1,4,2,0.5,0,4,1,0,2,1,2,4,0.5,0,-0,1,2,0,1,0,2,0.4,2,2,1,2,0,1,4,2,1,4,2,0.5,4,0,-1,4,2,-0.5,3.5,2,-0.5,3.5,8,-0.5,3.5,2,-0.5,3.5,2,-0.5,3.5,4,-0.5,3.5,8,0.5,3.5,8,0.5,3.5,2,0.5,3.5,8,0.5,3.5,2,-0.5,3.5,2,0.5,3.5,2,0.5,3.5,8,0.5,3.5,2,0.5,3.5,8,-0.5,3.5,8,0.5,3.5,8,-0.5,3.5,8,-0.5,5.5,2,-0.5,3.5,2,-0.5,4.3,8,-0.5,3.5,8,0.5,3.5,8,-0.5,3.5,8,-0.5,3.5,2,-0.5,3.5,8,-0.5,3.5,2,0.5,3.5,2,-0.5,3.5,2,0.5,3.5,2,0.5,4.3,8,0.5,5.5,2,-0.5,4.3,8,0.5,3.5,2,-0.5,3.5,2,0.5,5.5,2,0.5,3.5,8,0.5,3.5,2,0.5,4.3,8,-0.5,3.5,8,0.5,3.5,8,-0.5,4.3,8],
            norm: [0,1,0,0,1,0,0,1,0,1,-0,0,0.9,0.2,0.2,1,0,-0,0,0,1,0,0,1,0,0,1,-1,-0,0,-0.9,0.2,-0.2,-1,0,0,0,0,-1,0,0,-1,0,0,-1,-1,0,0,-1,0,0,-1,0,0,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0.9,-0.4,0,0,-1,0,0.1,0.9,0.5,1,0,0,1,0,0,1,0,0,1,-0,0,0.9,0.2,0.2,1,0,-0,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,1,0,0,1,0,0,1,-1,0,0,-0.9,-0.2,0.2,-1,0,-0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,-1,-0,0,-1,0,0,-1,0,-0,-1,0,0,-1,0,0,-1,-0,0,-1,0,0,-0.9,-0.2,-0.2,-1,0,0,0,0,1,0,0,1,0,0,1,1,0,0,1,0,0,1,0,-0,1,0,0,1,0,0,1,0,0,1,0,0,0.9,0.2,-0.2,1,-0,0,0,0,-1,0,0,-1,0,0,-1,-1,0,0,-1,0,0,-1,0,0,-1,0,-0,-1,0,0,-1,0,0,-1,0,-0,-0.9,0.2,0.2,-1,-0,0,1,0,0,1,0,0,1,0,-0,1,0,0,1,0,0,1,0,0,1,0,0,0.9,0.2,-0.2,1,-0,0,0,1,0,0,1,0,0,1,0,0,0,1,0,0,1,0,0,1,-0.7,0.7,0,-1,0,0,-0.1,0.4,0.9,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,-1,0,0,-1,0,0,-1,0,0,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,1,0.2,0,1,0.2,0,1,0.2,0,0,-1,0,0,-1,0,0,-1,1,0,0,1,0,0,1,0,0,0,0,1,0,0,1,0,0,1,0,1,0,0,1,0,0,1,0,1,0,0,1,-0,0,1,0,-0,0,0,1,0,0,1,0,0,1,-1,0,0,-1,-0,0,-1,0,0,0,0,-1,0,0,-1,0,0,-1,-1,0,0,-1,0,0,-1,0,0,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0.1,0.4,0.9,0.9,-0.4,0,0.1,0.9,0.5,1,0,0,1,0,0,1,0,0,1,0,0,1,-0,0,1,0,-0,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,1,0,0,1,0,0,1,-1,0,0,-1,0,0,-1,0,-0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,-0.9,0.2,0.2,-1,-0,0,-1,0,-0,-0.9,0.2,-0.2,-1,0,0,-1,-0,0,-1,0,0,-1,0,0,-1,0,0,0,0,1,0,0,1,0,0,1,0.9,-0.2,0.2,1,0,0,1,0,-0,0.9,-0.2,-0.2,1,0,0,1,0,0,1,0,0,1,0,0,1,-0,0,0,0,-1,0,0,-1,0,0,-1,-0.9,-0.2,-0.2,-1,0,0,-1,0,0,-0.9,-0.2,0.2,-1,0,-0,-1,0,0,-1,0,0,-1,0,-0,-1,-0,0,0.9,-0.2,0.2,1,0,0,1,0,-0,0.9,-0.2,-0.2,1,0,0,1,0,0,1,0,0,1,0,0,1,-0,0,0,1,0,0,1,0,0,1,0,0,0,1,0,0,1,0,0,1,-0.1,0.9,0.5,-0.7,0.7,0,-0.1,0.4,0.9,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,-1,0,0,-1,0,0,-1,0,0,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,1,0.2,0,1,0.2,0,1,0.2,0,0,-1,0,0,-1,0,0,-1,1,0,0,1,0,0,1,0,0,0,0,1,0,0,1,0,0,1]
    	});
        models.Bike.rotate = [Math.PI / 2, 0, 0];
        models.Bike.scale = [.5, .5, .5];
		resize();
		bind();
		render();
		onresize = resize;
	};

})();