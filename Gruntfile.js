module.exports = function(grunt) {
    "use strict";

    grunt.initConfig({

        "pkg": grunt.file.readJSON("package.json"),

        "uglify": {
            main: {
                files: [{
                    expand: true,
                    cwd: "src",
                    src: ["*.js"],
                    dest: "dist",
                    ext: ".js"
                }]
            }
        },

        "compress": {
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

        "sync": {
            "main": {
                files: [{
                    cwd: "src",
                    expand: true,
                    src: ["*.html"],
                    dest: "dist"
                }],
                verbose: true
            }
        }

    });

    grunt.loadNpmTasks("grunt-sync");
    grunt.loadNpmTasks("grunt-contrib-uglify");
    grunt.loadNpmTasks("grunt-contrib-compress");
    grunt.registerTask("default", ["sync", "uglify", "compress"]);
};
