/* interop tests for the web of things */

function log(message) {
	let log = document.getElementById('log');
	
	if (log.innerHTML)
		log.innerHTML += '\n' + message;
	else
		log.innerHTML = message;
}

function clear_log() {
	let log = document.getElementById('log');
	log.innerText = '';
}

function clear_model() {
	let log = document.getElementById('model');
	log.innerText = '';
}

function log_result(number, description, expected) {
	if (expected)
		log('  \u2714 ' + number + '. ' + description);
	else
		log('  <b>\u2718\u200A' + number + '. ' + description + '</b>');  // or \u274C
	
	// if we're embedded in an IFRAME post result to parent window
	// this is used by F-Interop for centralised data collection
	if (window.location !== window.parent.location) {
		let message = {
			expected: expected,
			number: number,
			description: description
		};
	
		window.parent.postMessage(message, "https://localhost:8888");
	}
}

function waitForEvent(thing, name, timeout) {
	let expect = function (resolve, reject) {
		let timer;
		let observer = data => {
			console.log('got event ' + name);
			thing.events[name].unsubscribe(observer);
			clearTimeout(timer);
			resolve(data);
		};
		
		timer = setTimeout(() => {
			//log('  timeout waiting for event' + name +);
			thing.events[name].unsubscribe(observer);
			reject("timeout on event " + name);
		}, timeout);
		
		thing.events[name].subscribe(observer);
	};
	
	return new Promise(function (resolve, reject) {
        expect(resolve, reject);
    });
}

function waitForUpdate(thing, name, value, timeout) {
	let expect = (resolve, reject) => {
		let timer;
		let observer = data => {
			thing.properties[name].unsubscribe(observer);
			clearTimeout(timer);
			resolve(true);
		};
		
		timer = setTimeout(() => {
			console.log('  timeout waiting for update for ' + name + ' to ' + value);
			thing.properties[name].unsubscribe(observer);
			resolve(false);
		}, timeout);
		
		thing.properties[name].subscribe(observer);
	};
	
	return new Promise(function (resolve, reject) {
        expect(resolve, reject);
    });
}

function test_write (number, thing, name, value, description, expected) {
	let test = (resolve, reject) => {
		let timeout = 2000; // 2 seconds
		let promises = [
			thing.properties[name].write(value),
			waitForUpdate(thing, name, value, timeout)
		];
		Promise.all(promises).then(results => {
			if (results[0] && results[1]) {
				//console.log('passed: ' + description);
				log_result(number, description, expected);
			} else {
				//console.log('failed: ' + description);
				log_result(number, description, expected);
			}
			
			resolve();
		}).catch(err => {
			console.log('rejected: ' + err);
			log_result(number, description, !expected);
			resolve();
		});
	};
	
	return new Promise(function (resolve, reject) {
        test(resolve, reject);
    });
}


function test_action(number, thing, name, input, output, description, expected) {
	let test = (resolve, reject) => {
		let timeout = 2000; // 2 seconds
		thing.actions[name].invoke(input, timeout)
			.then (result => {
				console.log(name + '(' + input + ') returned ' + result);
				if (result === output || (result === undefined && output === undefined))
					log_result(number, description, expected);
				else
					log_result(number, description, !expected);
					
				resolve();
			}).catch (err => {
				console.log(name + '(' + input + ') failed ');
				log_result(number, description, !expected);
				resolve();
			});
	};
	
	return new Promise(function (resolve, reject) {
        test(resolve, reject);
    });
}

function test_action_event(number, thing, name, input, event, description, expected) {
	let test = (resolve, reject) => {
		let timeout = 2000; // 2 seconds
		let promises = [
			thing.actions[name].invoke(input, timeout),
			waitForEvent(thing, event, timeout)
		];
		Promise.all(promises).then(results => {
			if (results[0] && results[1]) {
				//console.log('passed: ' + description);
				log_result(number, description, expected);
			} else {
				//console.log('failed: ' + description);
				log_result(number, description, expected);
			}
			
			resolve();
		}).catch(err => {
			console.log('rejected: ' + err);
			log_result(number, description, !expected)
			resolve();
		});
	};
	
	return new Promise(function (resolve, reject) {
        test(resolve, reject);
    });
}

function test_action_lp_event(number, thing, name, input, event, description, expected) {
	let test = (resolve, reject) => {
		let timeout = 2000; // 2 seconds
		thing.platform.waitForLongPolledEvent(thing, event, timeout)
			.then(res => {
				log_result(number, description, expected);
				resolve(res);
			})
			.catch(err => {
				console.log('waitForLongPolledEvent failed: ' + err);
				log_result(number, description, !expected);
				resolve(err);
			});
		
		// ensure long poll starts before the action to trigger the event
		setTimeout(() => {
			thing.actions[name].invoke(input, timeout)
				.catch(err => {
					console.log('action ' + name + ' failed: ' + err);
					log_result(number, description, !expected);
					resolve(err);
				});
		}, 1);
	};
	
	return new Promise(function (resolve, reject) {
        test(resolve, reject);
    });
}

function test_action_prop(number, thing, action, name, value, description, expected) {
	let test = (resolve, reject) => {
		let timeout = 2000; // 2 seconds
		let input = {
			name: name,
			value: value
		};
		let promises = [
			thing.actions[action].invoke(input, timeout),
			waitForUpdate(thing, name, value, timeout)
		];
		Promise.all(promises).then(results => {
			if (results[0] && results[1]) {
				//console.log('passed: ' + description);
				log_result(number, description, expected);
			} else {
				//console.log('failed: ' + description);
				log_result(number, description, expected);
			}
			
			resolve();
		}).catch(err => {
			console.log('rejected: ' + err);
			log_result(number, description, !expected)
			resolve();
		});
	};
	
	return new Promise(function (resolve, reject) {
        test(resolve, reject);
    });
}



function test_speed(number, thing, count, timeout, description, expected) {
	let action = "testSpeed";
	let counter = "counter";
	let started = Date.now();
	let expect = (resolve, reject) => {
		let timer;
		let observer = data => {
			if (data <= 0) {
				let time = Date.now() - started;
				log('  ' + number + ' speed test: ' + count + " property updates took " + time + " milliseconds");
				thing.properties[counter].unsubscribe(observer);
				clearTimeout(timer);
				resolve(true);
			}
		};
				
		timer = setTimeout(() => {
			log('  ' + number + " speed test, timeout at " + timeout + " milliseconds");
			thing.properties[counter].unsubscribe(observer);
			resolve(false);
		}, timeout);
		
		thing.properties[counter].subscribe(observer);
		thing.actions[action].invoke(count, timeout);
	};
	
	return new Promise(function (resolve, reject) {
        expect(resolve, reject);
    });
}

function run_tests (thing_uri) {
	wot.consume(thing_uri).then(thing => {
		let pre = document.getElementById("model");
		pre.innerText = JSON.stringify(thing.model, null, 2);

		// display the properties from the model
		let properties = thing.properties;
		let list = document.getElementById("plist");
		
		for (var name in properties) {
			if (properties.hasOwnProperty(name)) {
				let property = properties[name];
				let li = document.createElement("li");
				li.innerText = name + ': ' + property.value;
				list.appendChild(li);
			}
		}
		
		thing.properties.on.subscribe(data => {
			console.log('on = ' + data);
		});
		
		thing.properties.temperature.subscribe(data => {
			console.log('temperature = ' + data);
		});
		
		thing.events.alarm.subscribe(data => {
			console.log('alarm = ' + data);
		});
		
		// wait a bit to allow the event streams to be set up
		
		setTimeout(async () => {
			log("\nclient-side functional tests:\n");
			await test_write(1, thing, 'any', true, "should succeed on writing boolean to property without a type", true);
			await test_write(2, thing, 'any', "hello", "should succeed on writing string to property without a type", true);
			await test_write(3, thing, 'on', true, "should succeed on writing valid property value", true);
			await test_write(4, thing, 'on', "hello", "should fail on writing invalid property value", false);
			await test_write(5, thing, 'light1', 100, "should succeed on writing valid property value (app defined type)", true);
			await test_write(6, thing, 'light2', 45.8, "should fail on writing invalid property value (app defined type)", false);
			await test_write(7, thing, 'temperature', "15", "should fail on writing to read-only property", false);
			await test_write(8, thing, 'date', "2018-10-22", "should succeed on writing string matching regex", true);
			await test_write(9, thing, 'date', "2018-oct-22", "should fail on writing string not matching regex", false);
			await test_write(10, thing, 'list', [0, 1], "should succeed on writing an array", true);
			await test_write(11, thing, 'list', [0], "should fail on writing an array that is too short", false);
			await test_write(12, thing, 'list', [0, 1, 2, 3, 4], "should fail on writing an array that is too long", false);
			await test_write(13, thing, 'object', {'name':'button','quantity':3}, "should succeed on writing a valid object", true);
			await test_write(14, thing, 'object', {'colour':'red'}, "should fail on writing an object with wrong property", false);
			await test_write(15, thing, 'object', {'quantity':3}, "should fail on writing an object with missing required property", false);
			await test_action(16, thing, 'testInput', 42, undefined, "should succeed on action with valid input", true);
			await test_action(17, thing, 'testInput', false, null, "should fail on action with invalid input", false);
			log("\nserver-side functional tests:\n");
			await test_action_event(18, thing, 'testAlarm', 'hello', 'alarm', "should succeed to raise 'alarm' event with valid data", true);
			await test_action_event(19, thing, 'testAlarm', 42, 'alarm', "should fail to raise 'alarm' event with bad data", false);
			await test_action_prop(20, thing, 'testSync', "temperature", 25, "property update on server should sync client", true);
			await test_action_prop(21, thing, 'testSync', "temperature", "warm", "should fail on invalid property update on server", false);
			await test_action(22, thing, 'testAction', 42, undefined, "should succeed on server invoked action with valid input", true);
			await test_action(23, thing, 'testAction', '42', undefined, "should fail on server invoked action with invalid input", false);
			await test_action(24, thing, 'testEmit', 'hello', true, "should succeed on server invoked event with valid input", true);
			await test_action(25, thing, 'testEmit', 3.1419, true, "should fail on server invoked event with invalid input", false);
			await test_action_lp_event(26, thing, 'testAlarm', undefined, 'alarm', "should get 'alarm' event via long polling", true);
			log("\nnon functional tests:\n");
			await test_speed(27, thing, 10000, 60000);
			thing.unsubscribe(); // prevent duplicate events from zombie event sources
		}, 500);
	}).catch (err => console.log(err));
}

function test_arena_webhub(platform) {
	wot.platform = platform;
	run_tests("/things/test");
	//run_tests("https://localhost:8888/things/test");
}

function test_siemens_thingweb(platform) {
	wot.platform = platform;
	run_tests("http://localhost:8080/test");
}

function test_mozilla_thingsgateway(platform) {
	wot.platform = platform;
	log("\n *** sorry, not yet implemented ***");
}

function start () {
	let form = document.forms.platform;
	form.onsubmit = () => { return false; };
	let start_button = form.elements.start;
	start_button.onclick = () => {
		clear_log();
		clear_model();
		
		if (form.hub.value === "ArenaWebHub-SSE") {
			log("starting tests for Arena Web Hub using server-sent events");
			test_arena_webhub(new ArenaWebHubSSE());
		} else if (form.hub.value === "ArenaWebHub-WSS") {
			log("starting tests for Arena Web Hub using web sockets");
			test_arena_webhub(new ArenaWebHubWS());
		} else if (form.hub.value === "ThingWeb-WS") {
			log("starting tests for Siemens ThingWeb with WebSockets for events");
			test_siemens_thingweb(new ThingWeb());
		} else if (form.hub.value === "ThingWeb-LP") {
			log("starting tests for Siemens ThingWeb with long polling for events");
			test_siemens_thingweb(new ThingWeb());
		} else if (form.hub.value === "ThingsGateway") {
			log("starting tests for Mozilla Things Gateway using web sockets");
			test_mozilla_thingsgateway(wot.thingsgateway)
		} 
	}
}

window.addEventListener("load", () => {
	console.log('parent type is: ' + typeof(window.parent));
    start();
}, false);