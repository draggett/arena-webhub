// application for cyber-physical control demo of a water tank

let webhub = require('arena-webhub')({
	port: 8888,
	accountPath: '/account',
	accountManager: accountManager,
	validateJWT: validateJWT
});

// thing with one property per channel and update rate of 100Hz

let td = {
	"name": "tank",
	"id": "tank123",
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
};

let inlet_rate = 0.05;
let outlet_rate = 0.008;
let time_interval = 100; // mS

//try {
	let thing = webhub.produce(td);
	//try {
		console.log("produced thing: " + thing.name);
		
		// initialise property values
		thing.properties.upper.value = 0.8;
		thing.properties.lower.value = 0.2;
		thing.properties.inlet.value = false;
		thing.properties.outlet.value = true;
		thing.properties.level.value = 0.5;
		
		// simulate cyber-physical system, in this case
		// a water tank that tries to keep the level
		// between the upper and lower levels by turning
		// the inlet valve on and off accordingly
		
		let delay = 100;  // milliseconds between updates
		
		setInterval(() => {
			let level = thing.properties.level.value;
			let prev_level = level;
			
			if (thing.properties.inlet.value)
				level += inlet_rate;
		
			if (thing.properties.outlet.value)
				level -= outlet_rate;

			if (level > 1.0)
				level = 1.0;
		
			if (level < 0.0)
				level = 0.0;
				
			if (level != prev_level)
				thing.properties.level.write(level);
		
			if (level >= thing.properties.upper.value)
				thing.properties.inlet.write(false);
		
			if (level <= thing.properties.lower.value)
				thing.properties.inlet.write(true);

			if (prev_level < thing.properties.upper.value &&
					level >= thing.properties.upper.value)
				thing.emitEvent("high");

			if (prev_level > thing.properties.lower.value &&
					level <= thing.properties.lower.value)
				thing.emitEvent("low");
		}, time_interval);

		// make thing available for clients
		
		thing.expose();
		
		console.log('ready and waiting ...');
/*	} catch (err) {
		console.log('failed to initialise thing');
	}
} catch (err) {
	console.log('failed to produce thing');
} */

// helper for http server
function fail(status, description, response) {
	let body = status + ' ' + description;
	console.log(body);
	response.writeHead(status, {
		'Content-Type': 'text/plain',
		'Access-Control-Allow-Origin': '*',
		'Content-Length': body.length
	});

	response.write(body);
	response.end();
}

// helper for http server
function succeed(status, description, response) {
	let body = status + ' ' + description;
	console.log(body);
	response.writeHead(status, {
		'Content-Type': 'text/plain',
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Credentials': 'true',
		'Content-Length': body.length
	});

	response.write(body);
	response.end();
}

// manager for user accounts and security tokens
function accountManager (request, response) {
	// handles all HTTPS requests to the accountPath:
	// responsible for adding/removing user accounts,
	// logging in and generation of JWT tokens, and
	// logging out and handling forgotten passwords
	return fail(500, "missing account manager", response);
}

function validateJWT (token, url) {
	// dummy function to be replaced by code that
	// tests the validity of the JWT token given
	// the HTTPS or WSS request's URL
	console.log('verifying JWT: "' + token + '" for ' + url);
	return true;
}
