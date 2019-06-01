var httpd = require('../../httpd.js'); // launch the http server
var wot = require('../../framework.js');
var coap = require('coap');

// logic for the thing for the tank

wot.produce({
    "name": "water1",
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
}).then(thing => {
    // some defaults until the real state is available
	thing.old_level = 0.5;
	thing.upper = 0.8;
    thing.lower = 0.1;
    thing.inlet = false;
    thing.outlet = false;
    thing.level = 0.5;

    // register handler for property update notifications
    thing["@observe"]("@properties", function (name, property, device) {
        if (thing.level > thing.upper) {
            if (thing.old_level <= thing.upper) {
				console.log("high water event");
				thing["@raise_event"]("high");
			}
		} else if (thing.level < thing.lower) {
			if (thing.old_level > thing.lower) {
				console.log("low water event");
				thing["@raise_event"]("low");
			}
		}

        thing.old_level = thing.level;

        // if app changed thing's state, need to update device
		if (!device)
			put_state(thing);
	});

	start_stream(thing);
	console.log("started thing for water tank on uri: " + thing["@path"]);
}).catch(err => console.log("failed to produce thing: " + err));

function put_state(thing) {
    var req = coap.request({
    	method: 'PUT',
    	pathname: '/tank',
    	options: {
        	Accept: 'application/json'
        }
    });

    req.on('response', function(res) {
        //console.log('response code', res.code)
        if (res.code !== '2.05')
        	return process.exit(1);
    });

    var state = {
        upper: thing.upper,
        lower: thing.lower,
        inlet: thing.inlet,
        outlet: thing.outlet
    };

    req.write(JSON.stringify(state));
    req.end(); // send request
}

function start_stream (thing) {
	coap.request({
    	observe: true,
      	pathname: '/tank',
      	options: {
        	Accept: 'application/json'
      	}
    }).on('response', function(res) {
      	//console.log('response code', res.code)
      	if (res.code !== '2.05')  // 205 Reset Content
        	return process.exit(1);

        res.on('data', function (chunk) {
        	//try {
      			var state = JSON.parse(chunk);
      			thing['@events'] = false; // disable events
      			thing.upper = state.upper;
      			thing.lower = state.lower;
      			thing.inlet = state.inlet;
      			thing.outlet = state.outlet;
      			thing.level = state.level;
      			thing['@events'] = true; // re-enable events
      			thing['@raise_event']('@properties', null, true);
      			//console.log("thing.level is " + thing.level);
      		/*} catch (e) {
      			console.log('bad message payload: ' + chunk);
      			return process.exit(1);
      		}*/
        });
    }).end(); // send request
}

console.log("starting water demo");

