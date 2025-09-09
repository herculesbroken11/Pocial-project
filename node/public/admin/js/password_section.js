togglePassword.addEventListener('click', function (e) {
	// toggle the type attribute
	const type = password.getAttribute('type') === 'password' ? 'text' : 'password';
	password.setAttribute('type', type);
	// toggle the eye slash icon
	this.classList.toggle('show_password');
});

toggleConfirmPassword.addEventListener('click', function (e) {
	// toggle the type attribute
	const type = confirm_password.getAttribute('type') === 'password' ? 'text' : 'password';
	confirm_password.setAttribute('type', type);
	// toggle the eye slash icon
	this.classList.toggle('show_password');
});