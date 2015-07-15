module.exports = function (grunt) {
	"use strict";

	grunt.initConfig({

		pkg: grunt.file.readJSON("package.json"),

		clean: ["dist"],

		uglify: {
			options: {
				compress: {
					drop_console: true
				}
			},
			dist: {
				files: [{
					expand: true,
					cwd: "src",
					src: ["*.js"],
					dest: "dist",
					ext: ".js"
				}]
			}
		},

		sass: {
			options: {
				outputStyle: "compressed"
			},
			dist: {
				files: {
					"src/style.css": "src/style.scss"
				}
			}
		},

		compress: {
			dist: {
				options: {
					archive: "dist.zip"
				},
				files: [{
					cwd: "dist",
					expand: true,
					src: ["*"],
					filter: "isFile"
				}]
			}
		},

		sync: {
			dist: {
				files: [{
					cwd: "src",
					expand: true,
					src: ["*.html", "*.css"],
					dest: "dist"
				}],
				verbose: true
			}
		},

		watch: {
			sass: {
				files: ["src/*.scss"],
				tasks: ["sass"],
				options: {
					spawn: false
				}
			}
		}

	});

	grunt.loadNpmTasks("grunt-contrib-clean");
	grunt.loadNpmTasks("grunt-contrib-compress");
	grunt.loadNpmTasks("grunt-contrib-uglify");
	grunt.loadNpmTasks("grunt-contrib-watch");
	grunt.loadNpmTasks("grunt-sass");
	grunt.loadNpmTasks("grunt-sync");
	grunt.registerTask("default", ["clean", "sass", "sync", "uglify", "compress"]);
};
