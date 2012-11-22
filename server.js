"use strict";

var url = require('url'),
    path = require('path'),
    fs = require('fs'),
    formidable = require('formidable'),
    layout = require('./layout'),
    port = 'undefined' !== typeof process.argv[2] ? parseInt(process.argv[2]) : 8888,
    st = require('./models/status');

function callbackRoute(content, request, response) {
    var isAjax = 'XMLHttpRequest' === request.headers['x-requested-with'];

    console.log('callback');
    console.log(content);
    response.writeHead(200, {"Content-Type": 'text/html'});
    response.write(isAjax ? content : layout.getFullPage(content));
    response.end();
}

function route(request, response, pathname) {
    var get = url.parse(request.url, true).query,
        post = [],
        files = [],
        form = new formidable.IncomingForm(),
        controller,
        ret;
    console.log("About to route a request for " + pathname);

    if ('post' === request.method.toLowerCase()) {
        form.uploadDir = __dirname + '/uploads';
        console.log('Upload dir: ' + form.uploadDir);


        form.on('file', function (field, file) {
            console.log('Receving file - ' + field + ': ' + file);
            files.push([field, file]);
        }).on('field', function (field, value) {
            console.log(field, value);
            post.push([field, value]);
        }).on('error', function (err) {
            console.log('error: ');
            console.log(err);
        }).on('progress', function (recv, total) {
            console.log('progress: ' + recv + '/' + total);
        }).on('end', function () {
            try {
                console.log('upload completed');
                controller = require('./controllers/' + pathname);
                controller.getResponse(get, post, files, request, response, callbackRoute);
                ret = true;
            } catch (err) {
                ret = false;
            }

        });

        form.parse(request);
        request.resume();
    } else {
        console.log('handling ' + pathname);
        try {
            controller = require('./controllers/' + pathname);
            console.log('handling 2 ' + pathname);
            controller.getResponse(get, post, files, request, response, callbackRoute, st);
            ret = true;
        } catch (err) {
            ret = false;
        }
    }

    return ret;
}

function bootstrap(request, resposne) {
    request.pause();
    var pathname = url.parse(request.url).pathname,
        filePath;

    if ('/' === pathname || '' === pathname) {
        pathname = '/index';
    }

    console.log("request for " + pathname + " received.");
    filePath = "public/" + pathname;

    fs.exists(filePath, function (exists) {
        if (exists) {
            fs.readFile(filePath, function (error, content) {
                var contentType = "text/html",
                    extname = path.extname(filePath);

                if (error) {
                    response.writeHead(500);
                } else {
                    switch (extname) {
                    case '.css':
                        contentType = 'text/css';
                        break;
                    case '.js':
                        contentType = 'text/javascript';
                        break;
                    case '.png':
                        contentType = 'image/png';
                        break;
                    case '.gif':
                        contentType = 'image/gif';
                        break;
                    case '.log':
                        contentType = 'text/plain';
                        break;
                    }
                    response.writeHead(200, {"Content-Type": contentType});
                    console.log("content-type:" + contentType);
                    response.write(content);
                    response.end();
                }
            });
        } else if (false === route(request, response, pathname)) {
            response.writeHead(500);
            response.end();
        }
    });
};
