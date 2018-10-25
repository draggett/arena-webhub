// test application for Arena Web Hub


let webhub = require('arena-webhub')({
	port: 8888,
	accountPath: '/account',
	accountManager: accountManager,
	validateJWT: validateJWT
});

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

// helper for HTTP request authorisation
function authorised(request) {
    // ask app to validate JWT authorisation token
    let token = request.headers.authorization;
    
    return (!token || validateJWT(token, request.url));
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
// expose a test thing for debugging ...

webhub.produce({
	name: "test",
	types: {
		brightness: {
			type: "integer",
			value: 50,
			minimum: 0,
			maximum: 100,
			description: "brightness %"
		}
	},
	properties: {
		on: {
			type: "boolean",
			value: false,
			description: "on/off switch"
		},
		temperature: {
			type: "number",
			value: 20,
			units: "celsius",
			writeable: false,
			description: "room temperature"
		},
		light1: {
			type: "brightness",
			description: "hall light",
		},
		light2: {
			type: "brightness",
			description: "porch light",
		},
		list: {
			type: "array",
			minItems: 2,
			maxItems: 3,
			items: {
				type: "number"
			}
		},
		object: {
			type: "object",
			properties: {
				name: {
					type: "string"
				},
				quantity: {
					type: "integer"
				}
			},
			required: ["name"]
		},
		date: {
			type: "string",
			regex: "([12]\\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01]))",
			value: "2018-10-20"
		},
		counter: {
			type: "integer",
			value: 0
		},
		any: {
		}
	},
	actions: {
		testInput: {
			input: {
				type: "number"
			}
		},
		testAlarm: {
		},
		testSync: {
			input: {
				type: "object",
				properties: {
					name: {
						type: "string"
					},
					value: {
						type: "number"
					}
				}
			}
		},
		testAction: {
		},
		testEmit: {
			output: {
				type: "boolean"
			}
		},
		testSpeed: {
			input: {
				type: "integer"
			}
		}
	},
	events: {
		alarm: {
			type: "string"
		}
	}
}).then(thing => {
	console.log("produced thing: " + thing.name);
	
	// configure actions
	
	thing.addActionHandler('testAlarm', input => {
		let act = (resolve, reject) => {
			let data = 'whoop whoop!';
			
			if (input)
				data = input;
				
			thing.events.alarm.emit(data)
			resolve(null);
		}
		return new Promise(function (resolve, reject) {
			act(resolve, reject);
		});
	});
	
	thing.addActionHandler('testSync', input => {
		let act = (resolve, reject) => {
			let property = thing.properties[input.name];
			property.write(input.value);
			resolve(null);
		}
		return new Promise(function (resolve, reject) {
			act(resolve, reject);
		});
	});
	
	thing.addActionHandler('testAction', input => {
		let act = (resolve, reject) => {
			let action = thing.actions["testInput"];
			action.invoke(input)
				.then(output => {
					resolve(output)
				}).catch(err => {
					reject(err);
				});
		}
		return new Promise(function (resolve, reject) {
			act(resolve, reject);
		});
	});
	
	thing.addActionHandler('testEmit', input => {
		let act = (resolve, reject) => {
			let event = thing.events["alarm"];
			
			try {
				event.emit(input);
				console.log('emit succeeded');
				resolve(true);
			} catch (err) {
				console.log('emit failed');
				resolve(false);
			}
		}
		return new Promise(function (resolve, reject) {
			act(resolve, reject);
		});
	});
	
	thing.addActionHandler('testSpeed', input => {
		console.log('test speed with ' + input + ' events');
		let act = async (resolve, reject) => {
			try {
				let count = input;
				console.log('starting speed test');
				if (Number.isInteger(count) && count > 0) {
					while (count--) {
						await thing.properties['counter'].write(count);
					}
				}
				
				resolve(null);
			} catch(err) {
				reject('handler failed: ' + err);
			}
		}
		return new Promise(function (resolve, reject) {
			act(resolve, reject);
		});
	});
/*
	// send 3 events at four seconds apart
	let count = 1;
	let interval = setInterval(function() {
		thing.emitEvent('alarm', 'alarm ' + (count++));
		
		if (count > 3)
			clearInterval(interval);
	}, 4000);
	
*/
})
.catch(err => console.log("failed to produce thing: " + err));


