let td = { 
	name: "test",
	types: {
		brightness: {
			type: "integer",
			value: 50,
			minimum: 0,
			maximum: 100,
			description: "brightness %",
			writable: true,
			observable: true
		}
	},
	properties: {
		on: {
			type: "boolean",
			value: false,
			description: "on/off switch",
			writable: true,
			observable: true
		},
		temperature: {
			type: "number",
			value: 20,
			units: "celsius",
			description: "room temperature",
			writable: false,
			observable: true
		},
		light1: {
			type: "brightness",
			description: "hall light",
			writable: true,
			observable: true
		},
		light2: {
			type: "brightness",
			description: "porch light",
			writable: true,
			observable: true
		},
		list: {
			type: "array",
			minItems: 2,
			maxItems: 3,
			items: {
				type: "number"
			},
			writable: true,
			observable: true
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
			required: ["name"],
			writable: true,
			observable: true
		},
		date: {
			type: "string",
			regex: "([12]\\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01]))",
			value: "2018-10-20",
			writable: true,
			observable: true
		},
		counter: {
			type: "integer",
			value: 0,
			writable: true,
			observable: true
		},
		any: {
			writable: true,
			observable: true
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
};

// try in case thingDescription or script is erroneous
try {
	let thing = WoT.produce(JSON.stringify(td));
  	// initialise property values from thing description
	for (var name in td.properties) {
		if (td.properties.hasOwnProperty(name)) {
  			let property = td.properties[name];
  		
  			if (property.hasOwnProperty('value'))
  				thing.properties[name].write(property['value']);
  		}
  	}
  	
	thing.setActionHandler('testAlarm', input => {
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
	
	thing.setActionHandler('testSync', input => {
		let act = (resolve, reject) => {
			let property = thing.properties[input.name];
			property.write(input.value);
			resolve(null);
		}
		return new Promise(function (resolve, reject) {
			act(resolve, reject);
		});
	});
	
	thing.setActionHandler('testAction', input => {
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
	
	thing.setActionHandler('testInput', input => {
		let act = (resolve, reject) => {
			resolve(null);
		}
		return new Promise(function (resolve, reject) {
			act(resolve, reject);
		});
	});

	thing.setActionHandler('testEmit', input => {
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
	
	thing.setActionHandler('testSpeed', input => {
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

  	thing.expose();
} catch(err) {
	console.log("Script error: " + err);
}
