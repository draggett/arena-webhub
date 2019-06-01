// test for serving server sent events
// call stream.close() to close connection

var httpd = require('../../httpd.js'); // launch the http server
var wot= require('../../framework.js');

console.log("");
console.log("starting water tank simulation");
console.log("==============================");
// stream state

var path = "/stream/tank";
var event = "hello";
var stream_count = 0;
var streams = {};
var interval;
var msg_count = 0;

// simulation state

var state = {
	inlet_valve: false,
	outlet_valve: true,
	upper_limit: 0.8,
	lower_limit: 0.2,
	level: 0.5
};

var inlet_rate = 0.05;
var outlet_rate = 0.008;
var time_interval = 100; // mS
var dependent_thing;

function update_state () {
	if (state.inlet_valve)
		state.level += inlet_rate;
		
	if (state.outlet_valve)
		state.level -= outlet_rate;

	if (state.level > 1.0)
		state.level = 1.0;
		
	if (state.level < 0.0)
		state.level = 0.0;
		
	if (state.level >= state.upper_limit)
		state.inlet_valve = false;
		
	if (state.level <= state.lower_limit)
		state.inlet_valve = true;

	tank2thing(dependent_thing);
}

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

// logic for the thing for the tank

wot.thing("tank", {
    "events": {
        "high": null,
        "low": null
    },
    "properties": {
		"upper": "number",
		"lower": "number",
		"inlet": "boolean",
		"outlet": "boolean",
        "level": "number"
    }
}, {
    start: function(thing) {
		thing.inlet = false;
        tank2thing(thing);
		thing.old_level = thing.level;
		dependent_thing = thing;
		thing["@observe"]("@properties", function (name, data) {
			if (thing.level > thing.upper) {
				if (thing.old_level <= thing.upper)
					thing["@raise_event"]("high");
			} else if (thing.level < thing.lower) {
				if (thing.old_level > thing.lower)
					thing["@raise_event"]("low");
			}
			
			thing2tank(thing);
			thing.old_level = thing.level;
		});
		console.log("started thing for water tank on uri: " + thing["@uri"]);
    },
    stop: function(thing) {}
});

function tank2thing(thing) {
	if (thing && thing["@running"]) {
		thing.upper = state.upper_limit;
		thing.lower = state.lower_limit;
		thing.inlet = state.inlet_valve;
		thing.outlet = state.outlet_valve;
		thing.level = state.level;
	}
}

function thing2tank(thing) {
	if (thing) {
		state.upper_limit = thing.upper;
		state.lower_limit = thing.lower;
		state.inlet_valve = thing.inlet;
		state.outlet_valve = thing.outlet;
		//state.level = thing.level;
	}
}

function new_stream(id, stream) {
	console.log("new stream " + id);
	if (!streams[id]) {
		++stream_count;
		streams[id] = stream;
		
		if (!interval)
			start();
	}
}

function lost_stream(id) {
	console.log("lost stream " + id);
	if (streams[id]) {
		--stream_count;
		delete streams[id];
		
		if (stream_count < 1)
			stop();
	}
}

function start () {
	console.log("starting simulation");
	interval =  setInterval(function () {
		update_state();
		var message = JSON.stringify(state);
		forall(streams, function (id) {
			var stream = streams[id]
			stream(message); 
		});
	}, time_interval);
}

function stop () {
	console.log("stopping simulation");
	if (interval)
		clearInterval(interval);
		
	interval = null;
}

httpd.register_stream(path, new_stream, lost_stream);