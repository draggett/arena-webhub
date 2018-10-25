/* Web Hub login & create new account */

const webhub = "https://localhost:8888";

let login = {
	start: () => {
		let login_form = document.forms['login'];
		let register_form = document.forms['register'];
		let add_user = document.getElementById('add_user');
		let drop_user = document.getElementById('drop_user');
		let remove = document.getElementById('remove');
		
		show(register_form, false);
		
		let inputs = document.getElementsByTagName('input');
		
		for (let i = 0; i < inputs.length; ++i) {
			let input = inputs[i];
			input.guide = input.value;
			input.addEventListener('focus', got_focus);
			input.addEventListener('blur', lost_focus);
		}

		login_form.login.onclick = (e) => {
			console.log('login');
			e.preventDefault();
		};
		
		login_form.logout.onclick = (e) => {
			console.log('logout');
			e.preventDefault();
		};
		
		login_form.forgot.onclick = (e) => {
			console.log('forgot');
			e.preventDefault();
		};
		
		register_form.register.onclick = (e) => {
			console.log('register');
			e.preventDefault();
		};
		
		remove.onclick = (e) => {
			console.log('remove');
			e.preventDefault();
		};
		
		add_user.onclick = () => {
			show(register_form, true);
			show(login_form, false);
			show(add_user, false);
			show(drop_user, false);
		};
		
		register_form.cancel.onclick = (e) => {
			show(register_form, false);
			show(login_form, true);
			show(add_user, true);
			show(drop_user, true);
			e.preventDefault();
		};

	},
	
}; 

function show(element, visible) {
	if (visible) {
		console.log('hide ' + element.tagName);
		element.style.visibility = "visible";
		element.style.display = "";
	} else {
		console.log('show ' + element.tagName);
		element.style.visibility = "hidden";
		element.style.display = "none";
	}
}

function got_focus () {
	if (this.value === this.guide)
		this.value = "";
}

function lost_focus () {
	if (this.value === "")
		this.value = this.guide;
}

window.addEventListener("load", () => {
    login.start();
}, false);