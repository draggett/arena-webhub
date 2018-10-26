// simple HTTP server - put resources in ./www/
// only supports a limited set of file extensions
// could be easily extended to handle request body

var port = 8282;
var base = 'http://localhost:' + port + '/'; // base URI for models on this server

var http = require("http");
var url = require('url');
var path = require('path');
var fs = require('fs');

var mime_types = {
    "html": "text/html",
    "txt": "text/plain",
    "js": "text/javascript",
    "json": "application/json",
    "css": "text/css",
    "jpeg": "image/jpeg",
    "jpg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "ico": "image/x-icon",
	"pdf": "application/pdf",
    "ttl": "text/turtle",
    "rdf": "text/turtle",
    "crl": "text/crl",
	"csv": "text/plain"
};

http.createServer(function(request, response) {
    //console.log('http request');
    var uri = url.parse(url.resolve(base, request.url));

    //console.log('HTTP request: ' + request.method + ' ' + uri.path);

	if (request.method === "GET" || request.method === 'HEAD') {

        var prefix = __dirname + '/www';

        //console.log('request for "' + uri.path + '"');

        // assume it is a request for a file

        if (uri.path[uri.path.length-1] === '/')
            uri.path += 'index.html';

        var filename = decodeURI(prefix + uri.path);
		var gzipped = false;

		//console.log('filename: ' + filename);

        fs.stat(filename, function(error, stat) {
            var ext = path.extname(filename);
            var mime = null;

			if (ext === ".gz") {
				gzipped = true;
				ext = path.extname(filename.substr(0, filename.length-3));
			}

            if (ext.length > 1)
                mime = mime_types[ext.split(".")[1]];

            if (error || !mime) {
				console.log("unable to serve " + filename);
				console.log("current path is: " + __dirname)
                var body = "404 not found: " + request.url;
                response.writeHead(404, {
                    'Content-Type': 'text/plain',
                    'Content-Length': body.length
                });

                if (request.method === "GET")
                    response.write(body);

                response.end();
            } else {
				if (gzipped) {
					console.log("filename has mime type " + mime);
					response.writeHead(200, {
						'Content-Type': mime,
						'Content-Encoding': 'gzip',
						'Pragma': 'no-cache',
						'Cache-Control': 'no-cache',
						'Access-Control-Allow-Origin': '*',
						'Content-Length': stat.size
					});
				} else {
					response.writeHead(200, {
						'Content-Type': mime,
						'Pragma': 'no-cache',
						'Cache-Control': 'no-cache',
						'Access-Control-Allow-Origin': '*',
						'Content-Length': stat.size
					});
				}

                if (request.method === "GET") {
                    var stream = fs.createReadStream(filename);
                    stream.pipe(response);
                } else
                    response.end();
            }
        });
    } else { // unimplemented HTTP Method
        var body = "501: not implemented " + request.method + " " + request.url;
        response.writeHead(501, {
            'Content-Type': 'text/plain',
            'Content-Length': body.length
        });
        response.write(body);
        response.end();
    }
}).listen(port);

console.log('started http server on port ' + port + ' at path ' + __dirname);
