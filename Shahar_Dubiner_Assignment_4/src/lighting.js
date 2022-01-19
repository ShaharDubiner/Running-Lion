//**************************************************************************************************************************************************************//
// Javascript assignment to draw a textured 3D virtual world with a movable camera - now with a point-light serving as the sun.
// NOTE: Classes and global variables extracted to their own seperate files.
//**************************************************************************************************************************************************************//
function onLoad(){
	// Retrieve <canvas> element.
	canvas = document.getElementById('canvas');
	// Get the rendering context for WebGL with alpha enabled.
	gl = canvas.getContext("webgl", {premultipliedAlpha: false});
	if(!gl){ console.error('Failed to get the rendering context for WebGL!'); return; }
	gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
	// Horrible string replacement used to define array sizes in shaders using a variable.
	lightsTotal = 1;
	VSHADER_SOURCE = VSHADER_SOURCE.split('${lightsTotal}').join(''+lightsTotal);
	FSHADER_SOURCE = FSHADER_SOURCE.split('${lightsTotal}').join(''+lightsTotal);
	// Initialize shaders.
	if(!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)){ console.error('Failed to intialize shaders.'); return; }
	
	// Get the storage location of shader defined variables.
	a_Position = gl.getAttribLocation(gl.program, 'a_Position');
	if(a_Position < 0){ console.error('Failed to get the storage location of a_Position.'); return; }
	a_Normal = gl.getAttribLocation(gl.program, 'a_Normal');
	if(a_Normal < 0){ console.error('Failed to get the storage location of a_Normal.'); return; }
	a_Color = gl.getAttribLocation(gl.program, 'a_Color');
	if(a_Color < 0){ console.error('Failed to get the storage location of a_Color.'); return; }
	a_TexCoord = gl.getAttribLocation(gl.program, 'a_TexCoord');
	if(a_TexCoord < 0){ console.error('Failed to get the storage location of a_TexCoord.'); return; }
	
	u_MvpMatrix = gl.getUniformLocation(gl.program, 'u_MvpMatrix');
	if(!u_MvpMatrix){ console.error('Failed to get the storage location of u_MvpMatrix.'); return; }
	u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
	if(!u_ModelMatrix){ console.error('Failed to get the storage location of u_ModelMatrix.'); return; }
	u_NormalMatrix = gl.getUniformLocation(gl.program, 'u_NormalMatrix');
	if(!u_NormalMatrix){ console.error('Failed to get the storage location of u_NormalMatrix.'); return; }
	
	u_CameraPosition = gl.getUniformLocation(gl.program, 'u_CameraPosition');
	if(!u_CameraPosition){ console.error('Failed to get the storage location of u_CameraPosition.'); return; }
	u_Textured = gl.getUniformLocation(gl.program, 'u_Textured');
	if(!u_Textured){ console.error('Failed to get the storage location of u_Textured.'); return; }
	u_Sampler = gl.getUniformLocation(gl.program, 'u_Sampler');
	gl.uniform1i(u_Textured, false); // Ensure default.
	if(!u_Sampler){ console.error('Failed to get the storage location of u_Sampler.'); return; }
	
	u_AmbientLight = gl.getUniformLocation(gl.program, 'u_AmbientLight');
	if(!u_AmbientLight){ console.error('Failed to get the storage location of u_AmbientLight.'); return; }
	u_AntiShinyness = gl.getUniformLocation(gl.program, 'u_AntiShinyness');
	if(!u_AntiShinyness){ console.error('Failed to get the storage location of u_AntiShinyness.'); return; }
	
	// Create the view projection matrix.
	viewProjMatrix = new Matrix4();
	// Camera(ID, loc, vel, target, tVel, renderMin, renderMax)
	camera = new Camera("PlayerView", [20.0, 10.0, 30.0], [0.0, 0.0, 0.0], [0.0, 0.0, 0.0], [0.0, 0.0, 0.0],
			1.0, 1000.0);
	camera.update(0);
	
	loadTextures();
	defineCube();
	defineSphere(10, 10);
	initShapes();
	
	// Set lighting.
	changeAmbientLight(0.2, 0.2, 0.2);
	lights.push(new Light("sun", [1.0, 1.0, 1.0], false, sun.loc));
	
	// Register the function to be called while a key is pressed.
	document.onkeydown = function(e){ keyDown(e); };
	// Register function to be called on mouse press.
	canvas.onmousedown = function(e){ mousePress(e); };
	// Register function to be called on mouse release.
	document.onmouseup = function(e){ mouseRelease(e); };
	// If page focus is lost, release mouse press.
	document.onblur = function(e){ mouseRelease(e); };
	// Register function to be called on mouse move.
	document.onmousemove = function(e){ mouseMove(e); };
	
	// Specify the color for clearing the canvas.
	gl.clearColor(0.0, 0.0, 0.0, 1.0); clear();
	// Enable 3D.
	gl.enable(gl.DEPTH_TEST);
	
	// Prep UI interface and functionality.
	initUIComponents();
	defaultUIValues();
	
	requestAnimationFrame(update);
	draw();
}
//**************************************************************************************************************************************************************//
function initUIComponents(){
	// Retrieve defaults button.
	defaultsButton = document.getElementById('defaultsButton');
	if(defaultsButton < 0){ console.error('Failed to find defaults button.'); return; }
	defaultsButton.onclick = function(){ defaultUIValues(); }
	// Retrieve color mode selection buttons.
	colorModeButtons = document.getElementsByName('colorMode');
	if(colorModeButtons < 0){ console.error('Failed to find color mode selection buttons.'); return; }
	// Retrieve sun's diffuse lighting switch.
	diffuseSwitchSun = document.getElementById('diffuseSwitchInputSun');
	if(diffuseSwitchSun < 0){ console.error('Failed to find sun\'s diffuse lighting switch.'); return; }
	// Retrieve sun's specular lighting switch.
	specularSwitchSun = document.getElementById('specularSwitchInputSun');
	if(specularSwitchSun < 0){ console.error('Failed to find sun\'s specular lighting switch.'); return; }
	
	// Retrieve sun's red selection slider.
	redSliderSun = document.getElementById('redSliderSun');
	if(redSliderSun < 0){ console.error('Failed to find sun\'s red selection slider.'); return; }
	redSliderSun.oninput = function(){
		lights[0].color[0] = this.value/255.0;
		if(redNumSun != null){ redNumSun.value = this.value; }
		if(colorDisplaySun != null){
			colorDisplaySun.style.background = 'rgba('+redSliderSun.value+', '+greenSliderSun.value+', '+blueSliderSun.value+', 1.0)';
			if(colorPickerSun != null){ colorPickerSun.value = rgbToHex(redSliderSun.value, greenSliderSun.value, blueSliderSun.value); }
		}
	}
	// Retrieve sun's red selection numerical input box.
	redNumSun = document.getElementById('redNumSun');
	if(redNumSun < 0){ console.error('Failed to find sun\'s red selection numerical input box.'); return; }
	redNumSun.oninput = function(){
		if(this.validity.valid){ lights[0].color[0] = this.value/255.0; }
		else{ this.value = 255; lights[0].color[0] = 1.0; }
		if(redSliderSun != null){ redSliderSun.value = this.value; }
		if(colorDisplaySun != null){
			colorDisplaySun.style.background = 'rgba('+redSliderSun.value+', '+greenSliderSun.value+', '+blueSliderSun.value+', 1.0)';
			if(colorPickerSun != null){ colorPickerSun.value = rgbToHex(redSliderSun.value, greenSliderSun.value, blueSliderSun.value); }
		}
	}
	// Retrieve sun's green selection slider.
	greenSliderSun = document.getElementById('greenSliderSun');
	if(greenSliderSun < 0){ console.error('Failed to find sun\'s green selection slider.'); return; }
	greenSliderSun.oninput = function(){
		lights[0].color[1] = this.value/255.0;
		if(greenNumSun != null){ greenNumSun.value = this.value; }
		if(colorDisplaySun != null){
			colorDisplaySun.style.background = 'rgba('+redSliderSun.value+', '+greenSliderSun.value+', '+blueSliderSun.value+', 1.0)';
			if(colorPickerSun != null){ colorPickerSun.value = rgbToHex(redSliderSun.value, greenSliderSun.value, blueSliderSun.value); }
		}
	}
	// Retrieve sun's green selection numerical input box.
	greenNumSun = document.getElementById('greenNumSun');
	if(greenNumSun < 0){ console.error('Failed to find sun\'s green selection numerical input box.'); return; }
	greenNumSun.oninput = function(){
		if(this.validity.valid){ lights[0].color[1] = this.value/255.0; }
		else{ this.value = 255; lights[0].color[1] = 1.0; }
		if(greenSliderSun != null){ greenSliderSun.value = this.value; }
		if(colorDisplaySun != null){
			colorDisplaySun.style.background = 'rgba('+redSliderSun.value+', '+greenSliderSun.value+', '+blueSliderSun.value+', 1.0)';
			if(colorPickerSun != null){ colorPickerSun.value = rgbToHex(redSliderSun.value, greenSliderSun.value, blueSliderSun.value); }
		}
	}
	// Retrieve sun's blue selection slider.
	blueSliderSun = document.getElementById('blueSliderSun');
	if(blueSliderSun < 0){ console.error('Failed to find sun\'s blue selection slider.'); return; }
	blueSliderSun.oninput = function(){
		lights[0].color[2] = this.value/255.0;
		if(blueNumSun != null){ blueNumSun.value = this.value; }
		if(colorDisplaySun != null){
			colorDisplaySun.style.background = 'rgba('+redSliderSun.value+', '+greenSliderSun.value+', '+blueSliderSun.value+', 1.0)';
			if(colorPickerSun != null){ colorPickerSun.value = rgbToHex(redSliderSun.value, greenSliderSun.value, blueSliderSun.value); }
		}
	}
	// Retrieve sun's blue selection numerical input box.
	blueNumSun = document.getElementById('blueNumSun');
	if(blueNumSun < 0){ console.error('Failed to find sun\'s blue selection numerical input box.'); return; }
	blueNumSun.oninput = function(){
		if(this.validity.valid){ lights[0].color[2] = this.value/255.0; }
		else{ this.value = 255; lights[0].color[2] = 1.0; }
		if(blueSliderSun != null){ blueSliderSun.value = this.value; }
		if(colorDisplaySun != null){
			colorDisplaySun.style.background = 'rgba('+redSliderSun.value+', '+greenSliderSun.value+', '+blueSliderSun.value+', 1.0)';
			if(colorPickerSun != null){ colorPickerSun.value = rgbToHex(redSliderSun.value, greenSliderSun.value, blueSliderSun.value); }
		}
	}
	// Retrieve sun's color display div.
	colorDisplaySun = document.getElementById('colorDisplaySun');
	if(colorDisplaySun < 0){ console.error('Failed to find sun\'s color display div.'); return; }
	// Retrieve sun's color picker element.
	colorPickerSun = document.getElementById('colorPickerSun');
	if(colorPickerSun < 0){ console.error('Failed to find sun\'s color picker.'); return; }
	colorPickerSun.onchange = function(){
		if(this.validity.valid){
			var rgb = hexToRgb(this.value);
			lights[0].color[0] = rgb[0]/255.0;
			if(redSliderSun != null){ redSliderSun.value = rgb[0]; }
			if(redNumSun != null){ redNumSun.value = rgb[0]; }
			lights[0].color[1] = rgb[1]/255.0;
			if(greenSliderSun != null){ greenSliderSun.value = rgb[1]; }
			if(greenNumSun != null){ greenNumSun.value = rgb[1]; }
			lights[0].color[2] = rgb[2]/255.0;
			if(blueSliderSun != null){ blueSliderSun.value = rgb[2]; }
			if(blueNumSun != null){ blueNumSun.value = rgb[2]; }
			colorDisplaySun.style.background = 'rgba('+rgb[0]+', '+rgb[1]+', '+rgb[2]+', 1.0)';
		}
		else{ this.value = colorDisplaySun.style.background; }
	}
	
	// Retrieve ambient red selection slider.
	redSliderAmbient = document.getElementById('redSliderAmbient');
	if(redSliderAmbient < 0){ console.error('Failed to find ambient red selection slider.'); return; }
	redSliderAmbient.oninput = function(){
		changeAmbientLight(this.value/255.0, ambientLight[1], ambientLight[2]);
		if(redNumAmbient != null){ redNumAmbient.value = this.value; }
		if(colorDisplayAmbient != null){
			colorDisplayAmbient.style.background = 'rgba('+redSliderAmbient.value+', '+greenSliderAmbient.value+', '+blueSliderAmbient.value+', 1.0)';
			if(colorPickerAmbient != null){ colorPickerAmbient.value = rgbToHex(redSliderAmbient.value, greenSliderAmbient.value, blueSliderAmbient.value); }
		}
	}
	// Retrieve ambient red selection numerical input box.
	redNumAmbient = document.getElementById('redNumAmbient');
	if(redNumAmbient < 0){ console.error('Failed to find ambient red selection numerical input box.'); return; }
	redNumAmbient.oninput = function(){
		if(this.validity.valid){ changeAmbientLight(this.value/255.0, ambientLight[1], ambientLight[2]); }
		else{ this.value = 51; changeAmbientLight(0.2, ambientLight[1], ambientLight[2]); }
		if(redSliderAmbient != null){ redSliderAmbient.value = this.value; }
		if(colorDisplayAmbient != null){
			colorDisplayAmbient.style.background = 'rgba('+redSliderAmbient.value+', '+greenSliderAmbient.value+', '+blueSliderAmbient.value+', 1.0)';
			if(colorPickerAmbient != null){ colorPickerAmbient.value = rgbToHex(redSliderAmbient.value, greenSliderAmbient.value, blueSliderAmbient.value); }
		}
	}
	// Retrieve ambient green selection slider.
	greenSliderAmbient = document.getElementById('greenSliderAmbient');
	if(greenSliderAmbient < 0){ console.error('Failed to find ambient green selection slider.'); return; }
	greenSliderAmbient.oninput = function(){
		changeAmbientLight(ambientLight[0], this.value/255.0, ambientLight[2]);
		if(greenNumAmbient != null){ greenNumAmbient.value = this.value; }
		if(colorDisplayAmbient != null){
			colorDisplayAmbient.style.background = 'rgba('+redSliderAmbient.value+', '+greenSliderAmbient.value+', '+blueSliderAmbient.value+', 1.0)';
			if(colorPickerAmbient != null){ colorPickerAmbient.value = rgbToHex(redSliderAmbient.value, greenSliderAmbient.value, blueSliderAmbient.value); }
		}
	}
	// Retrieve ambient green selection numerical input box.
	greenNumAmbient = document.getElementById('greenNumAmbient');
	if(greenNumAmbient < 0){ console.error('Failed to find ambient green selection numerical input box.'); return; }
	greenNumAmbient.oninput = function(){
		if(this.validity.valid){ changeAmbientLight(ambientLight[0], this.value/255.0, ambientLight[2]); }
		else{ this.value = 51; changeAmbientLight(ambientLight[0], 0.2, ambientLight[2]); }
		if(greenSliderAmbient != null){ greenSliderAmbient.value = this.value; }
		if(colorDisplayAmbient != null){
			colorDisplayAmbient.style.background = 'rgba('+redSliderAmbient.value+', '+greenSliderAmbient.value+', '+blueSliderAmbient.value+', 1.0)';
			if(colorPickerAmbient != null){ colorPickerAmbient.value = rgbToHex(redSliderAmbient.value, greenSliderAmbient.value, blueSliderAmbient.value); }
		}
	}
	// Retrieve ambient blue selection slider.
	blueSliderAmbient = document.getElementById('blueSliderAmbient');
	if(blueSliderAmbient < 0){ console.error('Failed to find ambient blue selection slider.'); return; }
	blueSliderAmbient.oninput = function(){
		changeAmbientLight(ambientLight[0], ambientLight[1], this.value/255.0);
		if(blueNumAmbient != null){ blueNumAmbient.value = this.value; }
		if(colorDisplayAmbient != null){
			colorDisplayAmbient.style.background = 'rgba('+redSliderAmbient.value+', '+greenSliderAmbient.value+', '+blueSliderAmbient.value+', 1.0)';
			if(colorPickerAmbient != null){ colorPickerAmbient.value = rgbToHex(redSliderAmbient.value, greenSliderAmbient.value, blueSliderAmbient.value); }
		}
	}
	// Retrieve ambient blue selection numerical input box.
	blueNumAmbient = document.getElementById('blueNumAmbient');
	if(blueNumAmbient < 0){ console.error('Failed to find ambient blue selection numerical input box.'); return; }
	blueNumAmbient.oninput = function(){
		if(this.validity.valid){ changeAmbientLight(ambientLight[0], ambientLight[1], this.value/255.0); }
		else{ this.value = 51; changeAmbientLight(ambientLight[0], ambientLight[1], 0.2); }
		if(blueSliderAmbient != null){ blueSliderAmbient.value = this.value; }
		if(colorDisplayAmbient != null){
			colorDisplayAmbient.style.background = 'rgba('+redSliderAmbient.value+', '+greenSliderAmbient.value+', '+blueSliderAmbient.value+', 1.0)';
			if(colorPickerAmbient != null){ colorPickerAmbient.value = rgbToHex(redSliderAmbient.value, greenSliderAmbient.value, blueSliderAmbient.value); }
		}
	}
	// Retrieve ambient color display div.
	colorDisplayAmbient = document.getElementById('colorDisplayAmbient');
	if(colorDisplayAmbient < 0){ console.error('Failed to find ambient color display div.'); return; }
	// Retrieve ambient color picker element.
	colorPickerAmbient = document.getElementById('colorPickerAmbient');
	if(colorPickerAmbient < 0){ console.error('Failed to find ambient color picker.'); return; }
	colorPickerAmbient.onchange = function(){
		if(this.validity.valid){
			var rgb = hexToRgb(this.value);
			changeAmbientLight(rgb[0]/255.0, rgb[1]/255.0, rgb[2]/255.0);
			if(redSliderAmbient != null){ redSliderAmbient.value = rgb[0]; }
			if(redNumAmbient != null){ redNumAmbient.value = rgb[0]; }
			if(greenSliderAmbient != null){ greenSliderAmbient.value = rgb[1]; }
			if(greenNumAmbient != null){ greenNumAmbient.value = rgb[1]; }
			if(blueSliderAmbient != null){ blueSliderAmbient.value = rgb[2]; }
			if(blueNumAmbient != null){ blueNumAmbient.value = rgb[2]; }
			colorDisplayAmbient.style.background = 'rgba('+rgb[0]+', '+rgb[1]+', '+rgb[2]+', 1.0)';
		}
		else{ this.value = colorDisplayAmbient.style.background; }
	}
}
//**************************************************************************************************************************************************************//
// Load textures to be used.
function loadTextures(){
	textures.rock = loadTexture('data:image/png;base64,data:image/jpeg;base64,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AgADAAAAEABAAAAABAAABABABAAAAAAAAABABAAAAABAAAAABAAABABABAAAAAAAAABABAAAAABAAAAABAAABABABAAAAAAAAABABAAAAABAAJIABABABJJJIAAJIABABJJABJIJJABABABABAAAAABAAABABAAABAAAAAAAAABABABABAAAAABAAABABAAABAAAAAAAAABABABABAAAAABAAABABAAABAAAAAAAAJIABJIJJAAJIABAAJIAAJJABJJJJAAABAAAAABAAABABABABAAAAABAAAAABAAAAAAAAABAAABABABABAAAAABAAAAABAAAAAAAAABAAABABABABAAAAABAAAAABAAAAAAAAJIAAABAAAAJIAAAAJIAAJJAAJIAAAAABAAAAABABAAAAAAABAAABABAAABAAAAABAAAAABABAAAAAAABAAABABAAABAAAAABAAAAABABAAAAAAABAAABABAAABAAJJJIJJJJJJAAJIAAJJABJJAAABJJABABAAABAAAAAAAAABABABAAABABAAABABAAAAABAAAAAAAAABABABAAABABAAABABAAAAABAAAAAAAAABABABAAABABAAABABAAAAJJABAAABJJABJIABABJIJJAAABJIJJABAAAAAAABABAAAAABABABAAAAAAABAAABAAAAAAABABAAAAABABABAAAAAAABAAABAAAAAAABABAAAAABABABAAAAAAABAAABJIAAAAABJIAAAAABJIJIABJIABJJAAAAABAAAAAAAAAAAAAAABAAABABABAAAAAAABAAAAAAAAAAAAAAABAAABABABAAAAAAABAAAAAAAAAAAAAAABAAABABABAAAAAAAAABAAJIABAAJJJIJIABAAAAABJJJIAAABAAABABAAABAAAAAAAAABABAAAAAAAAABAAABABAAABAAAAAAAAABABAAAAAAAAABAAABABAAABAAAAAAAAABABAAAAAAJIABJJJIABJIAAJIABABJIJJJIJJABJIABAAAAAAAAABAAABAAABAAABABABABAAABAAAAAAAAABAAABAAABAAABABABABAAABAAAAAAAAABAAABAAABAAABABABABAAAAABABABABJJAAABAAAAABJJJIABABJJABAAAAAAABAAAAABAAABABABAAABAAAAABAAAAAAABAAAAABAAABABABAAABAAAAABAAAAAAABAAAAABAAABABABAAABAAAAABABAAAAJIABABJJJJABJIJIJJJJABJJABAAAAABAAAAABABABAAABABAAAAABAAABAAAAABAAAAABABABAAABABAAAAABAAABAAAAABAAAAABABABAAABABAAAAABAAABABJJJJABABABJIJJAAJIABAAAAAAJIABABAAAAAAAAAAABAAABAAABAAAAAAAAABABAAAAAAAAAAABAAABAAABAAAAAAAAABABAAAAAAAAAAABAAABAAABAAAAAAAAABJJJIJIJJJIJIJJAAAAAAAAABJJJIJIAAABAAAAAAAAAAAAAAABAAABABAAAAAAAAABAAAAAAAAAAAAAAABAAABABAAAAAAAAABAAAAAAAAAAAAAAABAAABABAAAAAAABABJIABJJABJIJJJJJIJIABJIABJJABAAAAABABABABAAAAAAABABAAAAABABAAAAAAABABABABAAAAAAABABAAAAABABAAAAAAABABABABAAAAAAABABAAAAABABAAAAAAAAAAABABABJJJJAAABAAABABJJJJAAAAABABABABABAAABABABAAAAAAABAAAAAAABABABABABAAABABABAAAAAAABAAAAAAABABABABABAAABABABAAAAAAABAAABAAJIABJJJIJIABABJIJJJJJJJIABABAAABAAAAABABAAAAAAABABAAAAABABAAAAABAAAAABABAAAAAAABABAAAAABABAAAAABAAAAABABAAAAAAABABAAAAABABAAJJJIAAABAAJIABABAAABJJABABAAJIABP/EABQRAQAAAAAAAAAAAAAAAAAAAMD/2gAIAQMBAT8QAAf/xAAUEQEAAAAAAAAAAAAAAAAAAADA/9oACAECAQE/EAAH/8QAKhABAAIABAQGAwEBAQAAAAAAAREgACFR8DHB0fEwQFBgcbFhcJFBoYH/2gAIAQEAAT8Qvp3jR9gBFCaR+UICtHAt/IatO8aPsAIoTSPyhAVo4Fv5DVp3jR9cCKE0j8oQFaOBb+Q1R48duz7IlAhCVeGO2OuO2OuO2OuEvxSEP0lJQArTRo0PDWlJ23yTlQMba5421zxtrng14wh3A7KqAEtIsWK1GIBAgGdaZ8+eNA8FuAbJOAVCn79+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');
	textures.sky = loadTexture('data:image/png;base64,data:image/jpeg;base64,data:image/jpeg;base64,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8vBY+Rs8CuVa7tOg1WlhZb8UBjfdu1InTtH9VCYsaIDvZtV1h2z7WkEkKxiUuqri0TMQ6AAfu+kqeLnttcN0ubxELeoGO5rZOg1A/goTY0SpnAFYho4CuUgxLtSq20NPtMhTZdtdBMHw8k1TLJxnO+jA7mdZWLk9MvybtjKxDQSbSfonttW+28F4a7SeEDKtFM2AS0cQkCQqnCyun3swn1Me615HtgHXxaudc70siT79sEiOfHn91dZ1DqNleOTVYK32NlpcY1+7yXINczIvc+9waw7joQNY/NH9ZTYyaNrZNu/qljms227gdHDwHgqWS8PsLg7dPJ80AuBIg8+PYpu+p45UgiBstJL/AP/Z/+0Y6FBob3Rvc2hvcCAzLjAAOEJJTQQEAAAAAAAUHAIAAAJgABwCeAAIQ0EzRzAzMDk4QklNBCUAAAAAABAIyLQQYqt1+bQp0EprAGdeOEJJTQPtAAAAAAAQAEgAAAABAAIASAAAAAEAAjhCSU0EJgAAAAAADgAAAAAAAAAAAAA/gAAAOEJJTQQNAAAAAAAEAAAAHjhCSU0EGQAAAAAABAAAAB44QklNA/MAAAAAAAkAAAAAAAAAAAEAOEJJTScQAAAAAAAKAAEAAAAAAAAAAjhCSU0D9QAAAAAASAAvZmYAAQBsZmYABgAAAAAAAQAvZmYAAQChmZoABgAAAAAAAQAyAAAAAQBaAAAABgAAAAAAAQA1AAAAAQAtAAAABgAAAAAAAThCSU0D+AAAAAAAcAAA/////////////////////////////wPoAAAAAP////////////////////////////8D6AAAAAD/////////////////////////////A+gAAAAA/////////////////////////////wPoAAA4QklNBAgAAAAAABAAAAABAAACQAAAAkAAAAAAOEJJTQQeAAAAAAAEAAAAADhCSU0EGgAAAAADTQAAAAYAAAAAAAAAAAAAAQAAAAEAAAAADABDAEEAMwBHADAAMwAwADkAMAAwADAAMQAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAABAAAAAQAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAQAAAAAAAG51bGwAAAACAAAABmJvdW5kc09iamMA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eGFwLzEuMC9tbS8iIHhtbG5zOnN0RXZ0PSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VFdmVudCMiIHRpZmY6T3JpZW50YXRpb249IjEiIHRpZmY6WUNiQ3JQb3NpdGlvbmluZz0iMSIgdGlmZjpYUmVzb2x1dGlvbj0iNzIwMDAwLzEwMDAwIiB0aWZmOllSZXNvbHV0aW9uPSI3MjAwMDAvMTAwMDAiIHRpZmY6UmVzb2x1dGlvblVuaXQ9IjIiIHRpZmY6TWFrZT0iS0RESS1DQSIgdGlmZjpNb2RlbD0iQ0EwMDQiIHRpZmY6TmF0aXZlRGlnZXN0PSIyNTYsMjU3LDI1OCwyNTksMjYyLDI3NCwyNzcsMjg0LDUzMCw1MzEsMjgyLDI4MywyOTYsMzAxLDMxOCwzMTksNTI5LDUzMiwzMDYsMjcwLDI3MSwyNzIsMzA1LDMxNSwzMzQzMjs3QTVEOTY2NjBGRjFEMUVCNThCMkQ0MEQ5MENFQ0MwMCIgZXhpZjpFeGlmVmVyc2lvbj0iMDIyMCIgZXhpZjpGbGFzaHBpeFZlcnNpb249IjAxMDAiIGV4aWY6Q29sb3JTcGFjZT0iMSIgZXhpZjpQaXhlbFhEaW1lbnNpb249IjI1NiIgZXhpZjpQaXhlbFlEaW1lbnNpb249IjI1NiIgZXhpZjpEYXRlVGltZU9yaWdpbmFsPSIyMDExLTA3LTE3VDE0OjI4OjMzKzA5OjAwIiBleGlmOkRhdGVUaW1lRGlnaXRpemVkPSIyMDExLTA3LTE3VDE0OjI4OjMzKzA5OjAwIiBleGlmOkV4cG9zdXJlVGltZT0iMTMvMjAwMDAiIGV4aWY6RXhwb3N1cmVCaWFzVmFsdWU9IjAvMTAiIGV4aWY6Q3VzdG9tUmVuZGVyZWQ9IjAiIGV4aWY6RXhwb3N1cmVNb2RlPSIwIiBleGlmOldoaXRlQmFsYW5jZT0iMCIgZXhpZjpEaWdpdGFsWm9vbVJhdGlvPSIzMjY0LzMyNjQiIGV4aWY6U2NlbmVDYXB0dXJlVHlwZT0iMCIgZXhpZjpHYWluQ29udHJvbD0iMCIgZXhpZjpTYXR1cmF0aW9uPSIwIiBleGlmOlN1YmplY3REaXN0YW5jZVJhbmdlPSIwIiBleGlmOk5hdGl2ZURpZ2VzdD0iMzY4NjQsNDA5NjAsNDA5NjEsMzcxMjEsMzcxMjIsNDA5NjIsNDA5NjMsMzc1MTAsNDA5NjQsMzY4NjcsMzY4NjgsMzM0MzQsMzM0MzcsMzQ4NTAsMzQ4NTIsMzQ4NTUsMzQ4NTYsMzczNzcsMzczNzgsMzczNzksMzczODAsMzczODEsMzczODIsMzczODMsMzczODQsMzczODUsMzczODYsMzczOTYsNDE0ODMsNDE0ODQsNDE0ODYsNDE0ODcsNDE0ODgsNDE0OTIsNDE0OTMsNDE0OTUsNDE3MjgsNDE3MjksNDE3MzAsNDE5ODUsNDE5ODYsNDE5ODcsNDE5ODgsNDE5ODksNDE5OTAsNDE5OTEsNDE5OTIsNDE5OTMsNDE5OTQsNDE5OTUsNDE5OTYsNDIwMTYsMCwyLDQsNSw2LDcsOCw5LDEwLDExLDEyLDEzLDE0LDE1LDE2LDE3LDE4LDIwLDIyLDIzLDI0LDI1LDI2LDI3LDI4LDMwOzc0RjlCNjJGMDYzQjEzODA4NURGODMwNjQ3QUYyRjMxIiB4bXA6Q3JlYXRlRGF0ZT0iMjAxMS0wNy0xN1QxNDoyODozMyswOTowMCIgeG1wOk1vZGlmeURhdGU9IjIwMTItMDItMTNUMTQ6NTk6NDIrMDk6MDAiIHhtcDpNZXRhZGF0YURhdGU9IjIwMTItMDItMTNUMTQ6NTk6NDIrMDk6MDAiIGRjOmZvcm1hdD0iaW1hZ2UvanBlZyIgcGhvdG9zaG9wOkNvbG9yTW9kZT0iMyIgcGhvdG9zaG9wOklDQ1Byb2ZpbGU9InNSR0IgSUVDNjE5NjYtMi4xIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOkFGNzRDNjVFRDc1M0UxMTFBMjFEOThBOEEyODJFNUZCIiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOkFFNzRDNjVFRDc1M0UxMTFBMjFEOThBOEEyODJFNUZCIiB4bXBNTTpPcmlnaW5hbERvY3VtZW50SUQ9InhtcC5kaWQ6QUU3NEM2NUVENzUzRTExMUEyMUQ5OEE4QTI4MkU1RkIiPiA8ZXhpZjpDb21wb25lbnRzQ29uZmlndXJhdGlvbj4gPHJkZjpTZXE+IDxyZGY6bGk+MTwvcmRmOmxpPiA8cmRmOmxpPjI8L3JkZjpsaT4gPHJkZjpsaT4zPC9yZGY6bGk+IDxyZGY6bGk+MDwvcmRmOmxpPiA8L3JkZjpTZXE+IDwvZXhpZjpDb21wb25lbnRzQ29uZmlndXJhdGlvbj4gPGV4aWY6Rmxhc2ggZXhpZjpGaXJlZD0iRmFsc2UiIGV4aWY6UmV0dXJuPSIwIiBleGlmOk1vZGU9IjAiIGV4aWY6RnVuY3Rpb249IlRydWUiIGV4aWY6UmVkRXllTW9kZT0iRmFsc2UiLz4gPGRjOmRlc2NyaXB0aW9uPiA8cmRmOkFsdD4gPHJkZjpsaSB4bWw6bGFuZz0ieC1kZWZhdWx0Ij5DQTNHMDMwOTwvcmRmOmxpPiA8L3JkZjpBbHQ+IDwvZGM6ZGVzY3JpcHRpb24+IDx4bXBNTTpIaXN0b3J5PiA8cmRmOlNlcT4gPHJkZjpsaSBzdEV2dDphY3Rpb249ImNyZWF0ZWQiIHN0RXZ0Omluc3RhbmNlSUQ9InhtcC5paWQ6QUU3NEM2NUVENzUzRTExMUEyMUQ5OEE4QTI4MkU1RkIiIHN0RXZ0OndoZW49IjIwMTItMDItMTNUMTQ6NTk6NDIrMDk6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCBDUzQgV2luZG93cyIvPiA8cmRmOmxpIHN0RXZ0OmFjdGlvbj0ic2F2ZWQiIHN0RXZ0Omluc3RhbmNlSUQ9InhtcC5paWQ6QUY3NEM2NUVENzUzRTExMUEyMUQ5OEE4QTI4MkU1RkIiIHN0RXZ0OndoZW49IjIwMTItMDItMTNUMTQ6NTk6NDIrMDk6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCBDUzQgV2luZG93cyIgc3RFdnQ6Y2hhbmdlZD0iLyIvPiA8L3JkZjpTZXE+IDwveG1wTU06SGlzdG9yeT4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg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');
}
// Create cube archtype to be used.
function defineCube(){
	cube = new ShapeType("cube");
	// Cube vertices.
	var vertices = new Float32Array([
		 0.5, 0.5, 0.5, -0.5, 0.5, 0.5, -0.5,-0.5, 0.5,  0.5,-0.5, 0.5, // v0-v1-v2-v3 front
		 0.5, 0.5, 0.5,  0.5,-0.5, 0.5,  0.5,-0.5,-0.5,  0.5, 0.5,-0.5, // v0-v3-v4-v5 right
		 0.5, 0.5, 0.5,  0.5, 0.5,-0.5, -0.5, 0.5,-0.5, -0.5, 0.5, 0.5, // v0-v5-v6-v1 up
		-0.5, 0.5, 0.5, -0.5, 0.5,-0.5, -0.5,-0.5,-0.5, -0.5,-0.5, 0.5, // v1-v6-v7-v2 left
		-0.5,-0.5,-0.5,  0.5,-0.5,-0.5,  0.5,-0.5, 0.5, -0.5,-0.5, 0.5, // v7-v4-v3-v2 down
		 0.5,-0.5,-0.5, -0.5,-0.5,-0.5, -0.5, 0.5,-0.5,  0.5, 0.5,-0.5  // v4-v7-v6-v5 back
	]);
	cube.vertexBuffer = getArrayBuffer(vertices, 3, gl.FLOAT);
	// Cuboid normals.
	var normals = new Float32Array([
		 0.0, 0.0, 1.0,  0.0, 0.0, 1.0,  0.0, 0.0, 1.0,  0.0, 0.0, 1.0, // v0-v1-v2-v3 front
		 1.0, 0.0, 0.0,  1.0, 0.0, 0.0,  1.0, 0.0, 0.0,  1.0, 0.0, 0.0, // v0-v3-v4-v5 right
		 0.0, 1.0, 0.0,  0.0, 1.0, 0.0,  0.0, 1.0, 0.0,  0.0, 1.0, 0.0, // v0-v5-v6-v1 up
		-1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, // v1-v6-v7-v2 left
		 0.0,-1.0, 0.0,  0.0,-1.0, 0.0,  0.0,-1.0, 0.0,  0.0,-1.0, 0.0, // v7-v4-v3-v2 down
		 0.0, 0.0,-1.0,  0.0, 0.0,-1.0,  0.0, 0.0,-1.0,  0.0, 0.0,-1.0  // v4-v7-v6-v5 back
	]);
	cube.normalsBuffer = getArrayBuffer(normals, 3, gl.FLOAT);
	// Special case for cuboids meant to be lit from the inside.
    for(var i = 0; i < normals.length; ++i){ normals[i] *= -1; }
	cube.normalsBufferInvert = getArrayBuffer(normals, 3, gl.FLOAT);
	// Cuboid vertex indices.
	var indices = new Uint8Array([
		 0, 1, 2,   0, 2, 3, // front
		 4, 5, 6,   4, 6, 7, // right
		 8, 9,10,   8,10,11, // up
		12,13,14,  12,14,15, // left
		16,17,18,  16,18,19, // down
		20,21,22,  20,22,23  // back
	]);
	cube.indicesBuffer = gl.createBuffer();
	if(!cube.indicesBuffer){ console.error('Failed to create buffer object.'); return null; }
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cube.indicesBuffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
	cube.indicesBuffer.len = indices.length;
	cube.indicesBuffer.type = gl.UNSIGNED_BYTE;
	// Cube texture mapping. Texture dimensions are normalized when used by WebGL.
	var textureMap = new Float32Array([
		 0.0, 0.0,  0.0, 1.0,  1.0, 1.0,  1.0, 0.0, // front
		 0.0, 0.0,  0.0, 1.0,  1.0, 1.0,  1.0, 0.0, // right
		 0.0, 0.0,  0.0, 1.0,  1.0, 1.0,  1.0, 0.0, // up
		 0.0, 0.0,  0.0, 1.0,  1.0, 1.0,  1.0, 0.0, // left
		 0.0, 0.0,  0.0, 1.0,  1.0, 1.0,  1.0, 0.0, // down
		 0.0, 0.0,  0.0, 1.0,  1.0, 1.0,  1.0, 0.0  // back
	]);
	cube.textureMap = getArrayBuffer(textureMap, 2, gl.FLOAT);
	// Cuboid color pallete.
	cube.colorBuffer = getArrayBuffer(vertexColors(cube.vertexBuffer.len, 1.0, 1.0, 1.0, 1.0), 4, gl.FLOAT);
	cubeColors.ground = getArrayBuffer(vertexColors(cube.vertexBuffer.len, 0.4, 0.6, 0.2, 1.0), 4, gl.FLOAT);
	cubeColors.lionFur = getArrayBuffer(vertexColors(cube.vertexBuffer.len, 0.75, 0.55, 0.0, 1.0), 4, gl.FLOAT);
	cubeColors.lionFuzz = getArrayBuffer(vertexColors(cube.vertexBuffer.len, 0.65, 0.45, 0.0, 1.0), 4, gl.FLOAT);
	cubeColors.lionMane = getArrayBuffer(vertexColors(cube.vertexBuffer.len, 0.55, 0.35, 0.0, 1.0), 4, gl.FLOAT);
	cubeColors.lionTailTip = getArrayBuffer(vertexColors(cube.vertexBuffer.len, 0.35, 0.2, 0.0, 1.0), 4, gl.FLOAT);
	cubeColors.lionSnoutTop = getArrayBuffer(vertexColors(cube.vertexBuffer.len, 0.8, 0.6, 0.4, 1.0), 4, gl.FLOAT);
	cubeColors.lionSnoutBottom = getArrayBuffer(vertexColors(cube.vertexBuffer.len, 0.95, 0.8, 0.7, 1.0), 4, gl.FLOAT);
	cubeColors.lionTongue = getArrayBuffer(vertexColors(cube.vertexBuffer.len, 1.0, 0.1, 0.1, 1.0), 4, gl.FLOAT);
	cubeColors.lionNose = getArrayBuffer(vertexColors(cube.vertexBuffer.len, 0.1, 0.1, 0.1, 1.0), 4, gl.FLOAT);
	cubeColors.lionEyes = getArrayBuffer(vertexColors(cube.vertexBuffer.len, 0.1, 0.1, 0.1, 1.0), 4, gl.FLOAT);
}
// Create a sphere by iterating through its spherical coordinates and generating 2 triangles for each quad on one of its rings.
function defineSphere(hSteps, vSteps){
	sphere = new ShapeType("sphere");
	// Sphere vertices, normals, and texture mapping.
	var numVertices = (hSteps + 1)*(vSteps + 1);
	var vertices = [], normals = [], textureMap = [];
	for(var j = 0; j <= vSteps; ++j){
		var v = j/vSteps;
		var phi = Math.PI*v;
		var sinPhi = Math.sin(phi);
		var uy = Math.cos(phi);
		for(var i = 0; i <= hSteps; ++i){
			var u = i/hSteps;
			var theta = TWO_PI*u;
			var ux = Math.cos(theta)*sinPhi;
			var uz = Math.sin(theta)*sinPhi;
			// Generate data based on spherical coordinates. Radius is 0.5 to make a default size of 1.
			vertices.push(0.5*ux, 0.5*uy, 0.5*uz);
			normals.push(ux, uy, uz);
			textureMap.push(1.0 - u, v);
		}
	}
	sphere.vertexBuffer = getArrayBuffer(new Float32Array(vertices), 3, gl.FLOAT);
	sphere.normalsBuffer = getArrayBuffer(new Float32Array(normals), 3, gl.FLOAT);
	// Special case for spheres meant to be lit from the inside.
    for(var i = 0; i < normals.length; ++i){ normals[i] *= -1; }
	sphere.normalsBufferInvert = getArrayBuffer(new Float32Array(normals), 3, gl.FLOAT);
	sphere.textureMap = getArrayBuffer(new Float32Array(textureMap), 2, gl.FLOAT);
	
	// Sphere vertex indices.
	var numVertsAround = hSteps + 1;
    var indices = [];
    for(var i = 0; i < hSteps; ++i){
		for(var j = 0; j < vSteps; ++j){
			// Make triangle 1 of quad.
			indices.push(j*numVertsAround + i, j*numVertsAround + i+1, (j+1)*numVertsAround + i);
			// Make triangle 2 of quad.
			indices.push((j+1)*numVertsAround + i, j*numVertsAround + i+1, (j+1)*numVertsAround + i+1);
		}
	}
	sphere.indicesBuffer = gl.createBuffer();
	if(!sphere.indicesBuffer){ console.error('Failed to create buffer object.'); return null; }
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphere.indicesBuffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
	sphere.indicesBuffer.len = indices.length;
	sphere.indicesBuffer.type = gl.UNSIGNED_SHORT;
	// Sphere color pallete.
	sphere.colorBuffer = getArrayBuffer(vertexColors(sphere.vertexBuffer.len, 1.0, 1.0, 1.0, 1.0), 4, gl.FLOAT);
	sphereColors.orange = getArrayBuffer(vertexColors(sphere.vertexBuffer.len, 1.0, 0.5, 0.0, 1.0), 4, gl.FLOAT);
}
//**************************************************************************************************************************************************************//
// Create starting shapes and set up vertex buffering and normals.
function initShapes(){
	// Shape(ID, shapeType, size, loc, [rotations])
	/*var newShape = new Shape("core", cube, [10.0, 10.0, 2.0], [0.0, 0.0, 0.0], [[0.0, 1.0, 0.0, 0.0, 0.0, [0.0, 0.0, 0.0]]]);
	shapes.push(newShape);*/
	initShapesWorld();
	initShapesLion();
}
function initShapesWorld(){
	var sky = new Shape("skybox", sphere, [666.0, 666.0, 666.0], [0.0, 0.0, 0.0], []);
	sky.texture = textures.sky;
	sky.normalsBuffer = sphere.normalsBufferInvert;
	shapes.push(sky);
	sun = new Shape("sun", sphere, [30.0, 30.0, 30.0], [0.0, 10.0, -250], [[0.0, 1.0, 0.0, 0.0, 0.0, [0.0, 0.0, 0.0]]]);
	sun.colorBuffer = sphereColors.orange;
	sun.normalsBuffer = sphere.normalsBufferInvert;
	sun.vel = [0.0, 0.0, 0.0];
	shapes.push(sun);
	var ground = new Shape("ground", cube, [320.0, 2.0, 320.0], [0.0, -10.0, 0.0], [[35.0, 0.0, 1.0, 0.0, 0.0, [0.0, 0.0, 0.0]]]);
	ground.colorBuffer = cubeColors.ground;
	shapes.push(ground);
	var textureBall = new Shape("textureBall", sphere, [15.0, 15.0, 15.0], [-100.0, 30.0, 50.0], []);
	textureBall.texture = textures.sky;
	shapes.push(textureBall);
	var plainBall = new Shape("plainBall", sphere, [25.0, 25.0, 25.0], [-90.0, 10.0, 70.0], []);
	plainBall.colorBuffer = sphereColors.orange;
	shapes.push(plainBall);
	var normalBall = new Shape("normalBall", sphere, [20.0, 20.0, 20.0], [-120.0, 20.0, 60.0], []);
	normalBall.colorBuffer = sphere.normalsBuffer;
	shapes.push(normalBall);
	var wallMap = [[4, 4, 4, 4, 4,  4, 4, 4, 4, 4,  4, 4, 4, 4, 4,  4, 4, 4, 4, 4,  4, 4, 4, 4, 4,  4, 4, 4, 4, 4,  4, 4],
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 3,  2, 3, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 2, 0, 1,  0, 2, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 4, 0, 1,  0, 3, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 2, 0, 0,  0, 3, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  2, 3, 3, 3, 3,  0, 3, 4, 4, 4,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   
				   [4, 0, 0, 0, 0,  3, 0, 0, 0, 0,  0, 3, 4, 4, 4,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 1, 2, 3, 2,  2, 0, 1, 3, 2,  2, 3, 4, 4, 4,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 2,  1, 4, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 3,  0, 3, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 4,  1, 2, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   
				   [4, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 0, 0, 0, 0,  0, 4],
				   [4, 4, 4, 4, 4,  4, 4, 4, 4, 4,  4, 4, 4, 4, 4,  4, 4, 4, 4, 4,  4, 4, 4, 4, 4,  4, 4, 4, 4, 4,  4, 4]];
	var halfX = wallMap.length/2, halfY = wallMap[0].length/2;
	for(var i = 0; i < wallMap.length; ++i){
		for(var j = 0; j < wallMap[i].length; ++j){
			var prevBlock = ground;
			for(var n = 0; n < wallMap[i][j]; ++n){
				var block = new Shape("block", cube, [10.0, 10.0, 10.0],
						(prevBlock == ground) ? [10.0*(i-halfX), 5.0, 10.0*(j-halfY)]:[0.0, 10.0, 0.0], []);
				block.texture = textures.rock;
				prevBlock.branches.push(block);
				prevBlock = block;
			}
		}
	}
}
function initShapesLion(){
	body1 = new Shape("body1", cube, [8.0, 8.0, 10.0], [35.0, 5.0, 0.0],
			[[0.0, 0.0, 1.0, 0.0, 0.0, [0.0, 0.0, 0.0]], [0.0, 1.0, 0.0, 0.0, 0.45, [0.0, 0.0, 0.0]]]);
	body1.colorBuffer = cubeColors.lionFur;
	body1.vel = [0.0, 0.0, 0.0];
	shapes.push(body1);
	body2 = new Shape("body2", cube, [6.0, 6.0, 10.0], [0.0, -0.3, -8.0], [[0.0, -1.0, 0.0, 0.0, 0.45, [0.0, 0.3, 0.0]]]);
	body2.colorBuffer = cubeColors.lionFur;
	body1.branches.push(body2);

	neck = new Shape("neck", cube, [3.5, 3.5, 5.0], [0.0, 2.0, 5.0], [[0.0, -1.0, 0.0, 0.0, 0.3, [0.0, 0.0, 0.0]]]);
	neck.colorBuffer = cubeColors.lionFur;
	body1.branches.push(neck);
	head = new Shape("head", cube, [5.0, 5.0, 4.0], [0.0, 0.25, 3.0], [[0.0, -1.0, 0.0, 0.0, 0.3, [0.0, 0.0, 0.0]]]);
	head.colorBuffer = cubeColors.lionFur;
	neck.branches.push(head);
	var snoutTop = new Shape("snoutTop", cube, [2.5, 1.0, 2.5], [0.0, -1.1, 3.0], []);
	snoutTop.colorBuffer = cubeColors.lionSnoutTop;
	head.branches.push(snoutTop);
	snoutBottom = new Shape("snoutBottom", cube, [2.5, 0.75, 2.5], [0.0, -2.0, 3.0], [[20.0, 1.0, 0.0, 0.0, 0.5, [0.0, 0.0, -0.5]]]);
	snoutBottom.colorBuffer = cubeColors.lionSnoutBottom;
	head.branches.push(snoutBottom);
	
	var tongue = new Shape("tongue", cube, [1.5, 0.5, 1.5], [0.0, 0.3, 0.0], []);
	tongue.colorBuffer = cubeColors.lionTongue;
	snoutBottom.branches.push(tongue);
	var nose = new Shape("nose", cube, [1.25, 0.5, 0.75], [0.0, 0.45, 1.0], []);
	nose.colorBuffer = cubeColors.lionNose;
	snoutTop.branches.push(nose);
	var leftEye = new Shape("leftEye", cube, [0.5, 0.5, 0.5], [1.1, 0.75, 2.0], []);
	leftEye.colorBuffer = cubeColors.lionEyes;
	head.branches.push(leftEye);
	var rightEye = new Shape("rightEye", cube, [0.5, 0.5, 0.5], [-1.1, 0.75, 2.0], []);
	rightEye.colorBuffer = cubeColors.lionEyes;
	head.branches.push(rightEye);
	var leftEar1 = new Shape("leftEar1", cube, [0.9, 1.0, 0.5], [1.75, 2.5, 1.3], []);
	leftEar1.colorBuffer = cubeColors.lionFur;
	head.branches.push(leftEar1);
	var leftEar2 = new Shape("leftEar2", cube, [0.6, 0.5, 0.4], [0.0, 0.75, 0.0], []);
	leftEar2.colorBuffer = cubeColors.lionFur;
	leftEar1.branches.push(leftEar2);
	var rightEar1 = new Shape("rightEar1", cube, [0.9, 1.0, 0.5], [-1.75, 2.5, 1.3], []);
	rightEar1.colorBuffer = cubeColors.lionFur;
	head.branches.push(rightEar1);
	var rightEar2 = new Shape("rightEar2", cube, [0.6, 0.5, 0.4], [0.0, 0.75, 0.0], []);
	rightEar2.colorBuffer = cubeColors.lionFur;
	rightEar1.branches.push(rightEar2);
	var mane = new Shape("mane", cube, [8.0, 8.0, 3.0], [0.0, -0.25, -0.5], []);
	mane.colorBuffer = cubeColors.lionMane;
	head.branches.push(mane);
	
	frontLegL1 = new Shape("frontLegL1", cube, [2.0, 5.0, 2.0], [3.5, -5.0, 3.5], [[0.0, 1.0, 0.0, 0.0, 2.5, [0.0, 1.0, 0.0]]]);
	frontLegL1.colorBuffer = cubeColors.lionFur;
	body1.branches.push(frontLegL1);
	frontLegL2 = new Shape("frontLegL2", cube, [1.75, 5.0, 1.75], [0.0, -4.0, 0.2], [[0.0, 1.0, 0.0, 0.0, 1.25, [0.0, 1.0, -0.2]]]);
	frontLegL2.colorBuffer = cubeColors.lionFur;
	frontLegL1.branches.push(frontLegL2);
	frontLegL3 = new Shape("frontLegL3", cube, [1.75, 2.0, 1.75], [0.0, -3.0, 0.1], [[0.0, 1.0, 0.0, 0.0, 1.25, [0.0, 0.0, 0.0]]]);
	frontLegL3.colorBuffer = cubeColors.lionFuzz;
	frontLegL2.branches.push(frontLegL3);

	frontLegR1 = new Shape("frontLegR1", cube, [2.0, 5.0, 2.0], [-3.5, -5.0, 3.5], [[0.0, 1.0, 0.0, 0.0, 2.5, [0.0, 1.0, 0.0]]]);
	frontLegR1.colorBuffer = cubeColors.lionFur;
	body1.branches.push(frontLegR1);
	frontLegR2 = new Shape("frontLegR2", cube, [1.75, 5.0, 1.75], [0.0, -4.0, 0.2], [[0.0, 1.0, 0.0, 0.0, 1.25, [0.0, 1.0, -0.2]]]);
	frontLegR2.colorBuffer = cubeColors.lionFur;
	frontLegR1.branches.push(frontLegR2);
	frontLegR3 = new Shape("frontLegR3", cube, [1.75, 2.0, 1.75], [0.0, -3.0, 0.1], [[0.0, 1.0, 0.0, 0.0, 1.25, [0.0, 0.0, 0.0]]]);
	frontLegR3.colorBuffer = cubeColors.lionFuzz;
	frontLegR2.branches.push(frontLegR3);
	
	backLegL1 = new Shape("backLegL1", cube, [1.75, 5.0, 3.0], [3.5, -2.0, -4.0], [[0.0, -1.0, 0.0, 0.0, 3.0, [0.0, 0.0, 0.0]]]);
	backLegL1.colorBuffer = cubeColors.lionFur;
	body2.branches.push(backLegL1);
	backLegL2 = new Shape("backLegL2", cube, [1.75, 4.0, 1.75], [0.0, -3.8, 0.5], [[0.0, -1.0, 0.0, 0.0, 0.5, [0.0, 3.8, -0.5]]]);
	backLegL2.colorBuffer = cubeColors.lionFur;
	backLegL1.branches.push(backLegL2);
	backLegL3 = new Shape("backLegL3", cube, [1.75, 4.0, 1.75], [0.0, -4.0, -0.1], [[0.0, -1.0, 0.0, 0.0, 0.5, [0.0, 4.0, 0.1]]]);
	backLegL3.colorBuffer = cubeColors.lionFur;
	backLegL2.branches.push(backLegL3);
	backLegL4 = new Shape("backLegL4", cube, [1.75, 2.0, 2.0], [0.0, -3.0, 0.1], [[0.0, -1.0, 0.0, 0.0, 1.0, [0.0, 3.0, -0.1]]]);
	backLegL4.colorBuffer = cubeColors.lionFuzz;
	backLegL3.branches.push(backLegL4);
	
	backLegR1 = new Shape("backLegR1", cube, [1.75, 5.0, 3.0], [-3.5, -2.0, -4.0], [[0.0, -1.0, 0.0, 0.0, 3.0, [0.0, 0.0, 0.0]]]);
	backLegR1.colorBuffer = cubeColors.lionFur;
	body2.branches.push(backLegR1);
	backLegR2 = new Shape("backLegR2", cube, [1.75, 4.0, 1.75], [0.0, -3.8, 0.5], [[0.0, -1.0, 0.0, 0.0, 0.5, [0.0, 3.8, -0.5]]]);
	backLegR2.colorBuffer = cubeColors.lionFur;
	backLegR1.branches.push(backLegR2);
	backLegR3 = new Shape("backLegR3", cube, [1.75, 4.0, 1.75], [0.0, -4.0, -0.1], [[0.0, -1.0, 0.0, 0.0, 0.5, [0.0, 4.0, 0.1]]]);
	backLegR3.colorBuffer = cubeColors.lionFur;
	backLegR2.branches.push(backLegR3);
	backLegR4 = new Shape("backLegR4", cube, [1.75, 2.0, 2.0], [0.0, -3.0, 0.1], [[0.0, -1.0, 0.0, 0.0, 1, [0.0, 3.0, -0.1]]]);
	backLegR4.colorBuffer = cubeColors.lionFuzz;
	backLegR3.branches.push(backLegR4);

	tail1 = new Shape("tail1", cube, [1.0, 1.0, 2.0], [0.0, 2.5, -5.0], [[0.0, 1.0, 0.0, 0.0, 1.0, [0.0, 0.0, 0.0]]]);
	tail1.colorBuffer = cubeColors.lionFur;
	body2.branches.push(tail1);
	tail2 = new Shape("tail2", cube, [1.0, 1.0, 2.0], [0.0, 0.0, -2.0], [[0.0, 1.0, 0.0, 0.0, 0.3, [0.0, 0.0, 0.0]]]);
	tail2.colorBuffer = cubeColors.lionFur;
	tail1.branches.push(tail2);
	tail3 = new Shape("tail3", cube, [1.0, 1.0, 2.0], [0.0, 0.0, -2.0], [[0.0, 1.0, 0.0, 0.0, 0.3, [0.0, 0.0, 0.0]]]);
	tail3.colorBuffer = cubeColors.lionFur;
	tail2.branches.push(tail3);
	tail4 = new Shape("tail4", cube, [1.0, 1.0, 2.0], [0.0, 0.0, -2.0], [[0.0, 1.0, 0.0, 0.0, 0.3, [0.0, 0.0, 0.0]]]);
	tail4.colorBuffer = cubeColors.lionFur;
	tail3.branches.push(tail4);
	tail5 = new Shape("tail5", cube, [1.0, 1.0, 2.0], [0.0, 0.0, -2.0], [[0.0, 1.0, 0.0, 0.0, 0.3, [0.0, 0.0, 0.0]]]);
	tail5.colorBuffer = cubeColors.lionFur;
	tail4.branches.push(tail5);
	tail6 = new Shape("tail6", cube, [1.0, 1.0, 2.0], [0.0, 0.0, -2.0], [[0.0, 1.0, 0.0, 0.0, 0.3, [0.0, 0.0, 0.0]]]);
	tail6.colorBuffer = cubeColors.lionFur;
	tail5.branches.push(tail6);
	tail7 = new Shape("tail7", cube, [1.0, 1.0, 2.0], [0.0, 0.0, -2.0], [[0.0, 1.0, 0.0, 0.0, 0.3, [0.0, 0.0, 0.0]]]);
	tail7.colorBuffer = cubeColors.lionFur;
	tail6.branches.push(tail7);
	tailTip = new Shape("tailTip", cube, [1.75, 1.75, 2.0], [0.0, 0.0, -1.0], [[0.0, 1.0, 0.0, 0.0, 0.0, [0.0, 0.0, -1.0]]]);
	tailTip.colorBuffer = cubeColors.lionTailTip;
	tail7.branches.push(tailTip);
}
//**************************************************************************************************************************************************************//
// Handle keyboard input.
function keyDown(e){
	switch(e.keyCode){
		// 'W', 'w' key. Move camera forward.
		case 87: case 119:
			camera.move(0.0, 0.0, MOVE_SPEED);
			break;
		// 'A', 'a' key. Move camera left.
		case 65: case 97:
			camera.move(-0.5*MOVE_SPEED, 0.0, 0.0);
			break;
		// 'S', 's' key. Move camera backward.
		case 83: case 115:
			camera.move(0.0, 0.0, -MOVE_SPEED);
			break;
		// 'D', 'd' key. Move camera right.
		case 68: case 100:
			camera.move(0.5*MOVE_SPEED, 0.0, 0.0);
			break;
		// 'E', 'e' key. Turn camera right.
		case 69: case 101:
			camera.turn(TURN_SPEED, 0);
			break;
		// 'Q', 'q' key. Turn camera left.
		case 81: case 113:
			camera.turn(-TURN_SPEED, 0);
			break;
		// 'X', 'x' key. Move camera up.
		case 88: case 120:
			camera.move(0.0, 0.5*MOVE_SPEED, 0.0);
			break;
		// 'Z', 'z' key. Move camera down.
		case 90: case 122:
			camera.move(0.0, -0.5*MOVE_SPEED, 0.0);
			break;
		// Skip redraw if nothing changed.
		default: return;
	}
	draw();
}
// Handle mouse input.
function mousePress(e){
	// Only left mouse button counts.
	if(e.buttons == 1){
		mouseLocPress[0] = e.pageX; mouseDisplace[0] = 0;
		mouseLocPress[1] = e.pageY; mouseDisplace[1] = 0;
		mouseDown = true;
	}
}
function mouseRelease(e){
	// Only left mouse button counts.
	if(e.buttons%2 != 1){
		mouseDown = false;
	}
}
function mouseMove(e){
	// Only left mouse button counts.
	if(e.buttons == 1){
		mouseDisplace[0] = e.pageX - mouseLocPress[0];
		mouseDisplace[1] = e.pageY - mouseLocPress[1];
		if(Math.abs(mouseDisplace[0]) < TURN_BUFFER){ mouseDisplace[0] = 0; }
		if(Math.abs(mouseDisplace[1]) < TURN_BUFFER){ mouseDisplace[1] = 0; }
	}
	else{
		mouseDown = false;
	}
}
//**************************************************************************************************************************************************************//
// Reset values controlled by the UI to their default values.
function defaultUIValues(){
	colorMode = "standard";
	if(colorModeButtons != null){
		for(var i = 0; i < colorModeButtons.length; ++i){
			if(colorModeButtons[i].value == colorMode){ colorModeButtons[i].checked = true; }
			else{ colorModeButtons[i].checked = false; }
		}
	}
	
	lights[0].diffuse = diffuseSwitchSun.checked = true;
	lights[0].specular = specularSwitchSun.checked = true;
	lights[0].color[0] = lights[0].color[1] = lights[0].color[2] = 1.0;
	if(redSliderSun != null){ redSliderSun.value = 255; }
	if(redNumSun != null){ redNumSun.value = 255; }
	if(greenSliderSun != null){ greenSliderSun.value = 255; }
	if(greenNumSun != null){ greenNumSun.value = 255; }
	if(blueSliderSun != null){ blueSliderSun.value = 255; }
	if(blueNumSun != null){ blueNumSun.value = 255; }
	if(colorDisplaySun != null){
		colorDisplaySun.style.background = 'rgba('+redSliderSun.value+', '+greenSliderSun.value+', '+blueSliderSun.value+', 1.0)';
		if(colorPickerSun != null){ colorPickerSun.value = rgbToHex(redSliderSun.value, greenSliderSun.value, blueSliderSun.value); }
	}
	
	changeAmbientLight(0.2, 0.2, 0.2);
	if(redSliderAmbient != null){ redSliderAmbient.value = 51; }
	if(redNumAmbient != null){ redNumAmbient.value = 51; }
	if(greenSliderAmbient != null){ greenSliderAmbient.value = 51; }
	if(greenNumAmbient != null){ greenNumAmbient.value = 51; }
	if(blueSliderAmbient != null){ blueSliderAmbient.value = 51; }
	if(blueNumAmbient != null){ blueNumAmbient.value = 51; }
	if(colorDisplayAmbient != null){
		colorDisplayAmbient.style.background = 'rgba('+redSliderAmbient.value+', '+greenSliderAmbient.value+', '+blueSliderAmbient.value+', 1.0)';
		if(colorPickerAmbient != null){ colorPickerAmbient.value = rgbToHex(redSliderAmbient.value, greenSliderAmbient.value, blueSliderAmbient.value); }
	}
}
// Change between color display modes.
function modeSelect(){
	if(colorModeButtons == null){ return; }
	// Find and set currently selected color mode.
	for(var i = 0; i < colorModeButtons.length; ++i){
		if(colorModeButtons[i].checked){
			colorMode = colorModeButtons[i].value;
			break;
		}
	}
}
function toggleDiffuse(){ if(diffuseSwitchSun == null){ return; } lights[0].diffuse = diffuseSwitchSun.checked; }
function toggleSpecular(){ if(specularSwitchSun == null){ return; } lights[0].specular = specularSwitchSun.checked; }
function changeAmbientLight(r, g, b){
	ambientLight[0] = r; ambientLight[1] = g; ambientLight[2] = b;
	gl.uniform3fv(u_AmbientLight, ambientLight);
}
//**************************************************************************************************************************************************************//
// Update program logic by the given number of ticks.
function update(){
	time = Date.now();
	var ticks = (time - lastTime)*fps/1000;
	if(ticks >= 1){
		camera.update(ticks);
		if(mouseDown){ camera.turn(ticks*TURN_SPEED_MOUSE*mouseDisplace[0], ticks*TURN_SPEED_MOUSE*mouseDisplace[1]); }
		
		ticks %= (turnTicks*2);
		// Sun movement.
		sun.rotations[0][0] = (sun.rotations[0][0] + SUN_TURN_SPEED*ticks) % 360;
		sun.vel[1] = Math.cos(sun.rotations[0][0]*RADIAN_CONVERT)*SUN_SPEED;
		sun.vel[2] = Math.sin(sun.rotations[0][0]*RADIAN_CONVERT)*SUN_SPEED;
		// Lion movement.
		body1.rotations[0][0] = (body1.rotations[0][0] + LION_TURN_SPEED*ticks) % 360;
		body1.vel[0] = Math.sin(body1.rotations[0][0]*RADIAN_CONVERT)*LION_SPEED;
		body1.vel[2] = Math.cos(body1.rotations[0][0]*RADIAN_CONVERT)*LION_SPEED;
		if(ticks+timer >= turnTicks){
			// Upadte all extant shapes by the given number of ticks.
			for(var i = 0; i < shapes.length; ++i){
				shapes[i].update(turnTicks-timer);
			}
			ticks -= turnTicks-timer;
			
			// Lion body animation cycle shift.
			body1.rotations[1][4] *= -1;
			body2.rotations[0][4] *= -1;
			head.rotations[0][4] *= -1;
			neck.rotations[0][4] *= -1;
			snoutBottom.rotations[0][4] *= -1;
			frontLegL1.rotations[0][4] *= -1;
			frontLegL2.rotations[0][4] *= -1;
			frontLegL3.rotations[0][4] *= -1;
			frontLegR1.rotations[0][4] *= -1;
			frontLegR2.rotations[0][4] *= -1;
			frontLegR3.rotations[0][4] *= -1;
			backLegL1.rotations[0][4] *= -1;
			backLegL2.rotations[0][4] *= -1;
			backLegL3.rotations[0][4] *= -1;
			backLegL4.rotations[0][4] *= -1;
			backLegR1.rotations[0][4] *= -1;
			backLegR2.rotations[0][4] *= -1;
			backLegR3.rotations[0][4] *= -1;
			backLegR4.rotations[0][4] *= -1;
			tail1.rotations[0][4] *= -1;
			tail2.rotations[0][4] *= -1;
			tail3.rotations[0][4] *= -1;
			tail4.rotations[0][4] *= -1;
			tail5.rotations[0][4] *= -1;
			tail6.rotations[0][4] *= -1;
			tail7.rotations[0][4] *= -1;
			
			// Upadte all extant shapes by the given number of ticks.
			for(var i = 0; i < shapes.length; ++i){
				shapes[i].update(ticks);
			}
			timer = ticks;
		}
		else{
			// Upadte all extant shapes by the given number of ticks.
			for(var i = 0; i < shapes.length; ++i){
				shapes[i].update(ticks);
			}
			timer += ticks;
		}
		draw();
		lastTime = time;
	}
	requestAnimationFrame(update);
}
// Draw current shapes to the canvas.
function draw(){
	clear();
	// Recalculate light positions.
	for(var i = 0; i < lights.length; ++i){ lights[i].draw(); }
	// Redraw all extant shapes to the canvas.
	for(var i = 0; i < shapes.length; ++i){
		brush.setIdentity();
		shapes[i].draw();
	}
}
//**************************************************************************************************************************************************************//
// Clear the canvas.
function clear(){
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}
// Write the given data to a buffer and return it, but don't assign it to any attribute variables.
function getArrayBuffer(data, num, type){
	// Create a WebGL buffer.
	var buffer = gl.createBuffer();
	if(!buffer){ console.error('Failed to create buffer object.'); return null; }
	// Write given data into the buffer object.
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
	// Store extra information used to assign the object to an attribute variable later.
	buffer.num = num;
	buffer.type = type;
	buffer.len = data.length/num;
	return buffer;
}
// Create and return a WebGL texture with the given source image.
function loadTexture(source){
	var texture = gl.createTexture();
	if(!texture){ console.error('Failed to create texture object.'); return null; }
	gl.bindTexture(gl.TEXTURE_2D, texture);
	
	var level = 0;
	var internalFormat = gl.RGBA, srcFormat = gl.RGBA, srcType = gl.UNSIGNED_BYTE;
	// Until the image is loaded put a single pixel in the texture as placeholder.
	var pixel = new Uint8Array([155, 0, 0, 255]);
	gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, 1, 1, 0, srcFormat, srcType, pixel);
	
	var img = new Image();
	if(!img){ console.error('Failed to create image object.'); return null; }
	img.onload = function(){
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, srcFormat, srcType, img);
		
		// WebGL1 has different requirements for images with dimensions that are both powers of 2.
		if(isPowerOf2(img.width) && isPowerOf2(img.height)){
			gl.generateMipmap(gl.TEXTURE_2D);
		}
		else{
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		}
		// Prevent a newly loaded texture from replacing the current one when only a single texture is being used.
		prevTexture = null;
	};
	// Load in the given image.
	img.src = source;
	return texture;
}
// Return a color array for the given number of vertices, initialized as the given color.
function vertexColors(vertexNum, r, g, b, a){
	a = a || 1.0; // Default alpha channel.
	vertexNum*=4;
	var colors = new Float32Array(vertexNum);
	for(var i = 0; i < vertexNum; i+=4){
		colors[i] = r; colors[i+1] = g; colors[i+2] = b; colors[i+3] = a;
	}
	return colors;
}
//**************************************************************************************************************************************************************//
// Converts hexadecimal color values to RGB format.
function hexToRgb(hex){
	// Use regexp to split hex. Every two digits or a-f are kept in one element of resuting array.
	var result = /^#?([\da-fA-F]{2})([\da-fA-F]{2})([\da-fA-F]{2})$/i.exec(hex);
	var rgb = [];
	for(var i = 0; i < 3 && i+1 < result.length; ++i){
		rgb.push(parseInt(result[i+1], 16));
	}
	return rgb;
}
// Converts RGB color values to hexadecimal format.
function rgbToHex(r, g, b){
	return "#"+hex(r) + hex(g) + hex(b);
}
function hex(n){
	var hex = Number(n).toString(16);
	if(hex.length == 1){ return "0" + hex; }
	return hex;
}
// Returns whether or not the given number is a power of 2.
function isPowerOf2(n){ return (n & (n-1)) == 0; }
