// test for serving server sent events
// call stream.close() to close connection

var httpd = require('../../httpd.js'); // launch the http server
var fs = require('fs');

var path = "/stream/ecg";
var stream_count = 0;
var streams = {};
var interval;
var sample_rate = 100;		// sample rate in mS
var latency = 300;	// interval in mS between sending buffered data
var last;  // timestamp for when last buffer was sent
var index = 0;  // where to read data from in samples

var samples;  // array of records with [time, chan1, chan2, chan3, chan4]

function forall(obj, handler) {
	if (typeof obj === "object") {
		if (obj.length) {
			for (var i = 0; i < obj.length; ++i)
				handler(obj[i]);
		} else {
			for (var name in obj) {
				if (obj.hasOwnProperty(name))
					handler(name);
			}
		}
	}
}

fs.readFile("apps/ecg/ecg2.csv", "utf8", function (err, contents) {
	if (err) {
		console.log("couldn't open data file: " + err);
		return;
	}

	var records = contents.split("\n");
	samples = new Array(records.length);

	for (var i = 0; i < records.length; ++i) {
		var record = records[i];
		samples[i] = record.split(",");
	}
});

function get_buffer() {
	if (typeof last === "undefined") {
		last = (new Date()).getTime();
	}

	var now = (new Date()).getTime();

    // be reasonable
    if ((now < last) || (now - last > 2000))
	    last = now - 2000;

	var count = Math.floor((now - last)*sample_rate/1000);
	var buffer = new Array(count);

	for (var i = 0; i < count; ++i) {
		j = (i + index) % samples.length;
		buffer[i] = samples[j++];
	}

	index += count;
	last = now;

	//console.log("sending " + count + " samples");
	return buffer;
}


function new_ecg_stream(id, stream) {
	console.log("new ecg stream " + id);
	console.log("streams[id] = " + streams[id]);
	if (!streams[id]) {
		++stream_count;
		streams[id] = stream;

		if (!interval)
			start();
	}
}

function lost_ecg_stream(id) {
	console.log("lost stream " + id);
	if (streams[id]) {
		--stream_count;
		delete streams[id];

		if (stream_count < 1)
			stop();
	}
}

function start () {
	console.log("starting ecg simulation");
	interval =  setInterval(function () {
		var buffer = get_buffer();
		var message = JSON.stringify(buffer);
		forall(streams, function (id) {
			var stream = streams[id]
			stream(message);
		});
	}, latency);
}

function stop () {
	console.log("stopping ecg simulation");
	if (interval)
		clearInterval(interval);

	interval = null;
}

httpd.register_stream(path, new_ecg_stream, lost_ecg_stream);
