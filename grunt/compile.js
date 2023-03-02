/*
grunt compile
   Compiles a previously made pack into an installer(for windows) or tarball(for linux)
*/

'use strict';
const path = require('path');
module.exports = function (grunt) {
    grunt.config.merge({
        'create-windows-installer': {
            win64: {
                appDirectory: path.join(__dirname, '../dist/pack/Firebot-win32-x64/'),
                outputDirectory: path.join(__dirname, '../dist/install/Windows/'),
                loadingGif: path.join(__dirname, '../build/gui/images/animated.gif'),
                iconUrl: path.join(__dirname, '../build/gui/images/icon_transparent.ico'),
                setupIcon: path.join(__dirname, '../build/gui/images/icon_transparent.ico'),
                exe: "Firebot v5.exe",
                title: "Firebot v5",
                setupExe: "FirebotV5Setup.exe",
                noMsi: true
            }
        },
        compress: {
            linux: {
                options: {
                    archive: path.join(__dirname, '../dist/install/Linux/Firebot-linux-x64.tar.gz'),
                    mode: 'tgz'
                },
                files: [{
                    expand: true,
                    cwd: 'dist/pack/Firebot-linux-x64/',
                    src: ['**'],
                    dest: '/'
                }]
            }
        },
        shell: {
            compiledmg: {
                command: `npx --no-install --ignore-existing electron-installer-dmg ../dist/pack/Firebot-darwin-x64/ --out=../dist/install/macos`
            }
        }
    });

    grunt.loadNpmTasks('grunt-electron-installer');
    grunt.loadNpmTasks('grunt-contrib-compress');
    let compileCommand;
    switch (grunt.config.get('platform')) {
    case 'win64':
        compileCommand = 'create-windows-installer:win64';
        break;

    case 'linux':
        compileCommand = 'compress:linux';
        break;

    case 'darwin':
        compileCommand = 'shell:compile-dmg';
        break;

    default:
        throw new Error('unknonw platform');
    }
    grunt.registerTask('compile', ['cleanup:install', compileCommand]);
};