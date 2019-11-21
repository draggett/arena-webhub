// simple application for getting started with Arena Web Hub

let webhub = require('arena-webhub')({
	port: 8888,
	accountPath: '/account',
	accountManager: accountManager,
	validateJWT: validateJWT
});

// light with brightness control

let td = {
    "name": "light",
    "description": "a dimmable light with smooth transitions",
    "properties": {
        "brightness": {
            "type": "number",
            "minimum": 0,
            "maximum": 100,
            "value": 100,
            "description": "brightness in range 0 to 100"
        }
    },
    "actions": {
        "transition": {
            "input": {
                "target": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 100,
                    "description": "target brightness in range 0 to 100"
                },
                "duration": {
                    "type": "integer",
                    "minimum": 0,
                    "description": "transition time in milliseconds" 
                }
            },
            "description": "smooth transition from current brightness level to target brightness level"
        }
    }
};

try {
	console.log("calling produce");
	let thing = webhub.produce(td);
	console.log("returned from produce");
	try {
		console.log("produced thing: " + thing.name);

		// define action's behaviour
		
		thing.addActionHandler('transition', data => {
			let act = (resolve, reject) => {
				let delay = 100; // milliseconds between updates
				
				if (data.duration == 0) {
					thing.properties.brightness.write(data.target);
					resolve(null);
				} else {
					let delta = delay * (data.target - thing.properties.brightness.value) / data.duration;
					console.log('delta = ' + delta);
					
					let interval = setInterval(() =>{
						let brightness = thing.properties.brightness.value + delta;
						
						// clamp value to be in range 0 - 100
						
						if (brightness < 0) {
							brightness = 0;
							clearInterval(interval);
							resolve(null);
							return;
						} else if (brightness > 100) {
							brightness = 100;
							clearInterval(interval);
							resolve(null);
							return;
						}
							
						thing.properties.brightness.write(brightness);
					
						if (delta > 0) {
							if (thing.properties.brightness.value > data.target) {
								thing.properties.brightness.write(data.target);
								clearInterval(interval);
								resolve(null);
							}
						} else if (delta < 0) {
							if (thing.properties.brightness.value < data.target) {
								thing.properties.brightness.write(data.target);
								clearInterval(interval);
								resolve(null);
							}
						}
					}, delay);
				}		
			};
			
			return new Promise(function (resolve, reject) {
				act(resolve, reject);
			});
		});
		
		// make thing available for clients
		
		thing.expose();
		
		console.log('ready and waiting ...');
	} catch (err) {
		console.log('failed to initialise thing');
	}
} catch (err) {
	console.log('failed to produce test thing');
}

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


