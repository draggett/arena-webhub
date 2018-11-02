/* Web Hub login & create new account */

const webhub = "https://localhost:8888";

let light = {
	start: () => {
		wot.platform = new ArenaWebHubSSE();
		wot.consume("/things/light")
			.then(thing => {
				console.log("got thing");
				let brightness = thing.properties.brightness.value;
				console.log("brightness is " + brightness);
				
				let transition = document.getElementById('transition')
				let slider = document.getElementById('range');
				slider.value = "" + brightness;
				light.setBrightness(brightness);
				
				// listen for updates for brightness from exposed thing
				thing.properties.brightness.subscribe(brightness => {
					console.log('brightness is ' + brightness);
					light.setBrightness(brightness);
				})
				
				// change of slide should update brightness
				slider.onchange = e => {
					let value = slider.valueAsNumber;
					
					if (transition.checked) {
						// initiate transition to target brightness
						// transition should take 1000 milliseconds
						thing.actions.transition.invoke({
							target: value,
							duration: 1000
						});
					} else {
						// set brightness immediately
						thing.properties.brightness.write(value);
					}
				};
				
			}).catch (err => {
				console.log("couldn't get thing: " + err);
			});
	},
	setBrightness: (brightness) => {
		let bulb_on = document.getElementById('on');
		let bulb_off = document.getElementById('off');
		let opacity = brightness / 100.0;
		bulb_on.style.opacity = "" + opacity;
		bulb_off.style.opacity = "" + (1.0 -  opacity);
	}
}; 

window.addEventListener("load", () => {
    light.start();
}, false);
